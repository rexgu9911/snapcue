import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let onboardingWindow: BrowserWindow | null = null

const WINDOW_WIDTH = 640
const WINDOW_HEIGHT = 420

export function createOnboardingWindow(): BrowserWindow {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: Math.round((screenW - WINDOW_WIDTH) / 2),
    y: Math.round((screenH - WINDOW_HEIGHT) / 2),
    titleBarStyle: 'hiddenInset',
    resizable: false,
    minimizable: false,
    maximizable: false,
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#onboarding')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'onboarding' })
  }

  win.on('closed', () => {
    onboardingWindow = null
    // Re-hide dock after onboarding window closes
    if (app.dock) app.dock.hide()
  })

  onboardingWindow = win
  return win
}

export function closeOnboardingWindow(): void {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.close()
  }
  onboardingWindow = null
}
