import { app, ipcMain, shell, net, globalShortcut } from 'electron'
import {
  IPC,
  type CaptureMode,
  type AppSettings,
  type AnswerItem,
  type CaptureError,
  type ErrorType,
} from '../shared/types'
import { sendToDropdown, updateTrayIcon, setTrayState, toggleDropdown } from './tray'
import { closeOnboardingWindow, isOnboardingOpen } from './onboarding'
import { captureScreenshot, checkScreenRecordingPermission } from './screenshot'
import { loadSettings, saveSettings } from './store'

const API_BASE = 'http://localhost:3001'
const API_TIMEOUT_MS = 30_000

interface AnalyzeResponse {
  answers: AnswerItem[]
  usage: { prompt_tokens: number; completion_tokens: number }
}

async function analyzeImage(base64: string): Promise<AnswerItem[]> {
  const fetchPromise = net.fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  })

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error('AI analysis timed out')), API_TIMEOUT_MS)
  })

  const res = await Promise.race([fetchPromise, timeoutPromise])

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error((body['error'] as string) ?? `Server error ${res.status}`)
  }

  const data = (await res.json()) as AnalyzeResponse
  return data.answers
}

// ── Last screenshot cache (for retry) ───────────────────────────────────────

let lastScreenshot: string | null = null

// ── Error classification ────────────────────────────────────────────────────

function classifyError(err: unknown): { type: ErrorType; message: string } {
  const msg = err instanceof Error ? err.message : 'Analysis failed'

  if (msg.includes('timed out') || msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
    return { type: 'timeout', message: 'AI analysis timed out. Try again.' }
  }

  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('ERR_CONNECTION_REFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ERR_NAME_NOT_RESOLVED') ||
    msg.includes('ERR_CONNECTION_TIMED_OUT') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('NetworkError')
  ) {
    return { type: 'network_error', message: 'Cannot reach server. Check your connection.' }
  }

  if (msg.includes('not a JSON') || msg.includes('JSON')) {
    return { type: 'parse_error', message: 'Failed to parse AI response. Try again.' }
  }

  return { type: 'unknown', message: 'Something went wrong. Try again.' }
}

// ── Permission state ─────────────────────────────────────────────────────────

let screenPermissionGranted = false

export function isScreenRecordingGranted(): boolean {
  return screenPermissionGranted
}

// ── Settings state (persisted to JSON file) ─────────────────────────────────

let settings: AppSettings = loadSettings()

// ── Shortcut registration ───────────────────────────────────────────────────

function registerShortcuts(): void {
  globalShortcut.unregisterAll()
  try {
    globalShortcut.register(settings.hotkeys.silentCapture, () => handleCapture('silent'))
  } catch (err) {
    console.error('[SnapCue] Failed to register silentCapture shortcut:', err)
  }
  try {
    globalShortcut.register(settings.hotkeys.regionSelect, () => handleCapture('region'))
  } catch (err) {
    console.error('[SnapCue] Failed to register regionSelect shortcut:', err)
  }
  try {
    globalShortcut.register(settings.hotkeys.toggleDropdown, () => {
      if (isOnboardingOpen()) return
      toggleDropdown()
    })
  } catch (err) {
    console.error('[SnapCue] Failed to register toggleDropdown shortcut:', err)
  }
}

function applySettingsChange(partial: Partial<AppSettings>): void {
  const oldHotkeys = { ...settings.hotkeys }
  const oldIcon = settings.trayIcon

  settings = { ...settings, ...partial }
  if (partial.hotkeys) {
    settings.hotkeys = { ...oldHotkeys, ...partial.hotkeys }
  }
  saveSettings(settings)

  // Re-register shortcuts if hotkeys changed
  if (partial.hotkeys) {
    registerShortcuts()
  }

  // Update tray icon if changed
  if (partial.trayIcon && partial.trayIcon !== oldIcon) {
    updateTrayIcon(partial.trayIcon)
  }
}

// ── Capture handler ──────────────────────────────────────────────────────────

/** Send screenshot to backend and handle result/error */
async function analyzeAndDeliver(base64: string): Promise<void> {
  sendToDropdown(IPC.CAPTURE_LOADING)
  setTrayState('analyzing')

  try {
    const result = await analyzeImage(base64)

    if (result.length === 0) {
      const error: CaptureError = {
        type: 'no_questions',
        message: 'No quiz questions detected in the screenshot.',
        canRetry: false,
      }
      sendToDropdown(IPC.CAPTURE_ERROR, error)
      return
    }

    sendToDropdown(IPC.CAPTURE_RESULT, result)

    // Mark first successful capture
    if (!settings.hasFirstCapture) {
      applySettingsChange({ hasFirstCapture: true })
    }
  } catch (err) {
    const { type, message } = classifyError(err)
    const error: CaptureError = { type, message, canRetry: true }
    sendToDropdown(IPC.CAPTURE_ERROR, error)
  } finally {
    setTrayState('done')
  }
}

async function handleCapture(mode: CaptureMode): Promise<void> {
  if (!screenPermissionGranted) {
    sendToDropdown(IPC.PERMISSION_STATUS, false)
    return
  }

  // Step 1: capture screenshot silently — if user cancels region select, do nothing
  let base64: string
  try {
    base64 = await captureScreenshot(mode)
  } catch {
    // User cancelled or screenshot failed — stay silent, no UI
    return
  }

  // Cache for retry
  lastScreenshot = base64

  // Step 2: analyze
  await analyzeAndDeliver(base64)
}

async function handleRetry(): Promise<void> {
  if (!lastScreenshot) {
    const error: CaptureError = {
      type: 'unknown',
      message: 'No previous screenshot to retry.',
      canRetry: false,
    }
    sendToDropdown(IPC.CAPTURE_ERROR, error)
    return
  }

  await analyzeAndDeliver(lastScreenshot)
}

// ── Register all IPC handlers ────────────────────────────────────────────────

export async function initIpc(): Promise<void> {
  // Check permission on startup
  screenPermissionGranted = checkScreenRecordingPermission()
  if (!screenPermissionGranted) {
    console.warn('SnapCue: Screen recording permission not granted')
  }

  // ── Renderer → Main (invoke / request-response) ─────────────────────────

  ipcMain.handle(IPC.CAPTURE_START, (_event, mode: CaptureMode) => {
    return handleCapture(mode)
  })

  ipcMain.handle(IPC.CAPTURE_RETRY, () => {
    return handleRetry()
  })

  ipcMain.handle(IPC.PERMISSION_OPEN_SETTINGS, () => {
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    )
  })

  ipcMain.handle(IPC.PERMISSION_RECHECK, () => {
    screenPermissionGranted = checkScreenRecordingPermission()
    sendToDropdown(IPC.PERMISSION_STATUS, screenPermissionGranted)
    return screenPermissionGranted
  })

  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return { ...settings }
  })

  ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Partial<AppSettings>) => {
    applySettingsChange(partial)
  })

  ipcMain.handle(IPC.APP_QUIT, () => {
    app.quit()
  })

  ipcMain.handle(IPC.ONBOARDING_COMPLETE, () => {
    applySettingsChange({ hasOnboarded: true })
    closeOnboardingWindow()
  })

  // Register global shortcuts from persisted settings
  registerShortcuts()

  // If not granted on startup, push the guide to renderer after it mounts
  if (!screenPermissionGranted) {
    setTimeout(() => sendToDropdown(IPC.PERMISSION_STATUS, false), 500)
  }
}

export function getSettings(): AppSettings {
  return { ...settings }
}
