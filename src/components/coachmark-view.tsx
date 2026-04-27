import { useEffect, useState } from 'react'

const BOX_WIDTH = 224
const TAIL_HEIGHT = 8
const TAIL_HALF_WIDTH = 7

/**
 * Floating callout shown directly under the tray icon right after onboarding,
 * so the user discovers where SnapCue lives. Lives in its own borderless,
 * transparent BrowserWindow positioned by main; this component just renders
 * the visible box + tail and handles dismiss-on-click.
 */
export function CoachmarkView({ tailOffset }: { tailOffset: number }) {
  const [visible, setVisible] = useState(false)

  // Defer the slide-in until after first paint so the animation actually plays.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function dismiss(): void {
    setVisible(false)
    // Wait for the fade-out to finish before asking main to close the window.
    setTimeout(() => window.snapcue.dismissCoachmark(), 160)
  }

  // Center the box horizontally on the tail (which itself points at the tray).
  // Edge-clamping is handled by main; renderer just trusts the offset.
  const boxLeft = Math.max(8, Math.min(tailOffset - BOX_WIDTH / 2, window.innerWidth - BOX_WIDTH - 8))

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        margin: 0,
        padding: 0,
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'opacity 200ms ease, transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1)',
        WebkitFontSmoothing: 'antialiased',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Tail — small triangle pointing up at the tray icon */}
      <svg
        width={TAIL_HALF_WIDTH * 2}
        height={TAIL_HEIGHT}
        viewBox={`0 0 ${TAIL_HALF_WIDTH * 2} ${TAIL_HEIGHT}`}
        style={{
          position: 'absolute',
          top: 0,
          left: tailOffset - TAIL_HALF_WIDTH,
          display: 'block',
        }}
      >
        <path
          d={`M${TAIL_HALF_WIDTH} 0 L0 ${TAIL_HEIGHT} L${TAIL_HALF_WIDTH * 2} ${TAIL_HEIGHT} Z`}
          fill="rgba(28,28,28,0.96)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />
      </svg>

      {/* Box */}
      <div
        style={{
          position: 'absolute',
          top: TAIL_HEIGHT,
          left: boxLeft,
          width: `${BOX_WIDTH}px`,
          background: 'rgba(28,28,28,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '10px',
          border: '0.5px solid rgba(255,255,255,0.08)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.25)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Up-arrow icon as visual reinforcement */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{ flexShrink: 0, opacity: 0.85 }}
        >
          <path
            d="M7 12 L7 2 M7 2 L3 6 M7 2 L11 6"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: '-0.005em',
              lineHeight: 1.25,
            }}
          >
            SnapCue lives here
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.3,
            }}
          >
            Click the icon to see your answers
          </div>
        </div>
      </div>
    </div>
  )
}
