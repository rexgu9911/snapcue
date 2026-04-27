/**
 * Shared bits used by every onboarding page: the back arrow that returns to
 * the prior page, and the primary CTA button. Kept in one file so the visual
 * vocabulary of onboarding pages stays consistent — change the button here
 * and every page picks it up.
 */

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-2 self-start transition-colors duration-150"
      style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
    >
      {'← back'}
    </button>
  )
}

export function OnboardingButton({
  onClick,
  children,
  wide,
}: {
  onClick: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="transition-colors duration-200"
      style={{
        width: wide ? '240px' : '220px',
        padding: '8px 24px',
        background: '#EDEDED',
        color: '#0A0A0A',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '10px',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#FFFFFF')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '#EDEDED')}
    >
      {children}
    </button>
  )
}
