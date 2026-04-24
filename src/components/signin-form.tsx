import { useEffect, useState } from 'react'

const RESEND_COOLDOWN_MS = 15_000

interface SignInFormProps {
  /** Fires on the first successful send (idle → sent transition). */
  onSent?: () => void
}

type Phase = 'idle' | 'sent'

export function SignInForm({ onSent }: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null)
  const [, forceTick] = useState(0)

  // Tick the cooldown every 250ms so the countdown label re-renders.
  useEffect(() => {
    if (!cooldownEndsAt) return
    const interval = setInterval(() => {
      if (Date.now() >= cooldownEndsAt) {
        setCooldownEndsAt(null)
      } else {
        forceTick((n) => n + 1)
      }
    }, 250)
    return () => clearInterval(interval)
  }, [cooldownEndsAt])

  const cooldownLeft = cooldownEndsAt ? Math.max(0, cooldownEndsAt - Date.now()) : 0
  const isCoolingDown = cooldownLeft > 0
  const cooldownSec = Math.ceil(cooldownLeft / 1000)

  const canSend = email.trim().length > 0 && !isSubmitting && !isCoolingDown

  const handleSend = async () => {
    if (!canSend) return
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const res = await window.snapcue.signIn(email.trim())
      if (res.success) {
        if (phase !== 'sent') {
          setPhase('sent')
          onSent?.()
        }
        setCooldownEndsAt(Date.now() + RESEND_COOLDOWN_MS)
      } else {
        setErrorMsg(res.error ?? 'Failed to send magic link')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const buttonLabel = (() => {
    if (isSubmitting) return 'Sending...'
    if (phase === 'sent') {
      return isCoolingDown ? `Resend (${cooldownSec}s)` : 'Resend'
    }
    return isCoolingDown ? `Send Magic Link (${cooldownSec}s)` : 'Send Magic Link'
  })()

  return (
    <div className="flex flex-col" style={{ width: '260px', gap: '8px' }}>
      <input
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (errorMsg) setErrorMsg('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSend()
        }}
        placeholder="you@example.com"
        autoFocus
        autoComplete="email"
        spellCheck={false}
        disabled={isSubmitting}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.9)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
      />

      {phase === 'sent' && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.2)',
            fontSize: '12px',
            color: 'rgba(134,239,172,0.9)',
            textAlign: 'center',
          }}
        >
          Check your email for the magic link.
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={!canSend}
        className="transition-colors duration-200"
        style={{
          width: '100%',
          padding: '8px 20px',
          background: canSend ? '#EDEDED' : 'rgba(255,255,255,0.12)',
          color: canSend ? '#0A0A0A' : 'rgba(255,255,255,0.4)',
          fontSize: '13px',
          fontWeight: 500,
          borderRadius: '8px',
          border: 'none',
          cursor: canSend ? 'pointer' : 'default',
        }}
        onMouseEnter={(e) => {
          if (canSend) e.currentTarget.style.background = '#FFFFFF'
        }}
        onMouseLeave={(e) => {
          if (canSend) e.currentTarget.style.background = '#EDEDED'
        }}
      >
        {buttonLabel}
      </button>

      {errorMsg && (
        <p
          style={{
            fontSize: '11px',
            color: 'rgba(239,68,68,0.8)',
            textAlign: 'center',
          }}
        >
          {errorMsg}
        </p>
      )}
    </div>
  )
}
