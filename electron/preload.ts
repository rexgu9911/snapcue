import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type CaptureMode, type AppSettings } from '../shared/types'

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
  onCaptureResult: (cb: (answer: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, answer: string) => cb(answer)
    ipcRenderer.on(IPC.CAPTURE_RESULT, listener)
    return () => ipcRenderer.removeListener(IPC.CAPTURE_RESULT, listener)
  },
  onCaptureError: (cb: (message: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, message: string) => cb(message)
    ipcRenderer.on(IPC.CAPTURE_ERROR, listener)
    return () => ipcRenderer.removeListener(IPC.CAPTURE_ERROR, listener)
  },

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
