import { useEffect, useState } from 'react'
import { useAutoHeight } from './use-auto-height'
import { AnswerPanel } from './answer-panel'
import { PermissionGuide } from './components/permission-guide'
import { FooterBar } from './components/footer-bar'
import { SettingsView } from './components/settings-view'
import { IdleView } from './components/idle-view'
import { LoadingView } from './components/loading-view'

type Status = 'ready' | 'loading' | 'result' | 'error' | 'no-permission'
type View = 'main' | 'settings'

function ErrorPanel({ error }: { error: CaptureError }) {
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
          try ⌃⌥A to select the question area
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
  const containerRef = useAutoHeight<HTMLDivElement>()

  useEffect(() => {
    window.snapcue.getSettings().then((s) => {
      setHasFirstCapture(!!s.hasFirstCapture)
    })
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
          <SettingsView onBack={() => setView('main')} />
        ) : (
          <>
            {status === 'ready' && <IdleView hasFirstCapture={hasFirstCapture} />}

            {status === 'no-permission' && <PermissionGuide />}

            {status === 'loading' && <LoadingView />}

            {status === 'result' && <AnswerPanel answers={answers} />}

            {status === 'error' && error && <ErrorPanel error={error} />}
          </>
        )}
      </div>

      {/* Footer — only on main view */}
      {view !== 'settings' && <FooterBar onOpenSettings={() => setView('settings')} />}
    </div>
  )
}
