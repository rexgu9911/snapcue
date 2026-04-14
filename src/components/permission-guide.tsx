import { useState } from 'react'

export function PermissionGuide() {
  const [checking, setChecking] = useState(false)

  const handleOpenSettings = () => {
    window.snapcue.openPermissionSettings()
  }

  const handleRecheck = async () => {
    setChecking(true)
    try {
      await window.snapcue.recheckPermission()
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
          <span className="text-xs text-amber-400">!</span>
        </div>
        <p className="text-sm font-medium text-white/90">Screen recording permission required</p>
      </div>
      <p className="text-xs leading-relaxed text-white/50">
        Grant access in System Settings, then tap recheck below.
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={handleOpenSettings}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/20 active:bg-white/25"
        >
          Open System Settings
        </button>
        <button
          onClick={handleRecheck}
          disabled={checking}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Recheck Permission'}
        </button>
      </div>
    </div>
  )
}
