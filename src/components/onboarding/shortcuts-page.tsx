import { useEffect, useState } from 'react'
import { BackButton } from './shared'

const KEY_GAP = 4
const KEY_H = 42
const LETTER_W = 48

interface KeyDef {
  id: string
  width: number
  symbol?: string
  label: string
  shiftLayout?: boolean
}

const KEYBOARD_ROWS: KeyDef[][] = [
  [
    { id: 'tab', width: 64, label: 'tab' },
    { id: 'Q', width: LETTER_W, label: 'Q' },
    { id: 'W', width: LETTER_W, label: 'W' },
    { id: 'E', width: LETTER_W, label: 'E' },
  ],
  [
    { id: 'caps', width: 72, label: 'caps lock' },
    { id: 'A', width: LETTER_W, label: 'A' },
    { id: 'S', width: LETTER_W, label: 'S' },
    { id: 'D', width: LETTER_W, label: 'D' },
  ],
  [
    { id: 'shift', width: 88, label: 'shift', symbol: '⇧', shiftLayout: true },
    { id: 'Z', width: LETTER_W, label: 'Z' },
    { id: 'X', width: LETTER_W, label: 'X' },
  ],
  [
    { id: 'fn', width: 42, label: 'fn' },
    { id: 'control', width: 52, label: 'control', symbol: '⌃' },
    { id: 'option', width: 52, label: 'option', symbol: '⌥' },
    { id: 'command', width: 60, label: 'command', symbol: '⌘' },
  ],
]

const SHORTCUTS = [
  {
    title: 'area select',
    desc: 'drag to select any region',
    combo: '⌃  ⌥  A',
    keys: ['control', 'option', 'A'],
  },
  {
    title: 'silent capture',
    desc: 'captures your current window',
    combo: '⌃  ⌥  S',
    keys: ['control', 'option', 'S'],
  },
] as const

export function ShortcutsContent({ onBack }: { onBack: () => void }) {
  const [group, setGroup] = useState(0)
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  const [textVisible, setTextVisible] = useState(true)

  useEffect(() => {
    const CYCLE = 8000
    const HALF = CYCLE / 2

    let activeTimers: ReturnType<typeof setTimeout>[] = []

    function runHalf(g: number) {
      setGroup(g)
      setTextVisible(true)

      const keys = SHORTCUTS[g].keys
      activeTimers.push(
        setTimeout(() => setPressed(new Set([keys[0]])), 0),
        setTimeout(() => setPressed(new Set([keys[0], keys[1]])), 150),
        setTimeout(() => setPressed(new Set([keys[0], keys[1], keys[2]])), 300),
        setTimeout(() => setPressed(new Set()), 2000),
        setTimeout(() => setTextVisible(false), 3400),
      )
    }

    function startCycle() {
      activeTimers.forEach(clearTimeout)
      activeTimers = []
      runHalf(0)
      activeTimers.push(setTimeout(() => runHalf(1), HALF))
    }

    startCycle()
    const interval = setInterval(startCycle, CYCLE)

    return () => {
      clearInterval(interval)
      activeTimers.forEach(clearTimeout)
    }
  }, [])

  const current = SHORTCUTS[group]

  return (
    <>
      <BackButton onClick={onBack} />

      {/* Main content — left text + right keyboard */}
      <div
        className="flex flex-1 items-center justify-center"
        style={{ gap: '36px', padding: '0 4px', minHeight: 0 }}
      >
        {/* Left: shortcut combo + title + description */}
        <div
          style={{
            flexShrink: 0,
            width: '150px',
            opacity: textVisible ? 1 : 0,
            transition: 'opacity 200ms ease',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.7)',
              marginBottom: '8px',
            }}
          >
            {current.combo}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            {current.title}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>
            {current.desc}
          </div>
        </div>

        {/* Right: keyboard visualization */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${KEY_GAP}px`,
            transform: 'scale(0.88)',
            transformOrigin: 'center center',
          }}
        >
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: `${KEY_GAP}px` }}>
              {row.map((key) => {
                const isPressed = pressed.has(key.id)
                const isModifier = key.symbol && !key.shiftLayout
                return (
                  <div
                    key={key.id}
                    style={{
                      width: `${key.width}px`,
                      height: `${KEY_H}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: key.shiftLayout ? 'flex-start' : 'center',
                      flexDirection: isModifier ? 'column' : 'row',
                      gap: isModifier ? '2px' : key.shiftLayout ? '4px' : undefined,
                      paddingLeft: key.shiftLayout ? '10px' : undefined,
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      background: isPressed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                      borderTop: isPressed
                        ? '1px solid rgba(255,255,255,0.4)'
                        : '1px solid rgba(255,255,255,0.08)',
                      borderLeft: `1px solid ${isPressed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      borderRight: `1px solid ${isPressed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      borderBottom: `1px solid ${isPressed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.03)'}`,
                      boxShadow: isPressed ? 'none' : '0 1px 2px rgba(0,0,0,0.3)',
                      color: isPressed ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
                      transform: isPressed ? 'scale(0.92)' : 'scale(1)',
                      transition: 'all 150ms ease-out',
                    }}
                  >
                    {isModifier && (
                      <>
                        <span style={{ fontSize: '12px', lineHeight: 1 }}>{key.symbol}</span>
                        <span
                          style={{
                            fontSize: key.id === 'command' ? '8px' : '9px',
                            lineHeight: 1,
                          }}
                        >
                          {key.label}
                        </span>
                      </>
                    )}
                    {key.shiftLayout && (
                      <>
                        <span style={{ fontSize: '12px', lineHeight: 1 }}>{key.symbol}</span>
                        <span style={{ fontSize: '10px', lineHeight: 1 }}>{key.label}</span>
                      </>
                    )}
                    {!key.symbol && (
                      <span style={{ fontSize: key.id.length === 1 ? '14px' : '10px' }}>
                        {key.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
