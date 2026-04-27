/**
 * Shared sign-in CTA used wherever the user is unauthenticated and the next
 * action requires it. Two variants:
 *
 *   - "centered" (default) — IdleView's full-panel prompt. Auto-width button,
 *     centered column, slightly larger padding for breathing room.
 *   - "block" — ErrorPanel's auth_required path. Full-width button, no
 *     centering, tighter padding to match the other ErrorPanel branches.
 */

interface SignInPromptProps {
  title: string
  subtitle?: string
  variant?: 'centered' | 'block'
}

export function SignInPrompt({
  title,
  subtitle = '6-digit code · no password',
  variant = 'centered',
}: SignInPromptProps) {
  const isBlock = variant === 'block'

  return (
    <div
      className={isBlock ? 'flex flex-col' : 'flex flex-col items-center'}
      style={{ padding: isBlock ? '10px 12px' : '16px 12px' }}
    >
      <p
        style={{
          fontSize: '13px',
          fontWeight: isBlock ? 400 : 500,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: '4px',
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: isBlock ? '10px' : '11px',
          color: 'rgba(255,255,255,0.3)',
          marginBottom: '10px',
        }}
      >
        {subtitle}
      </p>
      <button
        onClick={() => window.snapcue.openSignin()}
        className={isBlock ? 'w-full transition-colors' : 'transition-colors'}
        style={{
          padding: isBlock ? '5px 0' : '4px 14px',
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
