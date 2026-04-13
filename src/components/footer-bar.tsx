interface FooterBarProps {
  onOpenSettings: () => void
}

export function FooterBar({ onOpenSettings }: FooterBarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-between"
      style={{
        padding: '5px 10px',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Credits — number only */}
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>10</span>

      {/* Settings gear */}
      <button
        onClick={onOpenSettings}
        className="flex items-center justify-center"
        style={{ width: '16px', height: '16px' }}
        aria-label="Settings"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          <path
            d="M7.07 1.5A.93.93 0 0 1 8 .57h0a.93.93 0 0 1 .93.93v.63a5.08 5.08 0 0 1 1.71.71l.44-.44a.93.93 0 0 1 1.32 0h0a.93.93 0 0 1 0 1.32l-.44.44c.3.52.54 1.1.71 1.71h.63a.93.93 0 0 1 .93.93h0a.93.93 0 0 1-.93.93h-.63a5.08 5.08 0 0 1-.71 1.71l.44.44a.93.93 0 0 1 0 1.32h0a.93.93 0 0 1-1.32 0l-.44-.44a5.08 5.08 0 0 1-1.71.71v.63a.93.93 0 0 1-.93.93h0a.93.93 0 0 1-.93-.93v-.63a5.08 5.08 0 0 1-1.71-.71l-.44.44a.93.93 0 0 1-1.32 0h0a.93.93 0 0 1 0-1.32l.44-.44a5.08 5.08 0 0 1-.71-1.71H2.7a.93.93 0 0 1-.93-.93h0a.93.93 0 0 1 .93-.93h.63a5.08 5.08 0 0 1 .71-1.71l-.44-.44a.93.93 0 0 1 0-1.32h0a.93.93 0 0 1 1.32 0l.44.44A5.08 5.08 0 0 1 7.07 2.13V1.5ZM8 10.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
