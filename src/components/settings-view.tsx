import { useEffect, useState } from 'react'

interface SettingsViewProps {
  onBack: () => void
}

type RecordingField = 'silentCapture' | 'regionSelect' | null

/** Format Electron accelerator string for display: Control+Alt+S → ⌃⌥S */
function formatShortcut(accel: string): string {
  return accel
    .replace(/Control\+/g, '⌃')
    .replace(/Alt\+/g, '⌥')
    .replace(/Shift\+/g, '⇧')
    .replace(/Command\+/g, '⌘')
    .replace(/Meta\+/g, '⌘')
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

const ICON_OPTIONS: TrayIcon[] = ['dot', 'book', 'bolt', 'square']

export function SettingsView({ onBack }: SettingsViewProps) {
  const [hotkeys, setHotkeys] = useState({ silentCapture: '', regionSelect: '' })
  const [trayIcon, setTrayIcon] = useState<TrayIcon>('dot')
  const [recording, setRecording] = useState<RecordingField>(null)
  const [conflict, setConflict] = useState<RecordingField>(null)
  const [saved, setSaved] = useState<RecordingField>(null)

  // Load settings on mount
  useEffect(() => {
    window.snapcue.getSettings().then((s) => {
      setHotkeys(s.hotkeys)
      setTrayIcon(s.trayIcon)
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

      // Conflict check: see if the other field has the same shortcut
      const otherField = recording === 'silentCapture' ? 'regionSelect' : 'silentCapture'
      if (hotkeys[otherField] === accel) {
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

  return (
    <div className="flex flex-col">
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

      {/* Shortcuts section */}
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
          Shortcuts
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
      </div>

      {/* Icon section */}
      <div style={{ padding: '4px 10px 6px' }}>
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
          Icon
        </div>
        <div className="flex" style={{ gap: '4px' }}>
          {ICON_OPTIONS.map((icon) => (
            <button
              key={icon}
              onClick={() => handleIconChange(icon)}
              className="flex items-center justify-center"
              style={{
                width: '32px',
                height: '26px',
                borderRadius: '5px',
                background: trayIcon === icon ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              <IconPreview icon={icon} />
            </button>
          ))}
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
  const pillBg = isConflict
    ? 'rgba(239,68,68,0.3)'
    : isSaved
      ? 'rgba(34,197,94,0.2)'
      : 'rgba(255,255,255,0.06)'

  return (
    <div>
      <div className="flex items-center justify-between" style={{ padding: '3px 0' }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <button
          onClick={onStartRecording}
          className="font-mono"
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.4)',
            background: pillBg,
            padding: '2px 8px',
            borderRadius: '4px',
            transition: 'background 0.2s',
            animation: isRecording ? 'blink 1s ease-in-out infinite' : 'none',
          }}
        >
          {isRecording ? 'press keys...' : formatShortcut(value)}
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
  }
}
