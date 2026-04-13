interface SettingsViewProps {
  onBack: () => void
}

export function SettingsView({ onBack }: SettingsViewProps) {
  return (
    <div className="px-4 py-3">
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-xs text-white/50 transition-colors hover:text-white/90"
      >
        <span>←</span>
        <span>返回</span>
      </button>
      <p className="text-sm text-white/40">Settings (coming soon)</p>
    </div>
  )
}
