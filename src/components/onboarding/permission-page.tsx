import { useEffect, useState } from 'react'
import { BackButton } from './shared'

// Always show guidance — no detection. First-time users never have permission,
// and macOS 15 makes detection unreliable anyway. The dropdown's permission-guide
// handles the case where the user skips this step.

export function PermissionContent({ onBack }: { onBack: () => void }) {
  const [rowHighlight, setRowHighlight] = useState(false)
  const [toggled, setToggled] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setRowHighlight(true), 800)
    const t2 = setTimeout(() => setToggled(true), 1200)
    const t3 = setTimeout(() => setRowHighlight(false), 1800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  const APPS = [
    { name: 'Chrome', iconOpacity: 0.08 },
    { name: 'Zoom', iconOpacity: 0.1 },
    { name: 'SnapCue', iconOpacity: 0.15, highlight: true },
    { name: 'Discord', iconOpacity: 0.08 },
  ]

  return (
    <>
      <BackButton onClick={onBack} />

      {/* Main content — left text + right mockup */}
      <div
        className="flex flex-1 items-center justify-center"
        style={{ gap: '36px', padding: '0 12px', minHeight: 0 }}
      >
        {/* Left: text + button */}
        <div style={{ flexShrink: 0, maxWidth: '180px' }}>
          {/* Shield icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: '12px' }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            One More Thing
          </div>
          <p
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1.5,
              marginTop: '6px',
            }}
          >
            SnapCue needs screen recording access to capture. Click below to open settings and
            toggle it on.
          </p>
          <button
            onClick={() => window.snapcue.openPermissionSettings()}
            className="transition-colors duration-200"
            style={{
              marginTop: '16px',
              padding: '8px 20px',
              background: '#EDEDED',
              color: '#0A0A0A',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#FFFFFF')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#EDEDED')}
          >
            Open System Settings
          </button>
          <p
            style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.2)',
              fontStyle: 'italic',
              marginTop: '8px',
            }}
          >
            Restart SnapCue after granting
          </p>
        </div>

        {/* Right: System Settings mockup */}
        <div
          style={{
            width: '280px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.6)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            Screen Recording
          </div>
          {/* App list */}
          <div style={{ padding: '4px 0' }}>
            {APPS.map((app, i) => {
              const isSnapCue = app.highlight === true
              const isOn = isSnapCue && toggled
              const isHighlighted = isSnapCue && rowHighlight
              return (
                <div key={app.name}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '32px',
                      padding: '0 12px',
                      background: isHighlighted ? 'rgba(255,255,255,0.04)' : 'transparent',
                      transition: isSnapCue ? 'background 400ms ease' : undefined,
                    }}
                  >
                    {isSnapCue ? (
                      <span
                        style={{
                          fontSize: '6px',
                          color: 'rgba(255,255,255,0.3)',
                          marginRight: '4px',
                          flexShrink: 0,
                        }}
                      >
                        {'→'}
                      </span>
                    ) : (
                      <span style={{ width: '10px', flexShrink: 0 }} />
                    )}
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '3px',
                        background: `rgba(255,255,255,${app.iconOpacity})`,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '12px',
                        color: isSnapCue ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)',
                        fontWeight: isSnapCue ? 500 : 400,
                        marginLeft: '8px',
                        flex: 1,
                      }}
                    >
                      {app.name}
                    </span>
                    <div
                      style={{
                        width: '20px',
                        height: '12px',
                        borderRadius: '6px',
                        background: isOn ? 'rgba(34,197,94,0.8)' : 'rgba(255,255,255,0.1)',
                        position: 'relative',
                        transition: 'background 300ms ease',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: '2px',
                          left: isOn ? '10px' : '2px',
                          transition: 'left 300ms ease',
                        }}
                      />
                    </div>
                  </div>
                  {i < APPS.length - 1 && (
                    <div
                      style={{
                        height: '0.5px',
                        background: 'rgba(255,255,255,0.06)',
                        marginLeft: '32px',
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
