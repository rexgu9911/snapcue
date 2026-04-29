interface FooterBarProps {
  onOpenSettings: () => void
  user: AuthUser | null
  meta: CreditsMeta | null
  /**
   * True before the user's first successful capture. Surfaces the Settings
   * button with a visible "Settings" label + brighter gear so first-time
   * users can find it; returning users see a minimal icon-only gear.
   */
  firstUse?: boolean
}

export function FooterBar({ onOpenSettings, user, meta, firstUse = false }: FooterBarProps) {
  const gearIdleAlpha = firstUse ? 0.5 : 0.25
  const gearHoverAlpha = firstUse ? 0.75 : 0.5
  const gearIdleColor = `rgba(255,255,255,${gearIdleAlpha})`
  const gearHoverColor = `rgba(255,255,255,${gearHoverAlpha})`

  return (
    <div
      className="flex shrink-0 items-center justify-between"
      style={{
        padding: '4px 10px',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left: credits display (pure derive from meta prop) */}
      <CreditsLabel meta={meta} />

      {/* Right side: Settings + Avatar + Quit */}
      <div className="flex items-center" style={{ gap: '8px' }}>
        <button
          onClick={onOpenSettings}
          className="flex items-center"
          style={{ gap: '4px' }}
          aria-label="Settings"
          onMouseEnter={(e) => {
            const svg = e.currentTarget.querySelector('svg')
            if (svg) svg.style.color = gearHoverColor
            const span = e.currentTarget.querySelector('span')
            if (span) span.style.color = gearHoverColor
          }}
          onMouseLeave={(e) => {
            const svg = e.currentTarget.querySelector('svg')
            if (svg) svg.style.color = gearIdleColor
            const span = e.currentTarget.querySelector('span')
            if (span) span.style.color = gearIdleColor
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 20 20"
            fill="none"
            style={{ color: gearIdleColor, transition: 'color 0.15s' }}
          >
            <path
              d="M8.5 2.5a1.5 1.5 0 0 1 3 0v.3a1.2 1.2 0 0 0 .8 1.13 1.2 1.2 0 0 0 1.36-.27l.21-.21a1.5 1.5 0 1 1 2.12 2.12l-.21.21a1.2 1.2 0 0 0-.27 1.36 1.2 1.2 0 0 0 1.13.8h.3a1.5 1.5 0 0 1 0 3h-.3a1.2 1.2 0 0 0-1.13.8 1.2 1.2 0 0 0 .27 1.36l.21.21a1.5 1.5 0 1 1-2.12 2.12l-.21-.21a1.2 1.2 0 0 0-1.36-.27 1.2 1.2 0 0 0-.8 1.13v.3a1.5 1.5 0 0 1-3 0v-.3a1.2 1.2 0 0 0-.8-1.13 1.2 1.2 0 0 0-1.36.27l-.21.21a1.5 1.5 0 1 1-2.12-2.12l.21-.21a1.2 1.2 0 0 0 .27-1.36 1.2 1.2 0 0 0-1.13-.8h-.3a1.5 1.5 0 0 1 0-3h.3a1.2 1.2 0 0 0 1.13-.8 1.2 1.2 0 0 0-.27-1.36l-.21-.21a1.5 1.5 0 1 1 2.12-2.12l.21.21a1.2 1.2 0 0 0 1.36.27 1.2 1.2 0 0 0 .8-1.13V2.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {firstUse && (
            <span
              style={{
                fontSize: '11px',
                color: gearIdleColor,
                transition: 'color 0.15s',
                lineHeight: 1,
              }}
            >
              Settings
            </span>
          )}
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

function CreditsLabel({ meta }: { meta: CreditsMeta | null }) {
  if (!meta) return <span />

  const hasActiveSubscription =
    meta.subscription_status === 'active' &&
    meta.subscription_expires_at !== null &&
    new Date(meta.subscription_expires_at).getTime() > Date.now()

  if (hasActiveSubscription) {
    return (
      <span
        style={{
          fontSize: '11px',
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.25)',
        }}
      >
        unlimited
      </span>
    )
  }

  const n = Math.max(0, meta.credits_remaining)

  return (
    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
      {n} credit{n === 1 ? '' : 's'}
    </span>
  )
}
