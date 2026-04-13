import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type CaptureMode, type AppSettings, type AnswerItem, type CaptureError } from '../shared/types'

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

  // ── Credits ──────────────────────────────────────────────────────────────
  onCreditsUpdate: (cb: (balance: number) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, balance: number) => cb(balance)
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
})
