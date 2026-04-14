// ── Capture ──────────────────────────────────────────────────────────────────

export type CaptureMode = 'silent' | 'region'

// ── Answer ──────────────────────────────────────────────────────────────────

export interface AnswerItem {
  q: number
  answer: string
  confidence: 'high' | 'mid' | 'low'
  reason: string
}

// ── Error ───────────────────────────────────────────────────────────────────

export type ErrorType = 'network_error' | 'timeout' | 'no_questions' | 'parse_error' | 'unknown'

export interface CaptureError {
  type: ErrorType
  message: string
  /** Whether a cached screenshot is available for retry */
  canRetry: boolean
}

// ── Settings ─────────────────────────────────────────────────────────────────

export type TrayIcon = 'dot' | 'book' | 'bolt' | 'square'

export interface AppSettings {
  hotkeys: {
    silentCapture: string
    regionSelect: string
    toggleDropdown: string
  }
  trayIcon: TrayIcon
  hasOnboarded: boolean
  hasFirstCapture?: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  hotkeys: {
    silentCapture: 'Control+Alt+S',
    regionSelect: 'Control+Alt+A',
    toggleDropdown: 'Control+Alt+D',
  },
  trayIcon: 'dot',
  hasOnboarded: false,
}

// ── IPC Channel Definitions ──────────────────────────────────────────────────
//
// Every IPC channel used in the app is defined here so both the main process
// and the renderer (via preload) share a single source of truth.

/**
 * Main → Renderer  (one-way push via webContents.send)
 * Key = channel name, Value = payload type
 */
export interface MainToRendererEvents {
  'capture:loading': void
  'capture:result': AnswerItem[]
  'capture:error': CaptureError
  'credits:update': number
  'permission:status': boolean
}

/**
 * Renderer → Main  (fire-and-forget via ipcRenderer.send / ipcMain.on)
 * Key = channel name, Value = payload type
 */
export interface RendererToMainEvents {
  'dropdown:hide': void
  'dropdown:resize': number
}

/**
 * Renderer → Main  (request-response via ipcRenderer.invoke / ipcMain.handle)
 * Key = channel name, Value = { args, return }
 */
export interface RendererToMainCommands {
  'capture:start': { args: CaptureMode; return: void }
  'capture:retry': { args: void; return: void }
  'settings:get': { args: void; return: AppSettings }
  'settings:set': { args: Partial<AppSettings>; return: void }
  'permission:openSettings': { args: void; return: void }
  'permission:recheck': { args: void; return: boolean }
  'app:quit': { args: void; return: void }
  'onboarding:complete': { args: void; return: void }
}

// ── Channel name constants (prevents typos) ──────────────────────────────────

export const IPC = {
  // Main → Renderer
  CAPTURE_LOADING: 'capture:loading',
  CAPTURE_RESULT: 'capture:result',
  CAPTURE_ERROR: 'capture:error',
  CREDITS_UPDATE: 'credits:update',
  PERMISSION_STATUS: 'permission:status',

  // Renderer → Main (fire-and-forget)
  DROPDOWN_HIDE: 'dropdown:hide',
  DROPDOWN_RESIZE: 'dropdown:resize',

  // Renderer → Main (invoke)
  CAPTURE_START: 'capture:start',
  CAPTURE_RETRY: 'capture:retry',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  PERMISSION_OPEN_SETTINGS: 'permission:openSettings',
  PERMISSION_RECHECK: 'permission:recheck',
  APP_QUIT: 'app:quit',
  ONBOARDING_COMPLETE: 'onboarding:complete',
} as const
