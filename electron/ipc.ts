import { app, ipcMain, shell } from 'electron'
import {
  IPC,
  DEFAULT_SETTINGS,
  type CaptureMode,
  type AppSettings,
} from '../shared/types'
import { sendToDropdown } from './tray'
import { captureScreenshot } from './screenshot'
import { checkScreenRecordingPermission } from './screenshot'

// ── Permission state ─────────────────────────────────────────────────────────

let screenPermissionGranted = false

export function isScreenRecordingGranted(): boolean {
  return screenPermissionGranted
}

// ── Settings state (in-memory for now) ───────────────────────────────────────

let settings: AppSettings = { ...DEFAULT_SETTINGS }

// ── Capture handler ──────────────────────────────────────────────────────────

async function handleCapture(mode: CaptureMode): Promise<void> {
  if (!screenPermissionGranted) {
    sendToDropdown(IPC.PERMISSION_STATUS, false)
    return
  }

  sendToDropdown(IPC.CAPTURE_LOADING)

  try {
    const base64 = await captureScreenshot(mode)
    // TODO: send base64 to backend API for analysis
    // For now, stay in loading state (API integration comes later)
    void base64
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Screenshot failed'
    sendToDropdown(IPC.CAPTURE_ERROR, message)
  }
}

// ── Register all IPC handlers ────────────────────────────────────────────────

export async function initIpc(): Promise<void> {
  // Check permission on startup
  screenPermissionGranted = await checkScreenRecordingPermission()
  if (!screenPermissionGranted) {
    console.warn('SnapCue: Screen recording permission not granted')
  }

  // ── Renderer → Main (invoke / request-response) ─────────────────────────

  ipcMain.handle(IPC.CAPTURE_START, (_event, mode: CaptureMode) => {
    return handleCapture(mode)
  })

  ipcMain.handle(IPC.PERMISSION_OPEN_SETTINGS, () => {
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    )
  })

  ipcMain.handle(IPC.PERMISSION_RECHECK, async () => {
    screenPermissionGranted = await checkScreenRecordingPermission()
    sendToDropdown(IPC.PERMISSION_STATUS, screenPermissionGranted)
    return screenPermissionGranted
  })

  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return { ...settings }
  })

  ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Partial<AppSettings>) => {
    settings = { ...settings, ...partial }
  })

  ipcMain.handle(IPC.APP_QUIT, () => {
    app.quit()
  })

  // If not granted on startup, push the guide to renderer after it mounts
  if (!screenPermissionGranted) {
    setTimeout(() => sendToDropdown(IPC.PERMISSION_STATUS, false), 500)
  }
}

export { handleCapture }
