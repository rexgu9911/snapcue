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
const AUTO_DISMISS_MS = 45_000

let bubble: BrowserWindow | null = null
let currentSize: Size = INITIAL_SIZE
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let ipcRegistered = false

function clearDismissTimer(): void {
  if (!dismissTimer) return
  clearTimeout(dismissTimer)
  dismissTimer = null
}

function scheduleDismiss(): void {
  clearDismissTimer()
  dismissTimer = setTimeout(() => {
    hideAnswerBubble()
  }, AUTO_DISMISS_MS)
}

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
    width: Math.max(54, Math.min(Math.ceil(layout.width), 280)),
    height: Math.max(30, Math.min(Math.ceil(layout.height), 190)),
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
  bubble.setBounds({ ...nextPos, ...nextSize }, true)
}

function moveBubbleBy(delta: AnswerBubbleMovePayload): void {
  if (!bubble || bubble.isDestroyed()) return

  const bounds = bubble.getBounds()
  const next = clampPosition(
    bounds.x + delta.dx,
    bounds.y + delta.dy,
    bounds.width,
    bounds.height,
  )

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

export function showAnswerBubbleLoading(anchor: Point): void {
  const win = ensureBubble()
  currentSize = INITIAL_SIZE
  win.setBounds({ ...positionNear(anchor, currentSize), ...currentSize }, false)

  sendWhenReady(win, () => {
    if (win.isDestroyed()) return
    win.webContents.send(IPC.ANSWER_BUBBLE_SHOW, { state: 'loading' })
    win.showInactive()
    scheduleDismiss()
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
    scheduleDismiss()
  })
}

export function hideAnswerBubble(): void {
  clearDismissTimer()
  if (!bubble || bubble.isDestroyed() || !bubble.isVisible()) return
  bubble.hide()
}

export function registerAnswerBubbleIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  ipcMain.on(IPC.ANSWER_BUBBLE_CLOSE, () => {
    hideAnswerBubble()
  })

  ipcMain.on(IPC.ANSWER_BUBBLE_SET_EXPANDED, () => {
    scheduleDismiss()
  })

  ipcMain.on(IPC.ANSWER_BUBBLE_MOVE_BY, (_event, delta: AnswerBubbleMovePayload) => {
    moveBubbleBy(delta)
    scheduleDismiss()
  })

  ipcMain.on(IPC.ANSWER_BUBBLE_SET_LAYOUT, (_event, layout: AnswerBubbleLayoutPayload) => {
    resizeBubble(layout)
    scheduleDismiss()
  })

  app.on('before-quit', () => {
    clearDismissTimer()
    if (bubble && !bubble.isDestroyed()) {
      bubble.destroy()
    }
    bubble = null
  })
}
