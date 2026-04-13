import { useEffect, useState } from 'react'

function formatShortcut(accel: string): string {
  return accel
    .replace(/Control\+/g, '⌃')
    .replace(/Alt\+/g, '⌥')
    .replace(/Shift\+/g, '⇧')
    .replace(/Command\+/g, '⌘')
    .replace(/Meta\+/g, '⌘')
}

export function IdleView() {
  const [silent, setSilent] = useState('⌃⌥S')
  const [region, setRegion] = useState('⌃⌥A')

  useEffect(() => {
    window.snapcue.getSettings().then((s) => {
      setSilent(formatShortcut(s.hotkeys.silentCapture))
      setRegion(formatShortcut(s.hotkeys.regionSelect))
    })
  }, [])

  return (
    <div className="flex flex-col items-center" style={{ padding: '20px 14px' }}>
      {/* Decorative dots */}
      <div className="flex" style={{ gap: '6px', marginBottom: '14px' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>

      {/* Shortcut hints */}
      <div className="flex flex-col items-center" style={{ gap: '4px' }}>
        <span className="font-mono" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
          {silent} silent
        </span>
        <span className="font-mono" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
          {region} select
        </span>
      </div>
    </div>
  )
}
