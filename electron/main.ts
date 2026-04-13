import { app, globalShortcut } from 'electron'
import { initTray } from './tray'
import { initIpc, getSettings } from './ipc'

// Keep the app running when all windows are hidden (tray-only app)
app.on('window-all-closed', (e: Event) => {
  e.preventDefault()
})

app.whenReady().then(async () => {
  // Hide Dock icon — this is a menu-bar-only app
  if (app.dock) app.dock.hide()

  const settings = getSettings()
  await initTray(settings.trayIcon)
  await initIpc()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
