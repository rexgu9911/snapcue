import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../../shared/types'

/** Map Electron modifier names to symbol + label pairs for key caps */
const MODIFIER_MAP: Record<string, { symbol: string; label: string }> = {
  Control: { symbol: '\u2303', label: 'ctrl' },
  Alt: { symbol: '\u2325', label: 'opt' },
  Shift: { symbol: '\u21E7', label: 'shift' },
  Command: { symbol: '\u2318', label: 'cmd' },
  Meta: { symbol: '\u2318', label: 'cmd' },
}

interface KeyPart {
  symbol: string
  label?: string // undefined for letter keys
}

/** Parse "Control+Alt+A" into [{symbol:"⌃",label:"ctrl"}, {symbol:"⌥",label:"opt"}, {symbol:"A"}] */
function parseAccelerator(accel: string): KeyPart[] {
  const parts = accel.split('+')
  return parts.map((part) => {
    const mod = MODIFIER_MAP[part]
    if (mod) return mod
    return { symbol: part }
  })
}

/** Format Electron accelerator for inline display: "Control+Alt+S" → "⌃⌥S" */
function formatShortcut(accel: string): string {
  return accel
    .replace(/Control\+/g, '\u2303')
    .replace(/Alt\+/g, '\u2325')
    .replace(/Shift\+/g, '\u21E7')
    .replace(/Command\+/g, '\u2318')
    .replace(/Meta\+/g, '\u2318')
}

function KeyCap({ part }: { part: KeyPart }) {
  const isModifier = !!part.label
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        width: isModifier ? '44px' : '28px',
        height: '24px',
        borderRadius: '5px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span
        style={{
          fontSize: isModifier ? '9px' : '11px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.35)',
          lineHeight: 1,
        }}
      >
        {part.symbol}
      </span>
      {part.label && (
        <span
          style={{
            fontSize: '7px',
            color: 'rgba(255,255,255,0.2)',
            lineHeight: 1,
            marginTop: '1px',
          }}
        >
          {part.label}
        </span>
      )}
    </div>
  )
}

interface IdleViewProps {
  user: AuthUser | null
  hasFirstCapture: boolean
}

export function IdleView({ user, hasFirstCapture }: IdleViewProps) {
  const [regionAccel, setRegionAccel] = useState(DEFAULT_SETTINGS.hotkeys.regionSelect)
  const [silentAccel, setSilentAccel] = useState(DEFAULT_SETTINGS.hotkeys.silentCapture)
  const [toggleAccel, setToggleAccel] = useState(DEFAULT_SETTINGS.hotkeys.toggleDropdown)

  useEffect(() => {
    window.snapcue.getSettings().then((s) => {
      setRegionAccel(s.hotkeys.regionSelect)
      setSilentAccel(s.hotkeys.silentCapture)
      setToggleAccel(s.hotkeys.toggleDropdown)
    })
  }, [])

  // Login is required to call /analyze. Before first capture we prompt sign-in
  // here instead of letting the user hit the shortcut and see an auth_required
  // paywall only after a failed attempt.
  if (!user) {
    return (
      <div className="flex flex-col items-center" style={{ padding: '16px 12px' }}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '4px',
          }}
        >
          Sign in to get started
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.3)',
            marginBottom: '10px',
          }}
        >
          6-digit code · no password
        </span>
        <button
          onClick={() => window.snapcue.openSignin()}
          className="transition-colors"
          style={{
            padding: '4px 14px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.7)',
            background: 'rgba(255,255,255,0.08)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        >
          Sign in
        </button>
      </div>
    )
  }

  const regionKeys = parseAccelerator(regionAccel)

  return (
    <div className="flex flex-col items-center" style={{ padding: '16px 12px' }}>
      {/* Top decoration: first-use shows a teaching header so the user knows
          what to do; returning users see decorative dots for breathing room.
          Both occupy roughly the same vertical space so the layout doesn't
          shift between the two states. */}
      {hasFirstCapture ? (
        <div className="flex" style={{ gap: '6px', marginBottom: '14px' }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>
      ) : (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.01em',
            marginBottom: '12px',
          }}
        >
          Try your first capture
        </span>
      )}

      {/* Main shortcut — key caps */}
      <div className="flex" style={{ gap: '3px' }}>
        {regionKeys.map((part, i) => (
          <KeyCap key={i} part={part} />
        ))}
      </div>
      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>
        area select
      </span>

      {/* Divider */}
      <div
        style={{
          width: '100%',
          height: '0.5px',
          background: 'rgba(255,255,255,0.04)',
          marginTop: '8px',
          marginBottom: '6px',
        }}
      />

      {/* Other shortcuts — compact text */}
      <div className="flex flex-col items-center" style={{ gap: '4px' }}>
        <span className="font-mono" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.18)' }}>
          {formatShortcut(silentAccel)} silent capture
        </span>
        <span className="font-mono" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.18)' }}>
          {formatShortcut(toggleAccel)} show / hide
        </span>
      </div>
    </div>
  )
}
