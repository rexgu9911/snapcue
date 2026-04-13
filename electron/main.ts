import { app, globalShortcut } from 'electron'
import { initTray } from './tray'
import { initIpc, handleCapture } from './ipc'

// Keep the app running when all windows are hidden (tray-only app)
app.on('window-all-closed', (e: Event) => {
  e.preventDefault()
})

app.whenReady().then(async () => {
  // Hide Dock icon — this is a menu-bar-only app
  if (app.dock) app.dock.hide()

  initTray()
  await initIpc()

  // Register global hotkeys
  globalShortcut.register('Control+Alt+S', () => handleCapture('silent'))
  globalShortcut.register('Control+Alt+A', () => handleCapture('region'))
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
