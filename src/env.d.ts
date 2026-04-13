/// <reference types="vite/client" />

// Use import() to keep this file as an ambient declaration (not a module)
type CaptureMode = import('../shared/types').CaptureMode
type AppSettings = import('../shared/types').AppSettings
type AnswerItem = import('../shared/types').AnswerItem
type CaptureError = import('../shared/types').CaptureError
type ErrorType = import('../shared/types').ErrorType
type TrayIcon = import('../shared/types').TrayIcon

interface SnapCueAPI {
  platform: string

  // Dropdown control
  hideDropdown: () => void
  reportHeight: (height: number) => void

  // Capture
  startCapture: (mode: CaptureMode) => Promise<void>
  onCaptureLoading: (cb: () => void) => () => void
  onCaptureResult: (cb: (answers: AnswerItem[]) => void) => () => void
  onCaptureError: (cb: (error: CaptureError) => void) => () => void
  retryCapture: () => Promise<void>

  // Credits
  onCreditsUpdate: (cb: (balance: number) => void) => () => void

  // Permissions
  openPermissionSettings: () => Promise<void>
  recheckPermission: () => Promise<boolean>
  onPermissionStatus: (cb: (granted: boolean) => void) => () => void

  // Settings
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<void>

  // App lifecycle
  quit: () => Promise<void>
}

interface Window {
  snapcue: SnapCueAPI
}
