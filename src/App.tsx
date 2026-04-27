import { useEffect, useState } from 'react'
import { useAutoHeight } from './hooks/use-auto-height'
import { AnswerPanel } from './components/answer-panel'
import { PermissionGuide } from './components/permission-guide'
import { FooterBar } from './components/footer-bar'
import { SettingsView } from './components/settings-view'
import { IdleView } from './components/idle-view'
import { LoadingView } from './components/loading-view'
import { SignInPrompt } from './components/sign-in-prompt'

type Status = 'ready' | 'loading' | 'result' | 'error' | 'no-permission'
type View = 'main' | 'settings'

/** Format Electron accelerator string for display: "Control+Alt+A" → "⌃⌥A" */
function formatShortcut(accel: string): string {
  return accel
    .replace(/Control\+/g, '⌃')
    .replace(/Alt\+/g, '⌥')
    .replace(/Shift\+/g, '⇧')
    .replace(/Command\+/g, '⌘')
    .replace(/Meta\+/g, '⌘')
}

interface ErrorPanelProps {
  error: CaptureError
  meta: CreditsMeta | null
  regionShortcut: string
  onOpenSettings: () => void
  onDismiss: () => void
}

function ErrorPanel({ error, meta, regionShortcut, onOpenSettings, onDismiss }: ErrorPanelProps) {
  if (error.type === 'auth_required') {
    return <SignInPrompt title="Sign in to continue" variant="block" />
  }

  if (error.type === 'no_credits') {
    return (
      <div style={{ padding: '10px 12px' }}>
        <p
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '10px',
          }}
        >
          You&apos;re out of credits
        </p>
        <button
          onClick={() => window.snapcue.openPricing()}
          className="w-full transition-colors"
          style={{
            padding: '5px 0',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
            color: 'rgba(16,185,129,0.9)',
            background: 'rgba(16,185,129,0.15)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16,185,129,0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(16,185,129,0.15)')}
        >
          Upgrade
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full transition-colors"
          style={{
            marginTop: '4px',
            padding: '4px 0',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.35)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          Settings
        </button>
      </div>
    )
  }

  if (error.type === 'daily_limit') {
    const planPart = meta?.subscription_type ? `${meta.subscription_type} plan · ` : ''
    const usage = meta?.daily_usage_count ?? 50
    return (
      <div style={{ padding: '10px 12px' }}>
        <p
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '4px',
          }}
        >
          Daily limit reached
        </p>
        <p
          style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.3)',
            marginBottom: '10px',
          }}
        >
          {usage}/50 today · {planPart}resets at UTC midnight
        </p>
        <button
          onClick={onDismiss}
          className="w-full transition-colors"
          style={{
            padding: '5px 0',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.5)',
            background: 'rgba(255,255,255,0.06)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          OK
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '6px 10px' }}>
      <p style={{ fontSize: '11px', lineHeight: 1.45, color: 'rgba(255,255,255,0.35)' }}>
        {error.message}
      </p>
      {error.canRetry ? (
        <button
          onClick={() => window.snapcue.retryCapture()}
          className="w-full transition-colors"
          style={{
            marginTop: '6px',
            padding: '4px 0',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.5)',
            background: 'rgba(255,255,255,0.06)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          Retry
        </button>
      ) : error.type === 'no_questions' ? (
        <p style={{ marginTop: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
          try {regionShortcut} to select the question area
        </p>
      ) : null}
    </div>
  )
}

export function App() {
  const [status, setStatus] = useState<Status>('ready')
  const [error, setError] = useState<CaptureError | null>(null)
  const [answers, setAnswers] = useState<AnswerItem[]>([])
  const [view, setView] = useState<View>('main')
  const [hasFirstCapture, setHasFirstCapture] = useState(false)
  const [regionAccel, setRegionAccel] = useState('Control+Alt+A')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [meta, setMeta] = useState<CreditsMeta | null>(null)
  const containerRef = useAutoHeight<HTMLDivElement>()

  useEffect(() => {
    window.snapcue.getSettings().then((s) => {
      setHasFirstCapture(!!s.hasFirstCapture)
      setRegionAccel(s.hotkeys.regionSelect)
    })
    window.snapcue.getCurrentUser().then(setUser)
    window.snapcue.getCreditsMeta().then(setMeta)
  }, [])

  const regionShortcut = formatShortcut(regionAccel)

  useEffect(() => {
    const unsubs = [
      window.snapcue.onAuthSignedIn(() => {
        window.snapcue.getCurrentUser().then(setUser)
      }),
      window.snapcue.onAuthSignedOut(() => {
        setUser(null)
      }),
      window.snapcue.onCreditsUpdate(setMeta),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.snapcue.hideDropdown()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Product contract: loading state never exceeds 35 seconds. Last-resort
  // guard if the main-side push is dropped for any reason (IPC hiccup,
  // destroyed webContents, Railway cold-start racing past our 30s timeout).
  // Seeing a permanent spinner is worse UX than a retryable error panel.
  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(() => {
      setStatus('error')
      setError({
        type: 'unknown',
        message: 'Request seems stuck. Try again.',
        canRetry: true,
      })
    }, 35_000)
    return () => clearTimeout(timer)
  }, [status])

  useEffect(() => {
    const unsubs = [
      window.snapcue.onPermissionStatus((granted) => {
        if (granted) {
          setStatus((prev) => (prev === 'no-permission' ? 'ready' : prev))
        } else {
          setStatus('no-permission')
        }
      }),
      window.snapcue.onCaptureLoading(() => {
        setView('main')
        setStatus('loading')
        setError(null)
        setAnswers([])
      }),
      window.snapcue.onCaptureError((err) => {
        setStatus('error')
        setError(err)
      }),
      window.snapcue.onCaptureResult((items) => {
        setStatus('result')
        setAnswers(items)
        setHasFirstCapture(true)
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex flex-col"
      style={{
        width: '200px',
        background: 'rgba(30,30,30,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Content area */}
      <div className="min-h-0 flex-1" key={view} style={{ animation: 'fadeIn 150ms ease' }}>
        {view === 'settings' ? (
          <SettingsView onBack={() => setView('main')} user={user} meta={meta} />
        ) : (
          <>
            {status === 'ready' && <IdleView user={user} hasFirstCapture={hasFirstCapture} />}

            {status === 'no-permission' && <PermissionGuide />}

            {status === 'loading' && <LoadingView />}

            {status === 'result' && (
              <AnswerPanel answers={answers} regionShortcut={regionShortcut} />
            )}

            {status === 'error' && error && (
              <ErrorPanel
                error={error}
                meta={meta}
                regionShortcut={regionShortcut}
                onOpenSettings={() => setView('settings')}
                onDismiss={() => {
                  setStatus('ready')
                  setError(null)
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Footer — only on main view */}
      {view !== 'settings' && (
        <FooterBar
          onOpenSettings={() => setView('settings')}
          user={user}
          meta={meta}
          firstUse={!hasFirstCapture}
        />
      )}
    </div>
  )
}
