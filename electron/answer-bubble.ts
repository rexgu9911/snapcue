import { app, BrowserWindow, ipcMain, screen, type Point, type Size } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  IPC,
  type AnswerBubbleLayoutPayload,
  type AnswerBubbleMovePayload,
  type AnswerItem,
} from '../shared/types'

const INITIAL_SIZE: Size = { width: 76, height: 34 }
const EDGE_PADDING = 10
const CURSOR_GAP = 14

let bubble: BrowserWindow | null = null
let currentSize: Size = INITIAL_SIZE
let ipcRegistered = false
let savePositionCallback: ((pos: Point) => void) | null = null

function clampPosition(x: number, y: number, width: number, height: number): Point {
  const display = screen.getDisplayNearestPoint({ x, y })
  const area = display.workArea
  return {
    x: Math.round(
      Math.max(area.x + EDGE_PADDING, Math.min(x, area.x + area.width - width - EDGE_PADDING)),
    ),
    y: Math.round(
      Math.max(area.y + EDGE_PADDING, Math.min(y, area.y + area.height - height - EDGE_PADDING)),
    ),
  }
}

function positionNear(anchor: Point, size: Size): Point {
  const display = screen.getDisplayNearestPoint(anchor)
  const area = display.workArea

  let x = anchor.x + CURSOR_GAP
  let y = anchor.y + CURSOR_GAP

  if (x + size.width > area.x + area.width - EDGE_PADDING) {
    x = anchor.x - size.width - CURSOR_GAP
  }
  if (y + size.height > area.y + area.height - EDGE_PADDING) {
    y = anchor.y - size.height - CURSOR_GAP
  }

  return clampPosition(x, y, size.width, size.height)
}

function resizeBubble(layout: AnswerBubbleLayoutPayload): void {
  if (!bubble || bubble.isDestroyed()) return

  const nextSize = {
    width: Math.max(54, Math.min(Math.ceil(layout.width), 320)),
    height: Math.max(30, Math.min(Math.ceil(layout.height), 480)),
  }

  // No-op when target matches current. The renderer's ResizeObserver may
  // re-fire several times during the same animation frame as content
  // settles, sending duplicate dimensions; without this guard each repeat
  // re-triggers a native window resize and ResizeObserver again, creating
  // a feedback loop the user perceives as the bubble flickering.
  if (currentSize.width === nextSize.width && currentSize.height === nextSize.height) {
    return
  }

  const bounds = bubble.getBounds()
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
  const nextPos = clampPosition(
    center.x - nextSize.width / 2,
    center.y - nextSize.height / 2,
    nextSize.width,
    nextSize.height,
  )

  currentSize = nextSize
  // Animate:false — macOS's native resize animation creates intermediate
  // frames that ResizeObserver in the renderer reads as "size changed",
  // each restarting the animation. Instant resize cuts that loop entirely.
  bubble.setBounds({ ...nextPos, ...nextSize }, false)
}

function moveBubbleBy(delta: AnswerBubbleMovePayload): void {
  if (!bubble || bubble.isDestroyed()) return

  const bounds = bubble.getBounds()
  const next = clampPosition(bounds.x + delta.dx, bounds.y + delta.dy, bounds.width, bounds.height)

  bubble.setPosition(next.x, next.y, false)
}

function ensureBubble(): BrowserWindow {
  if (bubble && !bubble.isDestroyed()) return bubble

  bubble = new BrowserWindow({
    width: INITIAL_SIZE.width,
    height: INITIAL_SIZE.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  bubble.on('closed', () => {
    bubble = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    bubble.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#answer-bubble`)
  } else {
    bubble.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'answer-bubble' })
  }

  return bubble
}

function sendWhenReady(win: BrowserWindow, send: () => void): void {
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => setTimeout(send, 25))
  } else {
    send()
  }
}

function compactAnswers(answers: AnswerItem[]): AnswerItem[] {
  return answers.slice(0, 8)
}

export function showAnswerBubbleLoading(anchor: Point, savedPosition: Point | null): void {
  const win = ensureBubble()
  currentSize = INITIAL_SIZE
  // When the user has dragged the capsule to a preferred spot, restore there
  // and clamp to current screen geometry (handles disconnected monitors).
  // Falls back to anchor-near positioning when there's no saved spot.
  const initialPos = savedPosition
    ? clampPosition(savedPosition.x, savedPosition.y, currentSize.width, currentSize.height)
    : positionNear(anchor, currentSize)
  win.setBounds({ ...initialPos, ...currentSize }, false)

  sendWhenReady(win, () => {
    if (win.isDestroyed()) return
    win.webContents.send(IPC.ANSWER_BUBBLE_SHOW, { state: 'loading' })
    win.showInactive()
  })
}

export function showAnswerBubbleResult(answers: AnswerItem[]): void {
  if (answers.length === 0) return

  const win = ensureBubble()
  sendWhenReady(win, () => {
    if (win.isDestroyed()) return
    win.webContents.send(IPC.ANSWER_BUBBLE_SHOW, {
      state: 'result',
      answers: compactAnswers(answers),
    })
    if (!win.isVisible()) win.showInactive()
  })
}

export function hideAnswerBubble(): void {
  if (!bubble || bubble.isDestroyed() || !bubble.isVisible()) return
  bubble.hide()
}

export function registerAnswerBubbleIpc(opts: { onSavePosition: (pos: Point) => void }): void {
  if (ipcRegistered) return
  ipcRegistered = true
  savePositionCallback = opts.onSavePosition

  ipcMain.on(IPC.ANSWER_BUBBLE_CLOSE, () => {
    hideAnswerBubble()
  })

  ipcMain.on(IPC.ANSWER_BUBBLE_SET_EXPANDED, () => {
    // No-op: kept for forward-compat with the renderer's existing call.
    // Auto-dismiss has been removed; expand/collapse is purely visual now.
  })

  ipcMain.on(IPC.ANSWER_BUBBLE_MOVE_BY, (_event, delta: AnswerBubbleMovePayload) => {
    moveBubbleBy(delta)
  })

  ipcMain.on(IPC.ANSWER_BUBBLE_SAVE_DRAGGED_POSITION, () => {
    if (!bubble || bubble.isDestroyed()) return
    if (!savePositionCallback) return
    const bounds = bubble.getBounds()
    savePositionCallback({ x: bounds.x, y: bounds.y })
  })

  ipcMain.on(IPC.ANSWER_BUBBLE_SET_LAYOUT, (_event, layout: AnswerBubbleLayoutPayload) => {
    resizeBubble(layout)
  })

  app.on('before-quit', () => {
    if (bubble && !bubble.isDestroyed()) {
      bubble.destroy()
    }
    bubble = null
  })
}
