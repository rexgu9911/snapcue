import { useEffect } from 'react'
import logoWhite from '../assets/logo-white.png'
import { SignInForm } from './signin-form'

export function SignInView() {
  // Belt-and-suspenders: main.ts's handleDeepLink closes this window directly
  // on successful deep-link sign-in, but if that ever fails to fire (future
  // refactor, IPC race) we close ourselves via auth:closeSignin too.
  useEffect(() => {
    return window.snapcue.onAuthSignedIn(() => {
      window.snapcue.closeSignin()
    })
  }, [])

  return (
    <div
      className="flex flex-col select-none"
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0A0A0A',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Title bar drag region */}
      <div
        className="shrink-0"
        style={{ height: '36px', WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Main content — vertically centered */}
      <div
        className="flex flex-1 flex-col items-center justify-center"
        style={{ padding: '0 28px', gap: '20px', minHeight: 0 }}
      >
        <img
          src={logoWhite}
          alt=""
          style={{ width: '56px', height: '56px', opacity: 0.9 }}
          draggable={false}
        />

        <div className="flex flex-col items-center text-center" style={{ gap: '6px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: '-0.01em',
            }}
          >
            Sign in to SnapCue
          </h2>
          <p
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.5,
            }}
          >
            We&apos;ll email you a 6-digit code. No password needed.
          </p>
        </div>

        <SignInForm />
      </div>

      {/* Cancel button — routes through auth:closeSignin so close path is unified */}
      <div className="shrink-0" style={{ padding: '0 28px 24px', textAlign: 'center' }}>
        <button
          onClick={() => window.snapcue.closeSignin()}
          className="transition-colors duration-200"
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.35)',
            background: 'transparent',
            border: 'none',
            padding: '6px 16px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
