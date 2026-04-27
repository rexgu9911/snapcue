import { useEffect, useState } from 'react'
import { OnboardingButton } from './onboarding/shared'
import { WelcomeContent } from './onboarding/welcome-page'
import { PermissionContent } from './onboarding/permission-page'
import { SignInContent } from './onboarding/signin-page'
import { ShortcutsContent } from './onboarding/shortcuts-page'
import { AppHereContent } from './onboarding/app-here-page'

type Page = 0 | 1 | 2 | 3 | 4

export function OnboardingView() {
  const [page, setPage] = useState<Page>(0)

  // After sign-in finalizes (deep-link or in-page OTP), advance to the
  // Shortcuts teaching page so the user gets the natural learning sequence
  // (signed in → learn shortcut → see menu-bar location → try it). Without
  // this, sign-in would just close the window and the user wouldn't know
  // where SnapCue lives or how to use it.
  useEffect(() => {
    return window.snapcue.onAuthSignedIn(() => {
      setPage(3)
    })
  }, [])

  async function finishOnboarding(): Promise<void> {
    // Pulse the tray icon so the user sees where SnapCue lives the moment
    // the window closes. Fire-and-forget — pulse runs in the main process
    // and continues regardless of the renderer's lifecycle.
    void window.snapcue.pulseTrayIcon()
    await window.snapcue.completeOnboarding()
  }

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
        style={{ height: '44px', WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Page content — fills available space */}
      <div
        className="flex flex-1 flex-col items-center"
        key={page}
        style={{ padding: '0 28px', animation: 'fadeIn 150ms ease', minHeight: 0 }}
      >
        {page === 0 && <WelcomeContent />}
        {page === 1 && <PermissionContent onBack={() => setPage(0)} />}
        {page === 2 && <SignInContent onBack={() => setPage(1)} />}
        {page === 3 && <ShortcutsContent onBack={() => setPage(2)} />}
        {page === 4 && <AppHereContent />}
      </div>

      {/* Fixed bottom: button + dots — same position on all pages */}
      <div className="flex shrink-0 flex-col items-center" style={{ padding: '0 28px 8px' }}>
        {page === 0 && (
          <OnboardingButton onClick={() => setPage(1)} wide>
            Get Started
          </OnboardingButton>
        )}
        {page === 1 && (
          <button
            onClick={() => setPage(2)}
            className="transition-colors duration-200"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.5)',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              padding: '6px 24px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
            }}
          >
            Continue →
          </button>
        )}
        {page === 2 && (
          <button
            onClick={() => setPage(3)}
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
            Skip for now
          </button>
        )}
        {page === 3 && (
          <>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginBottom: '12px' }}>
              change shortcuts in settings
            </p>
            <OnboardingButton onClick={() => setPage(4)}>Continue</OnboardingButton>
          </>
        )}
        {page === 4 && (
          <OnboardingButton onClick={() => void finishOnboarding()} wide>
            Try it now
          </OnboardingButton>
        )}
        <PageDots current={page} />
      </div>
    </div>
  )
}

// ── Page dots ────────────────────────────────────────────────────────────────

function PageDots({ current }: { current: number }) {
  return (
    <div
      className="flex items-center justify-center gap-[8px]"
      style={{ paddingTop: '14px', paddingBottom: '10px' }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-full transition-colors duration-300"
          style={{
            width: '6px',
            height: '6px',
            background: i === current ? '#EDEDED' : 'rgba(255,255,255,0.15)',
            boxShadow: i === current ? '0 0 8px rgba(255,255,255,0.3)' : 'none',
          }}
        />
      ))}
    </div>
  )
}
