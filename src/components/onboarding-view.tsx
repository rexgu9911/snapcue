import { useEffect, useState } from 'react'
import logoWhite from '../assets/logo-white.png'
import { SignInForm } from './signin-form'

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

// ── Page 1: Welcome ──────────────────────────────────────────────────────────
// (Note: pages are 0-indexed in code; the section headers count from 1 for
// human readability — page 0 = the first page, "Page 1: Welcome".)

const ONB_ANIM = '6s cubic-bezier(0.4, 0, 0.2, 1) infinite'

function WelcomeContent() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <img
          src={logoWhite}
          alt=""
          style={{ width: '56px', height: '56px', marginBottom: '8px', opacity: 0.9 }}
          draggable={false}
        />
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
          Welcome. Let&apos;s get you set up.
        </p>
      </div>

      {/* Animation area — centered in remaining space */}
      <div className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
        <div
          style={{
            position: 'relative',
            width: '290px',
            height: '140px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Flex row — vertical center alignment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '46px' }}>
            {/* ── Window wrapper (relative for selection box) ──── */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {/* Mock window */}
              <div
                style={{
                  width: '140px',
                  height: '100px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  animation: `onb-window ${ONB_ANIM}`,
                }}
              >
                {/* Question group 1 — stem 75% */}
                <div>
                  <div
                    style={{
                      height: '2px',
                      width: '75%',
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: '1px',
                      marginBottom: '8px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6%' }}>
                    <div
                      style={{
                        height: '2px',
                        width: '32%',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '1px',
                      }}
                    />
                    <div
                      style={{
                        height: '2px',
                        width: '32%',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '1px',
                      }}
                    />
                  </div>
                </div>
                {/* Question group 2 — stem 65% */}
                <div>
                  <div
                    style={{
                      height: '2px',
                      width: '65%',
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: '1px',
                      marginBottom: '8px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6%' }}>
                    <div
                      style={{
                        height: '2px',
                        width: '32%',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '1px',
                      }}
                    />
                    <div
                      style={{
                        height: '2px',
                        width: '32%',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '1px',
                      }}
                    />
                  </div>
                </div>
                {/* Question group 3 — stem 70% */}
                <div>
                  <div
                    style={{
                      height: '2px',
                      width: '70%',
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: '1px',
                      marginBottom: '8px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6%' }}>
                    <div
                      style={{
                        height: '2px',
                        width: '32%',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '1px',
                      }}
                    />
                    <div
                      style={{
                        height: '2px',
                        width: '32%',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '1px',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Selection box overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  border: '1.5px dashed rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  transformOrigin: '0 0',
                  animation: `onb-selection ${ONB_ANIM}`,
                }}
              />
            </div>

            {/* ── Answer card — 3 rows ───────────────────────────── */}
            <div
              style={{
                width: '84px',
                flexShrink: 0,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '6px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                opacity: 0,
                visibility: 'hidden' as const,
                animation: `onb-dropdown ${ONB_ANIM}`,
              }}
            >
              {(
                [
                  { n: '1', letter: 'A' },
                  { n: '2', letter: 'C' },
                  { n: '3', letter: 'B' },
                ] as const
              ).map((row) => (
                <div
                  key={row.n}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 0',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: 'rgba(255,255,255,0.3)',
                      width: '12px',
                    }}
                  >
                    {row.n}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      color: 'rgba(255,255,255,0.95)',
                      width: '16px',
                    }}
                  >
                    {row.letter}
                  </span>
                  <div
                    style={{
                      marginLeft: 'auto',
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: 'rgba(34,197,94,0.8)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Particles (absolute, between window and card) ──── */}
          {(
            [
              { id: 1, size: 2 },
              { id: 2, size: 3 },
              { id: 3, size: 2 },
            ] as const
          ).map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: '150px',
                top: `${70 - p.size / 2}px`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 0 4px rgba(255,255,255,0.3)',
                animation: `onb-particle-${p.id} ${ONB_ANIM}`,
              }}
            />
          ))}

          {/* ── Phase labels ──────────────────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              left: '12px',
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
    </>
  )
}

// ── Page 2: Permission ───────────────────────────────────────────────────────
// Always show guidance — no detection. First-time users never have permission,
// and macOS 15 makes detection unreliable anyway. The dropdown's permission-guide
// handles the case where the user skips this step.

function PermissionContent({ onBack }: { onBack: () => void }) {
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
                        {'\u2192'}
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

// ── Page 3: Sign In ──────────────────────────────────────────────────────────

function SignInContent({ onBack }: { onBack: () => void }) {
  return (
    <>
      <BackButton onClick={onBack} />

      <div
        className="flex flex-1 flex-col items-center justify-center"
        style={{ gap: '16px', maxWidth: '320px', minHeight: 0 }}
      >
        <div className="flex flex-col items-center text-center" style={{ gap: '6px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: '-0.01em',
            }}
          >
            Sign in to sync credits across devices
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
    </>
  )
}

// ── Page 4: Shortcuts (animated keyboard) ───────────────────────────────────

const KEY_GAP = 4
const KEY_H = 42
const LETTER_W = 48

interface KeyDef {
  id: string
  width: number
  symbol?: string
  label: string
  shiftLayout?: boolean
}

const KEYBOARD_ROWS: KeyDef[][] = [
  [
    { id: 'tab', width: 64, label: 'tab' },
    { id: 'Q', width: LETTER_W, label: 'Q' },
    { id: 'W', width: LETTER_W, label: 'W' },
    { id: 'E', width: LETTER_W, label: 'E' },
  ],
  [
    { id: 'caps', width: 72, label: 'caps lock' },
    { id: 'A', width: LETTER_W, label: 'A' },
    { id: 'S', width: LETTER_W, label: 'S' },
    { id: 'D', width: LETTER_W, label: 'D' },
  ],
  [
    { id: 'shift', width: 88, label: 'shift', symbol: '⇧', shiftLayout: true },
    { id: 'Z', width: LETTER_W, label: 'Z' },
    { id: 'X', width: LETTER_W, label: 'X' },
  ],
  [
    { id: 'fn', width: 42, label: 'fn' },
    { id: 'control', width: 52, label: 'control', symbol: '⌃' },
    { id: 'option', width: 52, label: 'option', symbol: '⌥' },
    { id: 'command', width: 60, label: 'command', symbol: '⌘' },
  ],
]

const SHORTCUTS = [
  {
    title: 'area select',
    desc: 'drag to select any region',
    combo: '⌃  ⌥  A',
    keys: ['control', 'option', 'A'],
  },
  {
    title: 'silent capture',
    desc: 'captures your current window',
    combo: '⌃  ⌥  S',
    keys: ['control', 'option', 'S'],
  },
] as const

function ShortcutsContent({ onBack }: { onBack: () => void }) {
  const [group, setGroup] = useState(0)
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  const [textVisible, setTextVisible] = useState(true)

  useEffect(() => {
    const CYCLE = 8000
    const HALF = CYCLE / 2

    let activeTimers: ReturnType<typeof setTimeout>[] = []

    function runHalf(g: number) {
      setGroup(g)
      setTextVisible(true)

      const keys = SHORTCUTS[g].keys
      activeTimers.push(
        setTimeout(() => setPressed(new Set([keys[0]])), 0),
        setTimeout(() => setPressed(new Set([keys[0], keys[1]])), 150),
        setTimeout(() => setPressed(new Set([keys[0], keys[1], keys[2]])), 300),
        setTimeout(() => setPressed(new Set()), 2000),
        setTimeout(() => setTextVisible(false), 3400),
      )
    }

    function startCycle() {
      activeTimers.forEach(clearTimeout)
      activeTimers = []
      runHalf(0)
      activeTimers.push(setTimeout(() => runHalf(1), HALF))
    }

    startCycle()
    const interval = setInterval(startCycle, CYCLE)

    return () => {
      clearInterval(interval)
      activeTimers.forEach(clearTimeout)
    }
  }, [])

  const current = SHORTCUTS[group]

  return (
    <>
      <BackButton onClick={onBack} />

      {/* Main content — left text + right keyboard */}
      <div
        className="flex flex-1 items-center justify-center"
        style={{ gap: '36px', padding: '0 4px', minHeight: 0 }}
      >
        {/* Left: shortcut combo + title + description */}
        <div
          style={{
            flexShrink: 0,
            width: '150px',
            opacity: textVisible ? 1 : 0,
            transition: 'opacity 200ms ease',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.7)',
              marginBottom: '8px',
            }}
          >
            {current.combo}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            {current.title}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>
            {current.desc}
          </div>
        </div>

        {/* Right: keyboard visualization */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${KEY_GAP}px`,
            transform: 'scale(0.88)',
            transformOrigin: 'center center',
          }}
        >
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: `${KEY_GAP}px` }}>
              {row.map((key) => {
                const isPressed = pressed.has(key.id)
                const isModifier = key.symbol && !key.shiftLayout
                return (
                  <div
                    key={key.id}
                    style={{
                      width: `${key.width}px`,
                      height: `${KEY_H}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: key.shiftLayout ? 'flex-start' : 'center',
                      flexDirection: isModifier ? 'column' : 'row',
                      gap: isModifier ? '2px' : key.shiftLayout ? '4px' : undefined,
                      paddingLeft: key.shiftLayout ? '10px' : undefined,
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      background: isPressed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                      borderTop: isPressed
                        ? '1px solid rgba(255,255,255,0.4)'
                        : '1px solid rgba(255,255,255,0.08)',
                      borderLeft: `1px solid ${isPressed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      borderRight: `1px solid ${isPressed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      borderBottom: `1px solid ${isPressed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.03)'}`,
                      boxShadow: isPressed ? 'none' : '0 1px 2px rgba(0,0,0,0.3)',
                      color: isPressed ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
                      transform: isPressed ? 'scale(0.92)' : 'scale(1)',
                      transition: 'all 150ms ease-out',
                    }}
                  >
                    {isModifier && (
                      <>
                        <span style={{ fontSize: '12px', lineHeight: 1 }}>{key.symbol}</span>
                        <span
                          style={{
                            fontSize: key.id === 'command' ? '8px' : '9px',
                            lineHeight: 1,
                          }}
                        >
                          {key.label}
                        </span>
                      </>
                    )}
                    {key.shiftLayout && (
                      <>
                        <span style={{ fontSize: '12px', lineHeight: 1 }}>{key.symbol}</span>
                        <span style={{ fontSize: '10px', lineHeight: 1 }}>{key.label}</span>
                      </>
                    )}
                    {!key.symbol && (
                      <span style={{ fontSize: key.id.length === 1 ? '14px' : '10px' }}>
                        {key.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Page 5: How to use (final, after Try it now → close + tray pulse) ───────

function AppHereContent() {
  return (
    <div
      className="flex flex-1 flex-col items-center"
      style={{ minHeight: 0, gap: '20px', justifyContent: 'center' }}
    >
      {/* Title */}
      <h2
        style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.95)',
          letterSpacing: '-0.01em',
        }}
      >
        You&apos;re all set
      </h2>

      {/* macOS menu bar mock — right edge with status icons + ghost + clock */}
      <div
        style={{
          width: '440px',
          height: '30px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 14px',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        {/* Mock system icons (battery / wifi / control center) */}
        {[10, 13, 12].map((w, i) => (
          <div
            key={i}
            style={{
              width: `${w}px`,
              height: '12px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.18)',
            }}
          />
        ))}

        {/* SnapCue ghost icon — highlighted with glow + arrow below */}
        <div
          style={{
            position: 'relative',
            width: '22px',
            height: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={logoWhite}
            alt=""
            style={{
              width: '20px',
              height: '20px',
              animation: 'app-here-glow 1.8s ease-in-out infinite',
            }}
            draggable={false}
          />
          {/* Arrow pointing up at the ghost from below the menu bar */}
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: '50%',
              animation: 'app-here-arrow 1.4s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          >
            <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
              <path
                d="M7 16 L7 3 M7 3 L3 7 M7 3 L11 7"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Clock */}
        <span
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            marginLeft: '4px',
          }}
        >
          Sat 12:34
        </span>
      </div>

      {/* Body copy */}
      <div
        className="flex flex-col items-center text-center"
        style={{ gap: '8px', maxWidth: '380px', marginTop: '24px' }}
      >
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          SnapCue lives in your menu bar.
        </p>
        <p
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.6,
          }}
        >
          Open any question, press <KeyChip>{'⌃'}</KeyChip> <KeyChip>{'⌥'}</KeyChip>{' '}
          <KeyChip>A</KeyChip> to drag-select, and the answer appears in the dropdown.
        </p>
      </div>
    </div>
  )
}

function KeyChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0 5px',
        borderRadius: '3px',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.15)',
        fontFamily: 'monospace',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      {children}
    </span>
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
