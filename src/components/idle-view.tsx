import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../../shared/types'

function formatShortcut(accel: string): string {
  return accel
    .replace(/Control\+/g, '⌃')
    .replace(/Alt\+/g, '⌥')
    .replace(/Shift\+/g, '⇧')
    .replace(/Command\+/g, '⌘')
    .replace(/Meta\+/g, '⌘')
}

export function IdleView({ hasFirstCapture }: { hasFirstCapture: boolean }) {
  const [silent, setSilent] = useState(() => formatShortcut(DEFAULT_SETTINGS.hotkeys.silentCapture))
  const [region, setRegion] = useState(() => formatShortcut(DEFAULT_SETTINGS.hotkeys.regionSelect))
  const [toggle, setToggle] = useState(() => formatShortcut(DEFAULT_SETTINGS.hotkeys.toggleDropdown))

  useEffect(() => {
    window.snapcue.getSettings().then((s) => {
      setSilent(formatShortcut(s.hotkeys.silentCapture))
      setRegion(formatShortcut(s.hotkeys.regionSelect))
      setToggle(formatShortcut(s.hotkeys.toggleDropdown))
    })
  }, [])

  if (!hasFirstCapture) {
    return (
      <div className="flex flex-col items-center" style={{ padding: '16px 12px' }}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '6px',
          }}
        >
          ready to go
        </span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
          open a question and press {region}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center" style={{ padding: '16px 12px' }}>
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
        <span className="font-mono" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
          {toggle} toggle
        </span>
      </div>
    </div>
  )
}
