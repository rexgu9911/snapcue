import { app, BrowserWindow, Tray, nativeImage, screen, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC, type MainToRendererEvents } from '../shared/types'

let tray: Tray | null = null
let dropdown: BrowserWindow | null = null
let lastHideTime = 0

const DROPDOWN_WIDTH = 280
const DROPDOWN_MIN_HEIGHT = 48
const DROPDOWN_MAX_HEIGHT = 400

function createTrayIcon(): Tray {
  const iconPath = join(__dirname, '../../resources/iconTemplate.png')
  const icon = nativeImage.createFromPath(iconPath)
  icon.setTemplateImage(true)

  const newTray = new Tray(icon)
  newTray.setToolTip('SnapCue')

  newTray.on('click', () => {
    if (!dropdown) return

    // Prevent re-show when the click that caused blur also triggers tray click
    if (Date.now() - lastHideTime < 300) return

    if (dropdown.isVisible()) {
      hideDropdown()
    } else {
      showDropdown()
    }
  })

  return newTray
}

function createDropdown(): BrowserWindow {
  const win = new BrowserWindow({
    width: DROPDOWN_WIDTH,
    height: DROPDOWN_MIN_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  // Dismiss on focus loss (click-outside + app deactivation)
  win.on('blur', () => {
    hideDropdown()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function showDropdown(): void {
  if (!dropdown || !tray) return

  const trayBounds = tray.getBounds()
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  })

  // Center horizontally under the tray icon
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - DROPDOWN_WIDTH / 2)
  // Position just below the menu bar
  const y = Math.round(trayBounds.y + trayBounds.height)

  // Clamp to screen bounds
  const clampedX = Math.max(
    display.workArea.x,
    Math.min(x, display.workArea.x + display.workArea.width - DROPDOWN_WIDTH),
  )

  dropdown.setPosition(clampedX, y)
  dropdown.show()
}

function hideDropdown(): void {
  if (!dropdown || !dropdown.isVisible()) return
  lastHideTime = Date.now()
  dropdown.hide()
}

function resizeDropdown(contentHeight: number): void {
  if (!dropdown) return
  const clamped = Math.max(
    DROPDOWN_MIN_HEIGHT,
    Math.min(Math.ceil(contentHeight), DROPDOWN_MAX_HEIGHT),
  )
  const [width] = dropdown.getSize()
  dropdown.setSize(width, clamped)
}

/** Send a typed event to the dropdown renderer and show it. */
export function sendToDropdown<C extends keyof MainToRendererEvents>(
  channel: C,
  ...args: MainToRendererEvents[C] extends void ? [] : [MainToRendererEvents[C]]
): void {
  if (!dropdown) return
  dropdown.webContents.send(channel, ...args)
  showDropdown()
}

export function initTray(): void {
  tray = createTrayIcon()
  dropdown = createDropdown()

  // Renderer → Main (fire-and-forget)
  ipcMain.on(IPC.DROPDOWN_HIDE, () => {
    hideDropdown()
  })

  ipcMain.on(IPC.DROPDOWN_RESIZE, (_event, height: number) => {
    resizeDropdown(height)
  })

  // Cleanup
  app.on('before-quit', () => {
    tray?.destroy()
    tray = null
    dropdown?.destroy()
    dropdown = null
  })
}
