interface FooterBarProps {
  onOpenSettings: () => void
  user: AuthUser | null
}

export function FooterBar({ onOpenSettings, user }: FooterBarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-between"
      style={{
        padding: '4px 10px',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left side reserved for future credits display */}
      <span />

      {/* Right side: Settings + Avatar + Quit */}
      <div className="flex items-center" style={{ gap: '8px' }}>
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-center"
          style={{ width: '16px', height: '16px' }}
          aria-label="Settings"
          onMouseEnter={(e) => {
            const svg = e.currentTarget.querySelector('svg')
            if (svg) svg.style.color = 'rgba(255,255,255,0.5)'
          }}
          onMouseLeave={(e) => {
            const svg = e.currentTarget.querySelector('svg')
            if (svg) svg.style.color = 'rgba(255,255,255,0.25)'
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 20 20"
            fill="none"
            style={{ color: 'rgba(255,255,255,0.25)', transition: 'color 0.15s' }}
          >
            <path
              d="M8.5 2.5a1.5 1.5 0 0 1 3 0v.3a1.2 1.2 0 0 0 .8 1.13 1.2 1.2 0 0 0 1.36-.27l.21-.21a1.5 1.5 0 1 1 2.12 2.12l-.21.21a1.2 1.2 0 0 0-.27 1.36 1.2 1.2 0 0 0 1.13.8h.3a1.5 1.5 0 0 1 0 3h-.3a1.2 1.2 0 0 0-1.13.8 1.2 1.2 0 0 0 .27 1.36l.21.21a1.5 1.5 0 1 1-2.12 2.12l-.21-.21a1.2 1.2 0 0 0-1.36-.27 1.2 1.2 0 0 0-.8 1.13v.3a1.5 1.5 0 0 1-3 0v-.3a1.2 1.2 0 0 0-.8-1.13 1.2 1.2 0 0 0-1.36.27l-.21.21a1.5 1.5 0 1 1-2.12-2.12l.21-.21a1.2 1.2 0 0 0 .27-1.36 1.2 1.2 0 0 0-1.13-.8h-.3a1.5 1.5 0 0 1 0-3h.3a1.2 1.2 0 0 0 1.13-.8 1.2 1.2 0 0 0-.27-1.36l-.21-.21a1.5 1.5 0 1 1 2.12-2.12l.21.21a1.2 1.2 0 0 0 1.36.27 1.2 1.2 0 0 0 .8-1.13V2.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        {user && (
          <div
            title={user.email}
            className="flex items-center justify-center"
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              fontSize: '10px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.55)',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {user.email.charAt(0)}
          </div>
        )}

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
