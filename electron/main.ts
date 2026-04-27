import { app, BrowserWindow, globalShortcut } from 'electron'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { initTray } from './tray'
import { initIpc, getSettings, refreshCreditsMeta } from './ipc'
import { createOnboardingWindow } from './onboarding'
import { closeSigninWindow } from './signin'
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

  switch (parsed.hostname) {
    case 'auth-callback':
      await handleAuthCallback(parsed)
      return
    case 'checkout-success':
      await handleCheckoutSuccess()
      return
    default:
      return
  }
}

async function handleAuthCallback(parsed: URL): Promise<void> {
  const access_token = parsed.searchParams.get('access_token')
  const refresh_token = parsed.searchParams.get('refresh_token')
  if (!access_token || !refresh_token) return

  const session = await setStoredSession(access_token, refresh_token)
  if (!session?.user?.email) return

  const payload = { email: session.user.email }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.AUTH_SIGNED_IN, payload)
  }

  // Close the signin window (if it was the entry point) — routes through
  // the same closer used by the Cancel button for cleanup consistency.
  closeSigninWindow()

  // Pull credits meta immediately after login so the footer / settings
  // render with a real balance without waiting for the first capture.
  void refreshCreditsMeta()
}

async function handleCheckoutSuccess(): Promise<void> {
  // The Stripe webhook is what actually credits the user (writes
  // paid_credits_balance / subscription_status to profiles). By the time
  // the user clicks "Open SnapCue" on the success page, the webhook may
  // have already fired (Stripe → Railway, server-to-server, fast) — but
  // we don't *know* that, and racing it is fine: refreshCreditsMeta()
  // pulls /me which reflects whatever state Supabase has right now. If
  // the webhook hasn't landed yet, the user re-opens the dropdown a few
  // seconds later and setOnDropdownShow re-pulls.
  void refreshCreditsMeta()
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

  // Auto-update — production only. Defer 5s so the app finishes initializing
  // before we hit the network. checkForUpdatesAndNotify downloads new versions
  // in the background and shows a native notification when ready; the user
  // installs on next quit/relaunch. Errors are logged but never surfaced —
  // a transient network blip shouldn't pop a dialog at users.
  if (!is.dev) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('[SnapCue] Update check failed:', err?.message ?? err)
      })
    }, 5000)
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
