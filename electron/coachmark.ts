import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getTrayBounds } from './tray'

let coachmarkWindow: BrowserWindow | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null

const COACHMARK_WIDTH = 260
const COACHMARK_HEIGHT = 110
const AUTO_DISMISS_MS = 6_000
const TOP_GAP = 6
const EDGE_PADDING = 8

/**
 * Show a small floating coachmark just below the tray icon, pointing at it.
 * Used right after onboarding completes so the user discovers where SnapCue
 * lives. Auto-dismisses after 6s, or earlier when the user clicks it or the
 * tray icon. Replay-safe: a second call replaces the in-flight coachmark.
 */
export function showMenuBarCoachmark(): void {
  hideMenuBarCoachmark()

  const trayBounds = getTrayBounds()
  if (!trayBounds) return

  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })

  const trayCenterX = trayBounds.x + trayBounds.width / 2
  const idealX = Math.round(trayCenterX - COACHMARK_WIDTH / 2)
  const minX = display.workArea.x + EDGE_PADDING
  const maxX = display.workArea.x + display.workArea.width - COACHMARK_WIDTH - EDGE_PADDING
  const x = Math.max(minX, Math.min(idealX, maxX))
  const y = Math.round(trayBounds.y + trayBounds.height + TOP_GAP)

  // Where the tail should point, relative to the coachmark's left edge.
  // Even if we clamped x, the tail still aims at the real tray icon.
  const tailOffset = Math.max(12, Math.min(COACHMARK_WIDTH - 12, trayCenterX - x))

  const win = new BrowserWindow({
    width: COACHMARK_WIDTH,
    height: COACHMARK_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  // Float above other always-on-top windows so it isn't hidden by the dropdown
  // (dropdown also uses alwaysOnTop with the default 'floating' level).
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const params = new URLSearchParams({ tailOffset: String(Math.round(tailOffset)) }).toString()

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${params}#coachmark`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'coachmark',
      search: `?${params}`,
    })
  }

  win.once('ready-to-show', () => {
    win.showInactive()
  })

  win.on('closed', () => {
    if (coachmarkWindow === win) coachmarkWindow = null
  })

  coachmarkWindow = win

  dismissTimer = setTimeout(() => {
    hideMenuBarCoachmark()
  }, AUTO_DISMISS_MS)
}

export function hideMenuBarCoachmark(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  if (coachmarkWindow && !coachmarkWindow.isDestroyed()) {
    coachmarkWindow.close()
  }
  coachmarkWindow = null
}

export function isCoachmarkOpen(): boolean {
  return coachmarkWindow !== null && !coachmarkWindow.isDestroyed()
}

app.on('before-quit', () => {
  hideMenuBarCoachmark()
})
