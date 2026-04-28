import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type CaptureMode,
  type AppSettings,
  type AnswerItem,
  type AuthUser,
  type CaptureError,
  type AnswerBubblePayload,
  type AnswerBubbleMovePayload,
  type AnswerBubbleLayoutPayload,
  type SignInResult,
  type CreditsMeta,
  type OpenBillingPortalResult,
} from '../shared/types'

contextBridge.exposeInMainWorld('snapcue', {
  platform: process.platform,

  // ── Dropdown control ─────────────────────────────────────────────────────
  hideDropdown: () => ipcRenderer.send(IPC.DROPDOWN_HIDE),
  reportHeight: (height: number) => ipcRenderer.send(IPC.DROPDOWN_RESIZE, height),

  // ── Capture ──────────────────────────────────────────────────────────────
  startCapture: (mode: CaptureMode) => ipcRenderer.invoke(IPC.CAPTURE_START, mode),

  onCaptureLoading: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on(IPC.CAPTURE_LOADING, listener)
    return () => ipcRenderer.removeListener(IPC.CAPTURE_LOADING, listener)
  },
  onCaptureResult: (cb: (answers: AnswerItem[]) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, answers: AnswerItem[]) => cb(answers)
    ipcRenderer.on(IPC.CAPTURE_RESULT, listener)
    return () => ipcRenderer.removeListener(IPC.CAPTURE_RESULT, listener)
  },
  onCaptureError: (cb: (error: CaptureError) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, error: CaptureError) => cb(error)
    ipcRenderer.on(IPC.CAPTURE_ERROR, listener)
    return () => ipcRenderer.removeListener(IPC.CAPTURE_ERROR, listener)
  },
  retryCapture: () => ipcRenderer.invoke(IPC.CAPTURE_RETRY),
  closeAnswerBubble: () => ipcRenderer.send(IPC.ANSWER_BUBBLE_CLOSE),
  setAnswerBubbleExpanded: (expanded: boolean) =>
    ipcRenderer.send(IPC.ANSWER_BUBBLE_SET_EXPANDED, expanded),
  moveAnswerBubbleBy: (delta: AnswerBubbleMovePayload) =>
    ipcRenderer.send(IPC.ANSWER_BUBBLE_MOVE_BY, delta),
  setAnswerBubbleLayout: (layout: AnswerBubbleLayoutPayload) =>
    ipcRenderer.send(IPC.ANSWER_BUBBLE_SET_LAYOUT, layout),
  onAnswerBubbleShow: (cb: (payload: AnswerBubblePayload) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: AnswerBubblePayload) => cb(payload)
    ipcRenderer.on(IPC.ANSWER_BUBBLE_SHOW, listener)
    return () => ipcRenderer.removeListener(IPC.ANSWER_BUBBLE_SHOW, listener)
  },

  // ── Credits ──────────────────────────────────────────────────────────────
  getCreditsMeta: () => ipcRenderer.invoke(IPC.CREDITS_GET) as Promise<CreditsMeta | null>,
  refreshCredits: () => ipcRenderer.invoke(IPC.CREDITS_REFRESH) as Promise<CreditsMeta | null>,
  onCreditsUpdate: (cb: (meta: CreditsMeta | null) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, meta: CreditsMeta | null) => cb(meta)
    ipcRenderer.on(IPC.CREDITS_UPDATE, listener)
    return () => ipcRenderer.removeListener(IPC.CREDITS_UPDATE, listener)
  },

  // ── Permissions ──────────────────────────────────────────────────────────
  openPermissionSettings: () => ipcRenderer.invoke(IPC.PERMISSION_OPEN_SETTINGS),
  recheckPermission: () => ipcRenderer.invoke(IPC.PERMISSION_RECHECK) as Promise<boolean>,
  onPermissionStatus: (cb: (granted: boolean) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, granted: boolean) => cb(granted)
    ipcRenderer.on(IPC.PERMISSION_STATUS, listener)
    return () => ipcRenderer.removeListener(IPC.PERMISSION_STATUS, listener)
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET) as Promise<AppSettings>,
  setSettings: (partial: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, partial) as Promise<void>,

  // ── App lifecycle ───────────────────────────────────────────────────────
  quit: () => ipcRenderer.invoke(IPC.APP_QUIT),
  relaunch: () => ipcRenderer.invoke(IPC.APP_RELAUNCH),

  // ── Onboarding ──────────────────────────────────────────────────────────
  completeOnboarding: () => ipcRenderer.invoke(IPC.ONBOARDING_COMPLETE),
  pulseTrayIcon: () => ipcRenderer.invoke(IPC.TRAY_PULSE) as Promise<void>,
  dismissCoachmark: () => ipcRenderer.send(IPC.COACHMARK_DISMISS),

  // ── Auth ────────────────────────────────────────────────────────────────
  getCurrentUser: () => ipcRenderer.invoke(IPC.AUTH_GET_CURRENT_USER) as Promise<AuthUser | null>,
  signIn: (email: string) => ipcRenderer.invoke(IPC.AUTH_SIGN_IN, email) as Promise<SignInResult>,
  verifyOtp: (email: string, code: string) =>
    ipcRenderer.invoke(IPC.AUTH_VERIFY_OTP, { email, code }) as Promise<SignInResult>,
  signInGoogle: () => ipcRenderer.invoke(IPC.AUTH_SIGN_IN_GOOGLE) as Promise<SignInResult>,
  signOut: () => ipcRenderer.invoke(IPC.AUTH_SIGN_OUT) as Promise<void>,
  openPricing: () => ipcRenderer.invoke(IPC.AUTH_OPEN_PRICING) as Promise<void>,
  openSignin: () => ipcRenderer.invoke(IPC.AUTH_OPEN_SIGNIN) as Promise<void>,
  closeSignin: () => ipcRenderer.send(IPC.AUTH_CLOSE_SIGNIN),
  openBillingPortal: () =>
    ipcRenderer.invoke(IPC.AUTH_OPEN_BILLING_PORTAL) as Promise<OpenBillingPortalResult>,
  onAuthSignedIn: (cb: (payload: { email: string }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: { email: string }) => cb(payload)
    ipcRenderer.on(IPC.AUTH_SIGNED_IN, listener)
    return () => ipcRenderer.removeListener(IPC.AUTH_SIGNED_IN, listener)
  },
  onAuthSignedOut: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on(IPC.AUTH_SIGNED_OUT, listener)
    return () => ipcRenderer.removeListener(IPC.AUTH_SIGNED_OUT, listener)
  },
})
