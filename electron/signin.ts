import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let signinWindow: BrowserWindow | null = null

const WINDOW_WIDTH = 440
const WINDOW_HEIGHT = 420

export function createSigninWindow(): BrowserWindow {
  // If already open, just focus it rather than spawning a duplicate.
  if (signinWindow && !signinWindow.isDestroyed()) {
    signinWindow.focus()
    return signinWindow
  }

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
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#signin')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'signin' })
  }

  // Show dock so the user can cmd+tab back to this window after checking
  // their email client. Hidden again in the 'closed' handler.
  if (app.dock) app.dock.show()

  win.on('closed', () => {
    signinWindow = null
    if (app.dock) app.dock.hide()
  })

  signinWindow = win
  return win
}

export function isSigninOpen(): boolean {
  return signinWindow !== null && !signinWindow.isDestroyed()
}

export function closeSigninWindow(): void {
  if (signinWindow && !signinWindow.isDestroyed()) {
    signinWindow.close()
  }
  signinWindow = null
}
