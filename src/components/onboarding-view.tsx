import { useState } from 'react'

type Page = 0 | 1 | 2

export function OnboardingView() {
  const [page, setPage] = useState<Page>(0)

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

      {/* Page content */}
      <div
        className="flex flex-1 flex-col items-center"
        key={page}
        style={{ padding: '0 28px 24px', animation: 'fadeIn 150ms ease' }}
      >
        {page === 0 && <WelcomePage onNext={() => setPage(1)} />}
        {page === 1 && <ShortcutsPage onBack={() => setPage(0)} onNext={() => setPage(2)} />}
        {page === 2 && <PermissionPage onBack={() => setPage(1)} />}
      </div>

      {/* Page indicator dots */}
      <PageDots current={page} />
    </div>
  )
}

// ── Page dots ────────────────────────────────────────────────────────────────

function PageDots({ current }: { current: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-[8px] pb-6">
      {[0, 1, 2].map((i) => (
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

// ── Page 1: Welcome ──────────────────────────────────────────────────────────

const ONB_ANIM = '6s cubic-bezier(0.4, 0, 0.2, 1) infinite'

function WelcomePage({ onNext }: { onNext: () => void }) {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <h1
          className="leading-none tracking-tight"
          style={{ fontSize: '20px', fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}
        >
          SnapCue
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.4)',
            marginTop: '6px',
          }}
        >
          screenshot any question. get the answer.
        </p>
      </div>

      {/* Animation area */}
      <div className="flex flex-1 items-center justify-center">
        <div style={{ position: 'relative', width: '320px', height: '140px' }}>
          {/* ── Mock window ──────────────────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              left: '20px',
              top: '20px',
              width: '130px',
              height: '88px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '18px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: `onb-window ${ONB_ANIM}`,
            }}
          >
            <div
              style={{
                height: '2px',
                width: '75%',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '1px',
              }}
            />
            <div
              style={{
                height: '2px',
                width: '90%',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '1px',
              }}
            />
            <div
              style={{
                height: '2px',
                width: '60%',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '1px',
              }}
            />
            <div
              style={{
                height: '2px',
                width: '40%',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '1px',
              }}
            />
          </div>

          {/* ── Selection box (phase 1) ──────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              left: '20px',
              top: '20px',
              width: '130px',
              height: '88px',
              border: '1.5px dashed rgba(255,255,255,0.3)',
              borderRadius: '6px',
              transformOrigin: '0 0',
              animation: `onb-selection ${ONB_ANIM}`,
            }}
          />

          {/* ── Particles (phase 2) ──────────────────────────────── */}
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                position: 'absolute',
                left: '155px',
                top: '62px',
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                background: '#fff',
                animation: `onb-particle-${n} ${ONB_ANIM}`,
              }}
            />
          ))}

          {/* ── Answer dropdown (phase 3) ─────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              right: '20px',
              top: '40px',
              width: '76px',
              height: '38px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              justifyContent: 'space-between',
              animation: `onb-dropdown ${ONB_ANIM}`,
            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#fff',
                fontFamily: 'monospace',
              }}
            >
              A
            </span>
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'rgba(34,197,94,0.8)',
              }}
            />
          </div>

          {/* ── Phase labels ──────────────────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              left: '22px',
              bottom: '0',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.25)',
            }}
          >
            <span style={{ position: 'absolute', animation: `onb-label-capture ${ONB_ANIM}` }}>
              capture
            </span>
            <span style={{ position: 'absolute', animation: `onb-label-analyze ${ONB_ANIM}` }}>
              analyze
            </span>
            <span style={{ position: 'absolute', animation: `onb-label-answer ${ONB_ANIM}` }}>
              answer
            </span>
          </div>
        </div>
      </div>

      {/* Button */}
      <div className="flex flex-col items-center">
        <OnboardingButton onClick={onNext} wide>
          Get Started
        </OnboardingButton>
      </div>
    </>
  )
}

// ── Page 2: Shortcuts ────────────────────────────────────────────────────────

function ShortcutsPage({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <>
      {/* Back + Title */}
      <BackButton onClick={onBack} />
      <h1
        className="tracking-tight"
        style={{ fontSize: '16px', fontWeight: 500, color: '#EDEDED', marginBottom: '20px' }}
      >
        {"two shortcuts. that's all."}
      </h1>

      {/* Two cards side by side */}
      <div className="flex w-full gap-[12px]">
        <ShortcutCard keys="⌃⌥S" title="silent capture" desc="grabs the front window quietly" />
        <ShortcutCard keys="⌃⌥A" title="area select" desc="drag to select any region" />
      </div>

      {/* Language note */}
      <div
        className="flex items-center gap-[6px]"
        style={{ fontSize: '12px', color: '#71717A', marginTop: '20px' }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.8 }}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
        <span>{'any language \u00b7 any subject'}</span>
      </div>

      {/* Spacer + Button */}
      <div className="mt-auto flex w-full flex-col items-center">
        <OnboardingButton onClick={onNext}>Continue</OnboardingButton>
      </div>
    </>
  )
}

function ShortcutCard({ keys, title, desc }: { keys: string; title: string; desc: string }) {
  return (
    <div
      className="flex flex-1 flex-col transition-colors"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px',
        padding: '16px',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >
      <div className="flex items-center gap-[10px]" style={{ marginBottom: '6px' }}>
        <span
          className="font-mono"
          style={{
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: '#EDEDED',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '4px',
            padding: '2px 6px',
          }}
        >
          {keys}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#EDEDED' }}>{title}</span>
      </div>
      <p style={{ fontSize: '11px', color: '#A1A1AA', lineHeight: 1.4 }}>{desc}</p>
    </div>
  )
}

// ── Page 3: Permission ───────────────────────────────────────────────────────
// Always show guidance — no detection. First-time users never have permission,
// and macOS 15 makes detection unreliable anyway. The dropdown's permission-guide
// handles the case where the user skips this step.

function PermissionPage({ onBack }: { onBack: () => void }) {
  return (
    <>
      <BackButton onClick={onBack} />
      <div className="flex flex-1 flex-col items-center justify-center">
        <h1
          className="tracking-tight"
          style={{ fontSize: '16px', fontWeight: 500, color: '#EDEDED', marginBottom: '24px' }}
        >
          screen recording permission
        </h1>

        {/* Shield icon */}
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="1.25"
          stroke="#FF5F57"
          style={{ marginBottom: '20px' }}
        >
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
        </svg>

        <p
          className="text-center"
          style={{
            fontSize: '12px',
            color: '#A1A1AA',
            lineHeight: 1.6,
            width: '280px',
            marginBottom: '20px',
          }}
        >
          SnapCue needs permission to record your screen to capture quiz questions
        </p>

        {/* Path hint */}
        <div
          className="font-mono"
          style={{
            fontSize: '11px',
            color: '#71717A',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            padding: '6px 12px',
          }}
        >
          {'System Settings \u2192 Privacy & Security \u2192 Screen Recording'}
        </div>
      </div>

      <div className="flex w-full flex-col items-center">
        <OnboardingButton onClick={() => window.snapcue.openPermissionSettings()}>
          Open System Settings
        </OnboardingButton>
        <button
          onClick={() => window.snapcue.completeOnboarding()}
          className="transition-colors duration-200"
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            marginTop: '10px',
            background: 'transparent',
            border: 'none',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
        >
          Continue
        </button>
      </div>
    </>
  )
}

// ── Shared components ────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
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

function OnboardingButton({
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
