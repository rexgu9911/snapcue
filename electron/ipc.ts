import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  ipcMain,
  shell,
  net,
  globalShortcut,
  screen,
  type Point,
} from 'electron'
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
  type OpenBillingPortalResult,
} from '../shared/types'
import {
  sendToDropdown,
  updateTrayIcon,
  setTrayState,
  toggleDropdown,
  setOnDropdownShow,
  pulseTrayIcon,
} from './tray'
import { closeOnboardingWindow, isOnboardingOpen } from './onboarding'
import { showMenuBarCoachmark, hideMenuBarCoachmark } from './coachmark'
import { captureScreenshot, checkScreenRecordingPermission } from './screenshot'
import { loadSettings, saveSettings } from './store'
import { config } from './config'
import {
  clearStoredSession,
  getCurrentUser,
  getStoredSession,
  signInWithGoogle,
  signInWithMagicLink,
  verifyOtpCode,
} from './auth'
import { createSigninWindow, closeSigninWindow } from './signin'
import {
  hideAnswerBubble,
  registerAnswerBubbleIpc,
  showAnswerBubbleLoading,
  showAnswerBubbleResult,
} from './answer-bubble'

// 30s wasn't enough headroom for 3+ question screenshots on slow GPT-5
// mini reasoning days — users hit the timeout before the model finished.
// 45s is a balance: still bounded enough to recover from genuine network
// hangs, but tolerant of the legitimate variance in model latency.
const API_TIMEOUT_MS = 45_000

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

// ── Pricing entrypoint ──────────────────────────────────────────────────────

/**
 * Open the web pricing page in the user's default browser. When signed in,
 * forwards the Supabase session via the URL fragment so the web page can call
 * `supabase.auth.setSession()` and act as the same user — avoiding a second
 * sign-in just to upgrade. Fragment (not query string) is the standard pattern
 * Supabase itself uses for magic-link callbacks: it never reaches the server.
 */
async function openWebPricing(): Promise<void> {
  const pricingUrl = `${config.webBaseUrl}/pricing`
  const session = await getStoredSession()
  if (session?.access_token && session?.refresh_token) {
    const fragment = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }).toString()
    await shell.openExternal(`${pricingUrl}#${fragment}`)
  } else {
    await shell.openExternal(pricingUrl)
  }
}

// ── Billing portal (Stripe) ──────────────────────────────────────────────────
//
// Pattern A: app → backend /billing-portal → openExternal Stripe portal.
// Unlike checkout, billing management has no marketing surface area we'd
// want to express in our own UI — Stripe's hosted portal handles update
// card, cancel, view invoices, etc. So we skip the web /account hop.

async function openBillingPortal(): Promise<OpenBillingPortalResult> {
  const session = await getStoredSession()
  if (!session?.access_token) {
    return { ok: false, error: 'Sign in required.' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey
  }

  let res: Response
  try {
    res = await net.fetch(`${config.apiBaseUrl}/billing-portal`, {
      method: 'POST',
      headers,
      body: '{}',
    })
  } catch {
    return { ok: false, error: 'Cannot reach server. Check your connection.' }
  }

  if (!res.ok) {
    if (res.status === 401) {
      return { ok: false, error: 'Sign in required.' }
    }
    if (res.status === 400) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (body.error === 'no_customer') {
        return { ok: false, error: 'No active subscription to manage.' }
      }
    }
    return { ok: false, error: `Could not open billing portal (${res.status}).` }
  }

  const body = (await res.json().catch(() => ({}))) as { url?: string }
  if (!body.url) {
    return { ok: false, error: 'Billing portal URL missing.' }
  }

  await shell.openExternal(body.url)
  return { ok: true }
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
let lastCaptureAnchor: Point | null = null

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
  return (
    type === 'timeout' || type === 'network_error' || type === 'parse_error' || type === 'unknown'
  )
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
  const oldAnswerPeek = { ...settings.answerPeek }
  const oldIcon = settings.trayIcon

  settings = { ...settings, ...partial }
  if (partial.hotkeys) {
    settings.hotkeys = { ...oldHotkeys, ...partial.hotkeys }
  }
  if (partial.answerPeek) {
    settings.answerPeek = { ...oldAnswerPeek, ...partial.answerPeek }
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

function getCaptureAnchor(mode: CaptureMode): Point {
  const cursor = screen.getCursorScreenPoint()
  if (mode === 'region') return cursor

  const display = screen.getDisplayNearestPoint(cursor)
  const area = display.workArea
  return {
    x: Math.round(area.x + area.width - 280),
    y: Math.round(area.y + 96),
  }
}

// ── Capture handler ──────────────────────────────────────────────────────────

/** Send screenshot to backend and dispatch result/error + credits update */
async function analyzeAndDeliver(base64: string, anchor: Point): Promise<void> {
  // Full-body try/catch guarantees the renderer never stays stuck in loading:
  // once sendToDropdown(CAPTURE_LOADING) fires, exactly one of
  // CAPTURE_RESULT / CAPTURE_ERROR must follow. Any throw on the path below
  // (including tray state changes, push helpers, or post-result bookkeeping)
  // falls through to the catch and surfaces as an unknown error.
  try {
    if (settings.answerPeek.enabled) {
      showAnswerBubbleLoading(anchor, settings.answerPeek.savedPosition)
    } else {
      hideAnswerBubble()
    }
    sendToDropdown(IPC.CAPTURE_LOADING)
    setTrayState('analyzing')

    const result = await analyzeImage(base64)

    // Always propagate fresh meta when the backend returned one, so the
    // footer can reflect the new balance even on business-failure paths.
    if (result.meta) {
      pushCreditsUpdate(result.meta)
    }

    if (!result.ok) {
      hideAnswerBubble()
      const error: CaptureError = {
        type: result.errorType,
        message: messageForErrorType(result.errorType),
        canRetry: isRetryableErrorType(result.errorType),
      }
      sendToDropdown(IPC.CAPTURE_ERROR, error)
      return
    }

    if (result.answers.length === 0) {
      hideAnswerBubble()
      const error: CaptureError = {
        type: 'no_questions',
        message: messageForErrorType('no_questions'),
        canRetry: false,
      }
      sendToDropdown(IPC.CAPTURE_ERROR, error)
      return
    }

    sendToDropdown(IPC.CAPTURE_RESULT, result.answers)
    if (settings.answerPeek.enabled) {
      showAnswerBubbleResult(result.answers)
    }

    // Auto-copy the answer when exactly one question was detected. Multi-
    // question screenshots are ambiguous (which one to copy?) — leave those
    // to the manual click-to-copy in the answer panel.
    if (settings.answerPeek.autoCopy && result.answers.length === 1) {
      const answer = result.answers[0].answer.trim()
      if (answer) clipboard.writeText(answer)
    }

    if (!settings.hasFirstCapture) {
      applySettingsChange({ hasFirstCapture: true })
    }
  } catch (err) {
    console.error('[ipc] analyzeAndDeliver unexpected error:', err)
    hideAnswerBubble()
    sendToDropdown(IPC.CAPTURE_ERROR, {
      type: 'unknown',
      message: 'Unexpected error. Try again.',
      canRetry: true,
    })
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
  lastCaptureAnchor = getCaptureAnchor(mode)

  // Step 2: analyze. Outer catch is a last line of defense — Fix 2.1 already
  // wraps analyzeAndDeliver's body, but hotkey handlers are fire-and-forget
  // async, so any uncaught throw here would silently become an unhandled
  // promise rejection. Leave a breadcrumb in console + surface a generic
  // error to the renderer.
  try {
    await analyzeAndDeliver(base64, lastCaptureAnchor)
  } catch (err) {
    console.error('[ipc] handleCapture top-level error:', err)
    sendToDropdown(IPC.CAPTURE_ERROR, {
      type: 'unknown',
      message: 'Unexpected error. Try again.',
      canRetry: true,
    })
    setTrayState('done')
  }
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

  await analyzeAndDeliver(lastScreenshot, lastCaptureAnchor ?? screen.getCursorScreenPoint())
}

// ── Register all IPC handlers ────────────────────────────────────────────────

export async function initIpc(): Promise<void> {
  registerAnswerBubbleIpc({
    onSavePosition: (pos) => {
      applySettingsChange({
        answerPeek: { ...settings.answerPeek, savedPosition: pos },
      })
    },
  })

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

  ipcMain.handle(IPC.PERMISSION_OPEN_SETTINGS, async () => {
    // Force-register SnapCue in macOS TCC before opening Settings.
    // Without this, a fresh install has never attempted screen capture,
    // so the Privacy & Security → Screen Recording list is empty and
    // the user can't toggle anything on. Calling desktopCapturer.getSources
    // is the lightest-touch API that triggers TCC registration; it
    // returns silently if permission isn't granted, but the entry still
    // gets added to the Privacy list.
    try {
      await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1, height: 1 },
      })
    } catch {
      // Registration happens on attempt regardless of result — ignore.
    }
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

  ipcMain.handle(IPC.APP_RELAUNCH, () => {
    // macOS caches Screen Recording permission status per-process: even
    // after the user toggles it on in System Settings, the running app
    // still reads "denied" until the process restarts. Hence relaunch.
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle(IPC.ONBOARDING_COMPLETE, () => {
    applySettingsChange({ hasOnboarded: true })
    closeOnboardingWindow()
    // Surface the menu-bar coachmark right after the onboarding window
    // closes so the user discovers where SnapCue lives. The coachmark is a
    // small floating window pointing up at the tray icon; the in-flight
    // tray pulse triggered from the renderer reinforces it.
    showMenuBarCoachmark()
  })

  ipcMain.handle(IPC.AUTH_GET_CURRENT_USER, async (): Promise<AuthUser | null> => {
    const user = await getCurrentUser()
    if (!user?.email) return null
    return { id: user.id, email: user.email }
  })

  ipcMain.handle(IPC.AUTH_SIGN_IN, async (_event, email: string): Promise<SignInResult> => {
    return signInWithMagicLink(email)
  })

  ipcMain.handle(
    IPC.AUTH_VERIFY_OTP,
    async (_event, args: { email: string; code: string }): Promise<SignInResult> => {
      const result = await verifyOtpCode(args.email, args.code)
      if (!result.success) return result

      // Mirror what the deep-link auth-callback path does after a successful
      // verify: broadcast signed-in to all windows so onboarding/signin/footer
      // update; close the standalone signin window if it was the entry point;
      // refresh credits so footer shows balance immediately.
      const user = await getCurrentUser()
      if (user?.email) {
        const payload = { email: user.email }
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send(IPC.AUTH_SIGNED_IN, payload)
        }
      }
      closeSigninWindow()
      void refreshCreditsMeta()
      return { success: true }
    },
  )

  ipcMain.handle(IPC.AUTH_SIGN_IN_GOOGLE, async (): Promise<SignInResult> => {
    // Two-stage OAuth flow:
    //  1. Ask Supabase for the Google authorization URL (skipBrowserRedirect
    //     keeps the call from trying to navigate inside main process).
    //  2. Open that URL in the user's default browser; Supabase + Google
    //     handle the rest, eventually redirecting to snapcue:// which the
    //     deep-link handler in main.ts picks up exactly like magic link.
    const result = await signInWithGoogle()
    if (!result.success || !result.url) {
      return { success: false, error: result.error ?? 'Failed to start Google sign-in.' }
    }
    await shell.openExternal(result.url)
    return { success: true }
  })

  ipcMain.handle(IPC.AUTH_SIGN_OUT, async () => {
    await clearStoredSession()
    pushCreditsUpdate(null)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.AUTH_SIGNED_OUT)
    }
  })

  ipcMain.handle(IPC.AUTH_OPEN_PRICING, () => {
    return openWebPricing()
  })

  ipcMain.handle(IPC.AUTH_OPEN_BILLING_PORTAL, async (): Promise<OpenBillingPortalResult> => {
    return openBillingPortal()
  })

  ipcMain.handle(IPC.AUTH_OPEN_SIGNIN, () => {
    createSigninWindow()
  })

  ipcMain.on(IPC.AUTH_CLOSE_SIGNIN, () => {
    closeSigninWindow()
  })

  ipcMain.on(IPC.COACHMARK_DISMISS, () => {
    hideMenuBarCoachmark()
  })

  ipcMain.handle(IPC.CREDITS_GET, (): CreditsMeta | null => {
    return latestCreditsMeta
  })

  ipcMain.handle(IPC.CREDITS_REFRESH, async (): Promise<CreditsMeta | null> => {
    return refreshCreditsMeta()
  })

  ipcMain.handle(IPC.TRAY_PULSE, () => {
    return pulseTrayIcon()
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
    void getCurrentUser().then((user) => {
      if (!user?.email) return
      sendToDropdown(IPC.AUTH_SIGNED_IN, { email: user.email })
    })
  })
}

export function getSettings(): AppSettings {
  return { ...settings }
}
