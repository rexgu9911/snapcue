import logoWhite from '../../assets/logo-white.png'

const ONB_ANIM = '6s cubic-bezier(0.4, 0, 0.2, 1) infinite'

export function WelcomeContent() {
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
