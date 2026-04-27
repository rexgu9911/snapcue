export function PermissionGuide() {
  const handleOpenSettings = (): void => {
    window.snapcue.openPermissionSettings()
  }

  const handleRelaunch = (): void => {
    window.snapcue.relaunch()
  }

  return (
    <div style={{ padding: '10px 12px' }}>
      {/* Header — small warning icon + concise title */}
      <div className="flex items-center" style={{ gap: '6px', marginBottom: '4px' }}>
        <div
          className="flex items-center justify-center"
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: 'rgba(251,146,60,0.18)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              color: 'rgba(251,146,60,0.95)',
              lineHeight: 1,
            }}
          >
            !
          </span>
        </div>
        <p style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>
          Permission needed
        </p>
      </div>

      <p
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.5,
          marginBottom: '10px',
        }}
      >
        Toggle SnapCue on in System Settings, then restart so macOS picks it up.
      </p>

      {/* Primary: open settings (Neutral button per design system) */}
      <button
        onClick={handleOpenSettings}
        className="w-full transition-colors"
        style={{
          padding: '5px 0',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.7)',
          background: 'rgba(255,255,255,0.08)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      >
        Open System Settings
      </button>

      {/* Secondary: restart (Subtle button — used after returning from Settings) */}
      <button
        onClick={handleRelaunch}
        className="w-full transition-colors"
        style={{
          marginTop: '4px',
          padding: '4px 0',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.5)',
          background: 'rgba(255,255,255,0.06)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      >
        Restart SnapCue
      </button>
    </div>
  )
}
