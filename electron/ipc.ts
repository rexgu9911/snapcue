import { app, BrowserWindow, ipcMain, shell, net, globalShortcut } from 'electron'
import {
  IPC,
  type CaptureMode,
  type AppSettings,
  type AnswerItem,
  type CaptureError,
  type ErrorType,
  type AuthUser,
  type SignInResult,
  type CreditsMeta,
} from '../shared/types'
import {
  sendToDropdown,
  updateTrayIcon,
  setTrayState,
  toggleDropdown,
  setOnDropdownShow,
} from './tray'
import { closeOnboardingWindow, isOnboardingOpen } from './onboarding'
import { captureScreenshot, checkScreenRecordingPermission } from './screenshot'
import { loadSettings, saveSettings } from './store'
import { config } from './config'
import { clearStoredSession, getCurrentUser, getStoredSession, signInWithMagicLink } from './auth'

const API_TIMEOUT_MS = 30_000
const PRICING_URL = 'https://snapcue-web.vercel.app/pricing'

// ── Backend response shapes ─────────────────────────────────────────────────

interface AnalyzeSuccess {
  answers: AnswerItem[]
  meta: (CreditsMeta & { source: 'free' | 'paid' | 'subscription' }) | null
}

interface AnalyzeError {
  error: string
  meta?: CreditsMeta | null
  reason?: string
}

type AnalyzeResult =
  | { ok: true; answers: AnswerItem[]; meta: CreditsMeta | null }
  | { ok: false; errorType: ErrorType; meta: CreditsMeta | null }

async function analyzeImage(base64: string): Promise<AnalyzeResult> {
  // Per product rule 2.3: unauthenticated requests never leave the client.
  const session = await getStoredSession()
  if (!session?.access_token) {
    return { ok: false, errorType: 'auth_required', meta: null }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey
  }

  const fetchPromise = net.fetch(`${config.apiBaseUrl}/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: base64 }),
  })
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('AI analysis timed out')), API_TIMEOUT_MS)
  })

  let res: Response
  try {
    res = await Promise.race([fetchPromise, timeoutPromise])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      return { ok: false, errorType: 'timeout', meta: null }
    }
    return { ok: false, errorType: 'network_error', meta: null }
  }

  const body = (await res.json().catch(() => ({}))) as AnalyzeError | AnalyzeSuccess
  const bodyMeta = (body as AnalyzeError).meta ?? null

  if (res.status === 200) {
    const success = body as AnalyzeSuccess
    return { ok: true, answers: success.answers, meta: success.meta }
  }

  if (res.status === 401) return { ok: false, errorType: 'auth_required', meta: null }
  if (res.status === 402) return { ok: false, errorType: 'no_credits', meta: bodyMeta }
  if (res.status === 429) return { ok: false, errorType: 'daily_limit', meta: bodyMeta }

  // 502: either business parse_error (meta present, credit consumed) or
  // ai_unavailable (no meta, credit refunded). 504 is timeout after refund.
  if (res.status === 502 || res.status === 504) {
    const errorField = (body as AnalyzeError).error
    if (errorField === 'parse_error' || errorField === 'no_response') {
      return { ok: false, errorType: 'parse_error', meta: bodyMeta }
    }
    if (res.status === 504) {
      return { ok: false, errorType: 'timeout', meta: null }
    }
    return { ok: false, errorType: 'network_error', meta: null }
  }

  return { ok: false, errorType: 'unknown', meta: bodyMeta }
}

// ── GET /me ─────────────────────────────────────────────────────────────────

interface MeResponse {
  user: AuthUser
  meta: CreditsMeta
}

async function fetchCreditsMeta(): Promise<CreditsMeta | null> {
  const session = await getStoredSession()
  if (!session?.access_token) return null

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  }
  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey
  }

  try {
    const res = await net.fetch(`${config.apiBaseUrl}/me`, { headers })
    if (!res.ok) return null
    const body = (await res.json()) as MeResponse
    return body.meta
  } catch {
    return null
  }
}

// ── Credits cache + pushers ─────────────────────────────────────────────────

let latestCreditsMeta: CreditsMeta | null = null

function pushCreditsUpdate(meta: CreditsMeta | null): void {
  latestCreditsMeta = meta
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.CREDITS_UPDATE, meta)
  }
}

export async function refreshCreditsMeta(): Promise<CreditsMeta | null> {
  const meta = await fetchCreditsMeta()
  pushCreditsUpdate(meta)
  return meta
}

// ── Last screenshot cache (for retry) ───────────────────────────────────────

let lastScreenshot: string | null = null

// ── Error type → user-facing copy + retry policy ────────────────────────────

function messageForErrorType(type: ErrorType): string {
  switch (type) {
    case 'timeout':
      return 'AI analysis timed out. Try again.'
    case 'network_error':
      return 'Cannot reach server. Check your connection.'
    case 'parse_error':
      return 'Failed to parse AI response. Try again.'
    case 'auth_required':
      return 'Sign in to continue.'
    case 'no_credits':
      return "You're out of credits."
    case 'daily_limit':
      return 'Daily limit reached.'
    case 'no_questions':
      return 'No quiz questions detected in the screenshot.'
    default:
      return 'Something went wrong. Try again.'
  }
}

function isRetryableErrorType(type: ErrorType): boolean {
  // Re-submitting the same screenshot is only useful when the issue is
  // transient (network, timeout, AI glitch). Auth/billing/daily-limit/
  // no_questions all require user action or a different image.
  return type === 'timeout' || type === 'network_error' || type === 'parse_error' || type === 'unknown'
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

/** Send screenshot to backend and dispatch result/error + credits update */
async function analyzeAndDeliver(base64: string): Promise<void> {
  sendToDropdown(IPC.CAPTURE_LOADING)
  setTrayState('analyzing')

  try {
    const result = await analyzeImage(base64)

    // Always propagate fresh meta when the backend returned one, so the
    // footer can reflect the new balance even on business-failure paths.
    if (result.meta) {
      pushCreditsUpdate(result.meta)
    }

    if (!result.ok) {
      const error: CaptureError = {
        type: result.errorType,
        message: messageForErrorType(result.errorType),
        canRetry: isRetryableErrorType(result.errorType),
      }
      sendToDropdown(IPC.CAPTURE_ERROR, error)
      return
    }

    if (result.answers.length === 0) {
      const error: CaptureError = {
        type: 'no_questions',
        message: messageForErrorType('no_questions'),
        canRetry: false,
      }
      sendToDropdown(IPC.CAPTURE_ERROR, error)
      return
    }

    sendToDropdown(IPC.CAPTURE_RESULT, result.answers)

    if (!settings.hasFirstCapture) {
      applySettingsChange({ hasFirstCapture: true })
    }
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

  ipcMain.handle(IPC.AUTH_GET_CURRENT_USER, async (): Promise<AuthUser | null> => {
    const user = await getCurrentUser()
    if (!user?.email) return null
    return { id: user.id, email: user.email }
  })

  ipcMain.handle(IPC.AUTH_SIGN_IN, async (_event, email: string): Promise<SignInResult> => {
    return signInWithMagicLink(email)
  })

  ipcMain.handle(IPC.AUTH_SIGN_OUT, async () => {
    await clearStoredSession()
    pushCreditsUpdate(null)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.AUTH_SIGNED_OUT)
    }
  })

  ipcMain.handle(IPC.AUTH_OPEN_PRICING, () => {
    shell.openExternal(PRICING_URL)
  })

  ipcMain.handle(IPC.CREDITS_GET, (): CreditsMeta | null => {
    return latestCreditsMeta
  })

  ipcMain.handle(IPC.CREDITS_REFRESH, async (): Promise<CreditsMeta | null> => {
    return refreshCreditsMeta()
  })

  // Register global shortcuts from persisted settings
  registerShortcuts()

  // If not granted on startup, push the guide to renderer after it mounts
  if (!screenPermissionGranted) {
    setTimeout(() => sendToDropdown(IPC.PERMISSION_STATUS, false), 500)
  }

  // Prefetch credits if already signed in — footer / settings render
  // with a real number instead of a blank on app launch.
  void refreshCreditsMeta()

  // Every time the dropdown becomes visible, re-pull /me so the footer
  // reflects server-side changes that happened while the window was hidden
  // (upgrades in the browser, device sync, manual SQL, etc.).
  setOnDropdownShow(() => {
    void refreshCreditsMeta()
  })
}

export function getSettings(): AppSettings {
  return { ...settings }
}
