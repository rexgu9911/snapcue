import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { IPC, type UpdateStatus } from '../shared/types'

// In-process status mirror so any window opening Settings later sees the
// current update phase — including a downloaded update waiting to install
// from the silent startup check.
let currentStatus: UpdateStatus = { phase: 'idle' }

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.UPDATE_STATUS, currentStatus)
  }
}

function setStatus(next: UpdateStatus): void {
  currentStatus = next
  broadcast()
}

export function initUpdater(): void {
  // Wire events unconditionally so manual checks in dev mode can still drive
  // the UI through a fake "up-to-date" path. Real network calls are gated
  // separately below.
  autoUpdater.on('checking-for-update', () => setStatus({ phase: 'checking' }))
  autoUpdater.on('update-not-available', () => setStatus({ phase: 'up-to-date' }))
  autoUpdater.on('update-available', (info) => {
    setStatus({ phase: 'downloading', version: info.version })
  })
  autoUpdater.on('update-downloaded', (info) => {
    setStatus({ phase: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    setStatus({ phase: 'error', message: err?.message ?? 'Update failed.' })
  })

  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())

  ipcMain.handle(IPC.UPDATE_GET_STATUS, () => currentStatus)

  ipcMain.handle(IPC.UPDATE_CHECK, async () => {
    if (is.dev) {
      // electron-updater throws in dev (no app-update.yml). Pretend we're
      // current so the UI is exercisable locally without breaking.
      setStatus({ phase: 'up-to-date' })
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed.'
      setStatus({ phase: 'error', message })
    }
  })

  ipcMain.handle(IPC.UPDATE_QUIT_AND_INSTALL, () => {
    if (is.dev) return
    autoUpdater.quitAndInstall()
  })
}

export function startBackgroundCheck(): void {
  if (is.dev) return
  // Defer 5s so the app finishes initializing before we hit the network.
  // checkForUpdatesAndNotify still produces the native macOS notification on
  // download, complementing our in-app Settings surface.
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn('[SnapCue] Update check failed:', err?.message ?? err)
    })
  }, 5000)
}
