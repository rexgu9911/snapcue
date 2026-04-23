import { app, BrowserWindow, globalShortcut } from 'electron'
import { initTray } from './tray'
import { initIpc, getSettings } from './ipc'
import { createOnboardingWindow } from './onboarding'
import { setStoredSession } from './auth'
import { IPC } from '../shared/types'

// Register custom protocol handler for auth deep links.
// Must happen synchronously at startup so macOS routes snapcue:// URLs here.
app.setAsDefaultProtocolClient('snapcue')

// open-url can fire before app is ready (when launched *by* a deep link on
// macOS). Buffer the URL and process after init.
let isReady = false
let pendingDeepLink: string | null = null

app.on('open-url', (event, url) => {
  event.preventDefault()
  if (isReady) {
    handleDeepLink(url)
  } else {
    pendingDeepLink = url
  }
})

async function handleDeepLink(raw: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return
  }

  if (parsed.protocol !== 'snapcue:') return
  if (parsed.hostname !== 'auth-callback') return

  const access_token = parsed.searchParams.get('access_token')
  const refresh_token = parsed.searchParams.get('refresh_token')
  if (!access_token || !refresh_token) return

  const session = await setStoredSession(access_token, refresh_token)
  if (!session?.user?.email) return

  const payload = { email: session.user.email }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.AUTH_SIGNED_IN, payload)
  }
}

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

  // Show onboarding on first launch
  if (!settings.hasOnboarded) {
    // Temporarily show dock so onboarding window is accessible via Cmd+Tab
    if (app.dock) app.dock.show()
    createOnboardingWindow()
  }

  isReady = true
  if (pendingDeepLink) {
    const url = pendingDeepLink
    pendingDeepLink = null
    handleDeepLink(url)
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
