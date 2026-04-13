interface FooterBarProps {
  onOpenSettings: () => void
}

export function FooterBar({ onOpenSettings }: FooterBarProps) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-t border-white/10 px-3">
      {/* Credits */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-green-400">●</span>
        <span className="text-xs text-white/50">10 credits</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="group flex h-6 w-6 items-center justify-center rounded"
          aria-label="Settings"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-white/50 transition-colors group-hover:text-white"
          >
            <path
              d="M6.5 1.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.3a5.52 5.52 0 0 1 1.56.64l.21-.21a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1 0 1.06l-.21.21c.27.49.49 1.01.64 1.56h.3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-.3a5.52 5.52 0 0 1-.64 1.56l.21.21a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0l-.21-.21a5.52 5.52 0 0 1-1.56.64v.3a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-.3a5.52 5.52 0 0 1-1.56-.64l-.21.21a.75.75 0 0 1-1.06 0L2.61 12.3a.75.75 0 0 1 0-1.06l.21-.21a5.52 5.52 0 0 1-.64-1.56h-.3a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 .75-.75h.3c.15-.55.37-1.07.64-1.56l-.21-.21a.75.75 0 0 1 0-1.06L3.67 2.58a.75.75 0 0 1 1.06 0l.21.21A5.52 5.52 0 0 1 6.5 2.15v-.4ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
              fill="currentColor"
            />
          </svg>
        </button>

        {/* Quit */}
        <button
          onClick={() => window.snapcue.quit()}
          className="group flex h-6 w-6 items-center justify-center rounded"
          aria-label="Quit"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-white/50 transition-colors group-hover:text-white"
          >
            <path
              d="M4.11 4.11a.75.75 0 0 1 1.06 0L8 6.94l2.83-2.83a.75.75 0 1 1 1.06 1.06L9.06 8l2.83 2.83a.75.75 0 1 1-1.06 1.06L8 9.06l-2.83 2.83a.75.75 0 0 1-1.06-1.06L6.94 8 4.11 5.17a.75.75 0 0 1 0-1.06Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
