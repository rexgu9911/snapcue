import { useEffect, useState } from 'react'
import { useAutoHeight } from './use-auto-height'
import { AnswerPanel } from './answer-panel'
import { PermissionGuide } from './components/permission-guide'
import { FooterBar } from './components/footer-bar'
import { SettingsView } from './components/settings-view'

type Status = 'ready' | 'loading' | 'result' | 'error' | 'no-permission'
type View = 'main' | 'settings'

export function App() {
  const [status, setStatus] = useState<Status>('ready')
  const [errorMsg, setErrorMsg] = useState('')
  const [answer, setAnswer] = useState('')
  const [view, setView] = useState<View>('main')
  const containerRef = useAutoHeight<HTMLDivElement>()

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
        setErrorMsg('')
        setAnswer('')
      }),
      window.snapcue.onCaptureError((message) => {
        setStatus('error')
        setErrorMsg(message)
      }),
      window.snapcue.onCaptureResult((text) => {
        setStatus('result')
        setAnswer(text)
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col rounded-xl">
      {/* Content area */}
      <div className="min-h-0 flex-1">
        {view === 'settings' ? (
          <SettingsView onBack={() => setView('main')} />
        ) : (
          <>
            {status === 'ready' && (
              <div className="flex items-center justify-center px-4 py-4">
                <p className="text-sm font-medium text-white/70">SnapCue Ready</p>
              </div>
            )}

            {status === 'no-permission' && <PermissionGuide />}

            {status === 'loading' && (
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                <p className="text-sm font-medium text-white/70">Analyzing...</p>
              </div>
            )}

            {status === 'result' && <AnswerPanel answer={answer} />}

            {status === 'error' && (
              <div className="px-4 py-4">
                <p className="text-sm font-medium text-red-400">{errorMsg}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer — always visible */}
      <FooterBar onOpenSettings={() => setView('settings')} />
    </div>
  )
}
