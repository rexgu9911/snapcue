import { useEffect, useState } from 'react'
import logoWhite from '../assets/logo-white.png'

interface SettingsViewProps {
  onBack: () => void
  user: AuthUser | null
  meta: CreditsMeta | null
}

type RecordingField = 'silentCapture' | 'regionSelect' | 'toggleDropdown' | null

/** Map Electron modifier names → mac symbols for keycap rendering. */
const MOD_SYMBOL: Record<string, string> = {
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Command: '⌘',
  Meta: '⌘',
}

/** Parse "Control+Alt+S" → ["⌃", "⌥", "S"] for individual keycap rendering. */
function acceleratorSymbols(accel: string): string[] {
  if (!accel) return []
  return accel.split('+').map((part) => MOD_SYMBOL[part] ?? part)
}

/** Convert a KeyboardEvent into an Electron accelerator string */
function eventToAccelerator(e: KeyboardEvent): string | null {
  // Ignore lone modifier presses
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Command')

  // Must have at least one modifier
  if (parts.length === 0) return null

  // Use e.code instead of e.key to get the physical key.
  // On macOS, Alt/Option modifies e.key (e.g., Alt+S → "Å") but e.code stays "KeyS".
  let key: string
  if (e.code.startsWith('Key')) {
    key = e.code.slice(3) // "KeyS" → "S"
  } else if (e.code.startsWith('Digit')) {
    key = e.code.slice(5) // "Digit1" → "1"
  } else if (e.code === 'Space') {
    key = 'Space'
  } else if (e.code.startsWith('Arrow')) {
    key = e.code.slice(5) // "ArrowUp" → "Up"
  } else {
    // Fallback: use e.key for special keys (F1-F12, Tab, etc.)
    key = e.key
  }

  parts.push(key)
  return parts.join('+')
}

const ICON_OPTIONS: TrayIcon[] = ['ghost', 'dot', 'book', 'bolt', 'square', 'input', 'shield', 'cn']

export function SettingsView({ onBack, user, meta }: SettingsViewProps) {
  const [hotkeys, setHotkeys] = useState({
    silentCapture: '',
    regionSelect: '',
    toggleDropdown: '',
  })
  const [trayIcon, setTrayIcon] = useState<TrayIcon>('dot')
  const [answerPeek, setAnswerPeek] = useState<AppSettings['answerPeek']>({
    enabled: true,
    autoCopy: false,
  })
  const [recording, setRecording] = useState<RecordingField>(null)
  const [conflict, setConflict] = useState<RecordingField>(null)
  const [saved, setSaved] = useState<RecordingField>(null)

  // Load settings on mount
  useEffect(() => {
    window.snapcue.getSettings().then((s) => {
      setHotkeys(s.hotkeys)
      setTrayIcon(s.trayIcon)
      setAnswerPeek(s.answerPeek)
    })
  }, [])

  // Shortcut recording listener
  useEffect(() => {
    if (!recording) return

    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Escape cancels recording
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }

      const accel = eventToAccelerator(e)
      if (!accel) return

      // Conflict check: see if any other field has the same shortcut
      const otherFields = (['silentCapture', 'regionSelect', 'toggleDropdown'] as const).filter(
        (f) => f !== recording,
      )
      if (otherFields.some((f) => hotkeys[f] === accel)) {
        setConflict(recording)
        setTimeout(() => setConflict(null), 600)
        setRecording(null)
        return
      }

      // Save
      const field = recording
      const newHotkeys = { ...hotkeys, [field]: accel }
      setHotkeys(newHotkeys)
      window.snapcue.setSettings({ hotkeys: newHotkeys })
      setRecording(null)
      setSaved(field)
      setTimeout(() => setSaved(null), 800)
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [recording, hotkeys])

  const handleIconChange = (icon: TrayIcon) => {
    setTrayIcon(icon)
    window.snapcue.setSettings({ trayIcon: icon })
  }

  const handleAnswerPeekChange = (partial: Partial<AppSettings['answerPeek']>) => {
    const next = { ...answerPeek, ...partial }
    setAnswerPeek(next)
    window.snapcue.setSettings({ answerPeek: next })
  }

  return (
    <div style={{ position: 'relative', maxHeight: '400px' }}>
      <div
        className="flex flex-col"
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          paddingBottom: '10px',
        }}
      >
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center self-start"
        style={{ padding: '6px 10px 4px', gap: '3px' }}
        onMouseEnter={(e) => {
          e.currentTarget.querySelectorAll('svg, span').forEach((el) => {
            ;(el as HTMLElement).style.color = 'rgba(255,255,255,0.7)'
          })
        }}
        onMouseLeave={(e) => {
          e.currentTarget.querySelectorAll('svg, span').forEach((el) => {
            ;(el as HTMLElement).style.color = 'rgba(255,255,255,0.4)'
          })
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          style={{ color: 'rgba(255,255,255,0.4)', transition: 'color 0.15s' }}
        >
          <path
            d="M7.5 2L3.5 6L7.5 10"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', transition: 'color 0.15s' }}
        >
          back
        </span>
      </button>

      {/* Account section */}
      <AccountSection user={user} meta={meta} />

      {/* Shortcuts section */}
      <div style={{ padding: '4px 10px 4px' }}>
        <div
          className="flex items-baseline justify-between"
          style={{
            marginTop: '8px',
            marginBottom: '6px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              letterSpacing: '0.5px',
              color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase' as const,
            }}
          >
            Shortcuts
          </span>
          <span
            style={{
              fontSize: '9px',
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.02em',
            }}
          >
            click to change
          </span>
        </div>
        <ShortcutRow
          label="Silent capture"
          value={hotkeys.silentCapture}
          isRecording={recording === 'silentCapture'}
          isConflict={conflict === 'silentCapture'}
          isSaved={saved === 'silentCapture'}
          onStartRecording={() => setRecording('silentCapture')}
        />
        <ShortcutRow
          label="Area select"
          value={hotkeys.regionSelect}
          isRecording={recording === 'regionSelect'}
          isConflict={conflict === 'regionSelect'}
          isSaved={saved === 'regionSelect'}
          onStartRecording={() => setRecording('regionSelect')}
        />
        <ShortcutRow
          label="Toggle answers"
          value={hotkeys.toggleDropdown}
          isRecording={recording === 'toggleDropdown'}
          isConflict={conflict === 'toggleDropdown'}
          isSaved={saved === 'toggleDropdown'}
          onStartRecording={() => setRecording('toggleDropdown')}
        />
      </div>

      {/* Peek section */}
      <div style={{ padding: '4px 10px 4px' }}>
        <div
          style={{
            fontSize: '11px',
            letterSpacing: '0.5px',
            color: 'rgba(255,255,255,0.3)',
            marginTop: '8px',
            marginBottom: '6px',
            textTransform: 'uppercase' as const,
          }}
        >
          Peek
        </div>
        <ToggleRow
          label="Quick Peek"
          checked={answerPeek.enabled}
          onChange={(enabled) => handleAnswerPeekChange({ enabled })}
        />
      </div>

      {/* Icon section */}
      <div style={{ padding: '4px 10px 6px' }}>
        <div
          style={{
            fontSize: '11px',
            letterSpacing: '0.5px',
            color: 'rgba(255,255,255,0.3)',
            marginTop: '8px',
            marginBottom: '6px',
            textTransform: 'uppercase' as const,
          }}
        >
          Icon
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '4px',
          }}
        >
          {ICON_OPTIONS.map((icon) => {
            const isSelected = trayIcon === icon
            return (
              <button
                key={icon}
                onClick={() => handleIconChange(icon)}
                className="flex items-center justify-center"
                style={{
                  height: '30px',
                  borderRadius: '6px',
                  background: isSelected ? 'rgba(255,255,255,0.10)' : 'transparent',
                  border: isSelected
                    ? '0.5px solid rgba(255,255,255,0.14)'
                    : '0.5px solid transparent',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                <IconPreview icon={icon} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer: version + quit */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '4px 10px',
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
        }}
      >
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>v0.1.0</span>
        <button
          onClick={() => window.snapcue.quit()}
          style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
        >
          Quit
        </button>
      </div>
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '22px',
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(30,30,30,0), rgba(30,30,30,0.92) 82%)',
        }}
      />
    </div>
  )
}

function AccountSection({ user, meta }: { user: AuthUser | null; meta: CreditsMeta | null }) {
  return (
    <div style={{ padding: '4px 10px 4px' }}>
      <div
        style={{
          fontSize: '11px',
          letterSpacing: '0.5px',
          color: 'rgba(255,255,255,0.3)',
          marginTop: '8px',
          marginBottom: '4px',
          textTransform: 'uppercase' as const,
        }}
      >
        Account
      </div>

      {user ? (
        <>
          <div
            className="flex items-center justify-between"
            style={{ padding: '3px 0', gap: '8px' }}
          >
            <div
              title={user.email}
              className="flex items-center justify-center"
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: '0.5px solid rgba(255,255,255,0.06)',
                fontSize: '11px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                lineHeight: 1,
                cursor: 'default',
                flexShrink: 0,
              }}
            >
              {user.email.charAt(0)}
            </div>
            <button
              onClick={() => window.snapcue.signOut()}
              style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
            >
              Sign out
            </button>
          </div>
          <PlanDetails meta={meta} />
        </>
      ) : (
        <div className="flex items-center justify-between" style={{ padding: '3px 0' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Not signed in</span>
          <button
            onClick={() => window.snapcue.openSignin()}
            className="transition-colors"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(255,255,255,0.08)',
              padding: '2px 10px',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            Sign in
          </button>
        </div>
      )}
    </div>
  )
}

function PlanDetails({ meta }: { meta: CreditsMeta | null }) {
  const [error, setError] = useState<string | null>(null)

  if (!meta) return null

  const hasActiveSubscription =
    meta.subscription_status === 'active' &&
    meta.subscription_expires_at !== null &&
    new Date(meta.subscription_expires_at).getTime() > Date.now()

  async function handleManageSubscription() {
    setError(null)
    const result = await window.snapcue.openBillingPortal()
    if (!result.ok) setError(result.error)
  }

  function handleGetMoreCredits() {
    setError(null)
    void window.snapcue.openPricing()
  }

  if (hasActiveSubscription) {
    const planLabel = meta.subscription_type === 'weekly' ? 'Weekly' : 'Monthly'
    const dateLabel = new Date(meta.subscription_expires_at!).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    // After a billing-portal cancel the subscription is still 'active' until
    // the period ends — but the user has explicitly opted out. Showing
    // "Renews May 26" here would be misleading; "Cancels May 26" matches
    // their intent.
    const dateRowLabel = meta.subscription_cancel_at_period_end ? 'Cancels' : 'Renews'
    return (
      <>
        <InfoRow label="Plan" value={planLabel} />
        <InfoRow label={dateRowLabel} value={dateLabel} />
        <ManageLink label="Manage subscription" onClick={handleManageSubscription} />
        {error && <ErrorRow message={error} />}
      </>
    )
  }

  const credits = Math.max(0, meta.credits_remaining)
  return (
    <>
      <InfoRow label="Plan" value="Free" />
      <InfoRow label="Credits" value={`${credits}`} />
      <ManageLink label="Get more credits" onClick={handleGetMoreCredits} />
    </>
  )
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'right', paddingTop: '2px' }}>
      <span style={{ fontSize: '10px', color: 'rgba(248,113,113,0.85)' }}>{message}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '3px 0' }}>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <span className="font-mono" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
        {value}
      </span>
    </div>
  )
}

function ManageLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div style={{ textAlign: 'right', paddingTop: '2px' }}>
      <button
        onClick={onClick}
        className="transition-colors"
        style={{
          fontSize: '10px',
          fontWeight: 500,
          color: 'rgba(16,185,129,0.75)',
          background: 'transparent',
          padding: '2px 0',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(16,185,129,1)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(16,185,129,0.75)')}
      >
        {label} →
      </button>
    </div>
  )
}

type CapState = 'idle' | 'hover' | 'conflict' | 'saved'

function MiniKeyCap({ symbol, state }: { symbol: string; state: CapState }) {
  const bg = {
    idle: 'rgba(255,255,255,0.06)',
    hover: 'rgba(255,255,255,0.11)',
    conflict: 'rgba(239,68,68,0.22)',
    saved: 'rgba(34,197,94,0.20)',
  }[state]

  const borderTop = {
    idle: 'rgba(255,255,255,0.14)',
    hover: 'rgba(255,255,255,0.20)',
    conflict: 'rgba(239,68,68,0.35)',
    saved: 'rgba(34,197,94,0.30)',
  }[state]

  const border = {
    idle: 'rgba(255,255,255,0.08)',
    hover: 'rgba(255,255,255,0.14)',
    conflict: 'rgba(239,68,68,0.30)',
    saved: 'rgba(34,197,94,0.26)',
  }[state]

  return (
    <span
      className="font-mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '20px',
        padding: '0 4px',
        borderRadius: '4px',
        background: bg,
        border: `0.5px solid ${border}`,
        borderTop: `0.5px solid ${borderTop}`,
        fontSize: '11px',
        fontWeight: 500,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 1,
        transition: 'background 0.18s, border-color 0.18s',
      }}
    >
      {symbol}
    </span>
  )
}

function ShortcutRow({
  label,
  value,
  isRecording,
  isConflict,
  isSaved,
  onStartRecording,
}: {
  label: string
  value: string
  isRecording: boolean
  isConflict: boolean
  isSaved: boolean
  onStartRecording: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const capState: CapState = isConflict
    ? 'conflict'
    : isSaved
      ? 'saved'
      : hovered && !isRecording
        ? 'hover'
        : 'idle'

  const symbols = acceleratorSymbols(value)

  return (
    <div>
      <div className="flex items-center justify-between" style={{ padding: '3px 0' }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <button
          onClick={onStartRecording}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-label={`Change ${label} shortcut`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 0',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {isRecording ? (
            <span
              className="font-mono"
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.55)',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.06)',
                animation: 'blink 1s ease-in-out infinite',
              }}
            >
              press keys...
            </span>
          ) : (
            symbols.map((sym, i) => <MiniKeyCap key={i} symbol={sym} state={capState} />)
          )}
        </button>
      </div>
      {isConflict && (
        <p style={{ fontSize: '10px', color: 'rgba(239,68,68,0.8)', padding: '1px 0 2px' }}>
          already in use
        </p>
      )}
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '4px 0' }}>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        aria-label={`${checked ? 'Disable' : 'Enable'} ${label}`}
        style={{
          width: '30px',
          height: '18px',
          borderRadius: '999px',
          background: checked ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.10)',
          border: checked
            ? '0.5px solid rgba(16,185,129,0.45)'
            : '0.5px solid rgba(255,255,255,0.08)',
          padding: '2px',
          transition: 'background 140ms ease, border-color 140ms ease',
        }}
      >
        <span
          style={{
            display: 'block',
            width: '13px',
            height: '13px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.9)',
            transform: checked ? 'translateX(12px)' : 'translateX(0)',
            transition: 'transform 140ms ease',
          }}
        />
      </button>
    </div>
  )
}

function IconPreview({ icon }: { icon: TrayIcon }) {
  const color = 'rgba(255,255,255,0.5)'

  switch (icon) {
    case 'dot':
      return (
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: color,
            display: 'block',
          }}
        />
      )
    case 'book':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color }}>
          <path
            d="M3.5 3C3.5 3 5.5 2 8 3V13C5.5 12 3.5 13 3.5 13V3Z"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          <path
            d="M12.5 3C12.5 3 10.5 2 8 3V13C10.5 12 12.5 13 12.5 13V3Z"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'bolt':
      return (
        <svg width="12" height="14" viewBox="0 0 12 16" fill="none" style={{ color }}>
          <path d="M7 2L2.5 9H5.5L5 14L9.5 7H6.5L7 2Z" fill="currentColor" />
        </svg>
      )
    case 'square':
      return (
        <span
          style={{
            width: '9px',
            height: '9px',
            borderRadius: '2px',
            border: `1.3px solid ${color}`,
            display: 'block',
          }}
        />
      )
    case 'input':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color }}>
          <rect
            x="2.5"
            y="2.5"
            width="11"
            height="11"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <text
            x="8"
            y="11.5"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize="8"
            fontWeight="600"
            fill="currentColor"
          >
            A
          </text>
        </svg>
      )
    case 'shield':
      return (
        <svg width="12" height="14" viewBox="0 0 12 16" fill="none" style={{ color }}>
          <path
            d="M6 2C4 3.5 2 3.5 2 3.5C2 3.5 2 9 6 14C10 9 10 3.5 10 3.5C10 3.5 8 3.5 6 2Z"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'cn':
      return (
        <span
          style={{
            fontSize: '12px',
            fontFamily: '"PingFang SC", "SF Pro SC", sans-serif',
            fontWeight: 500,
            color,
            lineHeight: 1,
          }}
        >
          中
        </span>
      )
    case 'ghost':
      return (
        <img
          src={logoWhite}
          alt=""
          style={{ width: '16px', height: '16px', opacity: 0.5 }}
          draggable={false}
        />
      )
  }
}
