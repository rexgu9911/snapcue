export function LoadingView() {
  return (
    <div className="flex flex-col items-center" style={{ padding: '24px 14px' }}>
      {/* Pulsing dots */}
      <div className="flex" style={{ gap: '6px', marginBottom: '10px' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: 'white',
              animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>analyzing</span>
    </div>
  )
}
