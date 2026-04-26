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

export type ErrorType =
  | 'network_error'
  | 'timeout'
  | 'no_questions'
  | 'parse_error'
  | 'unknown'
  | 'auth_required'
  | 'no_credits'
  | 'daily_limit'

export interface CaptureError {
  type: ErrorType
  message: string
  /** Whether a cached screenshot is available for retry */
  canRetry: boolean
}

// ── Credits ─────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'none' | 'active' | 'expired' | 'canceled'
export type SubscriptionType = 'weekly' | 'monthly' | null

export interface CreditsMeta {
  /** Free + paid credits combined. -1 means unlimited (active subscription). */
  credits_remaining: number
  daily_usage_count: number
  subscription_status: SubscriptionStatus
  subscription_type: SubscriptionType
  subscription_expires_at: string | null
  /**
   * True when the user has cancelled and the cancellation takes effect at
   * `subscription_expires_at`. Drives "Cancels MMM dd" vs "Renews MMM dd"
   * in the Settings ACCOUNT row.
   */
  subscription_cancel_at_period_end: boolean
}

// ── Settings ─────────────────────────────────────────────────────────────────

export type TrayIcon = 'dot' | 'book' | 'bolt' | 'square' | 'input' | 'shield' | 'cn' | 'ghost'

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
  trayIcon: 'ghost',
  hasOnboarded: false,
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
}

export interface SignInResult {
  success: boolean
  error?: string
}

// Result of opening the Stripe billing portal from Electron main. Returned
// to the renderer so the caller can render an inline error (e.g., "no
// active subscription to manage") instead of silently failing.
export type OpenBillingPortalResult = { ok: true } | { ok: false; error: string }

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
  'credits:update': CreditsMeta | null
  'permission:status': boolean
  'auth:signedIn': { email: string }
  'auth:signedOut': void
}

/**
 * Renderer → Main  (fire-and-forget via ipcRenderer.send / ipcMain.on)
 * Key = channel name, Value = payload type
 */
export interface RendererToMainEvents {
  'dropdown:hide': void
  'dropdown:resize': number
  'auth:closeSignin': void
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
  'app:relaunch': { args: void; return: void }
  'onboarding:complete': { args: void; return: void }
  'auth:getCurrentUser': { args: void; return: AuthUser | null }
  'auth:signIn': { args: string; return: SignInResult }
  'auth:signOut': { args: void; return: void }
  'auth:openPricing': { args: void; return: void }
  'auth:openSignin': { args: void; return: void }
  'auth:openBillingPortal': { args: void; return: OpenBillingPortalResult }
  'credits:get': { args: void; return: CreditsMeta | null }
  'credits:refresh': { args: void; return: CreditsMeta | null }
}

// ── Channel name constants (prevents typos) ──────────────────────────────────

export const IPC = {
  // Main → Renderer
  CAPTURE_LOADING: 'capture:loading',
  CAPTURE_RESULT: 'capture:result',
  CAPTURE_ERROR: 'capture:error',
  CREDITS_UPDATE: 'credits:update',
  PERMISSION_STATUS: 'permission:status',
  AUTH_SIGNED_IN: 'auth:signedIn',
  AUTH_SIGNED_OUT: 'auth:signedOut',

  // Renderer → Main (fire-and-forget)
  DROPDOWN_HIDE: 'dropdown:hide',
  DROPDOWN_RESIZE: 'dropdown:resize',
  AUTH_CLOSE_SIGNIN: 'auth:closeSignin',

  // Renderer → Main (invoke)
  CAPTURE_START: 'capture:start',
  CAPTURE_RETRY: 'capture:retry',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  PERMISSION_OPEN_SETTINGS: 'permission:openSettings',
  PERMISSION_RECHECK: 'permission:recheck',
  APP_QUIT: 'app:quit',
  APP_RELAUNCH: 'app:relaunch',
  ONBOARDING_COMPLETE: 'onboarding:complete',
  AUTH_GET_CURRENT_USER: 'auth:getCurrentUser',
  AUTH_SIGN_IN: 'auth:signIn',
  AUTH_SIGN_OUT: 'auth:signOut',
  AUTH_OPEN_PRICING: 'auth:openPricing',
  AUTH_OPEN_SIGNIN: 'auth:openSignin',
  AUTH_OPEN_BILLING_PORTAL: 'auth:openBillingPortal',
  CREDITS_GET: 'credits:get',
  CREDITS_REFRESH: 'credits:refresh',
} as const
