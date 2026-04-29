import logoWhite from '../../assets/logo-white.png'

export function AppHereContent() {
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
        style={{ gap: '8px', maxWidth: '420px', marginTop: '24px' }}
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
          Press <KeyChip>{'⌃'}</KeyChip> <KeyChip>{'⌥'}</KeyChip> <KeyChip>A</KeyChip> to
          drag-select any question. The answer pops up next to your cursor — and in the dropdown
          above.
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
