import { useEffect, useRef, useState } from 'react'

const RESEND_COOLDOWN_MS = 15_000
const CODE_LENGTH = 6

interface SignInFormProps {
  /** Fires on the first successful send (idle → sent transition). */
  onSent?: () => void
}

type Phase = 'idle' | 'sent'

export function SignInForm({ onSent }: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null)
  const [, forceTick] = useState(0)
  const codeInputRef = useRef<HTMLInputElement>(null)

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

  // Auto-focus the code field once we land on the "sent" view.
  useEffect(() => {
    if (phase === 'sent') codeInputRef.current?.focus()
  }, [phase])

  const cooldownLeft = cooldownEndsAt ? Math.max(0, cooldownEndsAt - Date.now()) : 0
  const isCoolingDown = cooldownLeft > 0
  const cooldownSec = Math.ceil(cooldownLeft / 1000)

  const canSend = email.trim().length > 0 && !isSending && !isCoolingDown && !isVerifying
  const canVerify = code.length === CODE_LENGTH && !isVerifying

  const handleSend = async () => {
    if (!canSend) return
    setIsSending(true)
    setErrorMsg('')
    try {
      const res = await window.snapcue.signIn(email.trim())
      if (res.success) {
        if (phase !== 'sent') {
          setPhase('sent')
          onSent?.()
        }
        setCode('')
        setCooldownEndsAt(Date.now() + RESEND_COOLDOWN_MS)
      } else {
        setErrorMsg(res.error ?? 'Failed to send code')
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleVerify = async () => {
    if (!canVerify) return
    setIsVerifying(true)
    setErrorMsg('')
    try {
      const res = await window.snapcue.verifyOtp(email.trim(), code.trim())
      if (!res.success) {
        setErrorMsg(res.error ?? 'Invalid or expired code')
      }
      // On success, the AUTH_SIGNED_IN broadcast from main closes the
      // signin window and refreshes the footer — nothing else to do.
    } finally {
      setIsVerifying(false)
    }
  }

  const handleBackToEmail = () => {
    setPhase('idle')
    setCode('')
    setErrorMsg('')
    setCooldownEndsAt(null)
  }

  // Google OAuth: opens the user's default browser. Once they finish auth on
  // Google, Supabase redirects to snapcue.io/auth/callback which redirects to
  // snapcue:// — the deep-link handler in main.ts then broadcasts auth:signedIn
  // and closes this signin window. So this handler just kicks off the browser
  // and waits; success is observed externally.
  const handleGoogleSignIn = async () => {
    if (isGoogleSigningIn || isSending || isVerifying) return
    setIsGoogleSigningIn(true)
    setErrorMsg('')
    try {
      const res = await window.snapcue.signInGoogle()
      if (!res.success) {
        setErrorMsg(res.error ?? 'Failed to start Google sign-in')
      }
    } finally {
      setIsGoogleSigningIn(false)
    }
  }

  const sendButtonLabel = (() => {
    if (isSending) return phase === 'sent' ? 'Resending...' : 'Sending...'
    if (phase === 'sent') {
      return isCoolingDown ? `Resend (${cooldownSec}s)` : 'Resend'
    }
    return isCoolingDown ? `Send code (${cooldownSec}s)` : 'Send code'
  })()

  // ── Idle phase: collect email ────────────────────────────────────────────
  if (phase === 'idle') {
    const googleDisabled = isGoogleSigningIn || isSending
    return (
      <div className="flex flex-col" style={{ width: '260px', gap: '8px' }}>
        {/* Google OAuth — placed first because it's faster (one click vs
            email + 6-digit code). Subtle dark variant matches the rest of
            the signin window's aesthetic. */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleDisabled}
          className="transition-colors duration-200"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            padding: '8px 20px',
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.9)',
            fontSize: '13px',
            fontWeight: 500,
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: googleDisabled ? 'default' : 'pointer',
            opacity: googleDisabled ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!googleDisabled) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
          }}
          onMouseLeave={(e) => {
            if (!googleDisabled) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          }}
        >
          <GoogleLogo />
          {isGoogleSigningIn ? 'Opening browser...' : 'Continue with Google'}
        </button>

        {/* Divider — "or" between Google and email flow */}
        <div className="flex items-center" style={{ gap: '10px', padding: '4px 0' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
          <span
            style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.04em',
              textTransform: 'lowercase',
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
        </div>

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
          disabled={isSending}
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
          {sendButtonLabel}
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

  // ── Sent phase: enter the 6-digit code from email ────────────────────────
  return (
    <div className="flex flex-col" style={{ width: '260px', gap: '8px' }}>
      <p
        style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
          margin: 0,
          padding: '4px 0',
        }}
      >
        We sent a 6-digit code to{' '}
        <span style={{ color: 'rgba(255,255,255,0.9)' }}>{email.trim()}</span>
      </p>

      <input
        ref={codeInputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        value={code}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)
          setCode(cleaned)
          if (errorMsg) setErrorMsg('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleVerify()
        }}
        placeholder="000000"
        spellCheck={false}
        disabled={isVerifying}
        style={{
          width: '100%',
          padding: '10px 12px',
          fontSize: '20px',
          letterSpacing: '8px',
          textAlign: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          color: 'rgba(255,255,255,0.95)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
      />

      <button
        onClick={handleVerify}
        disabled={!canVerify}
        className="transition-colors duration-200"
        style={{
          width: '100%',
          padding: '8px 20px',
          background: canVerify ? '#EDEDED' : 'rgba(255,255,255,0.12)',
          color: canVerify ? '#0A0A0A' : 'rgba(255,255,255,0.4)',
          fontSize: '13px',
          fontWeight: 500,
          borderRadius: '8px',
          border: 'none',
          cursor: canVerify ? 'pointer' : 'default',
        }}
        onMouseEnter={(e) => {
          if (canVerify) e.currentTarget.style.background = '#FFFFFF'
        }}
        onMouseLeave={(e) => {
          if (canVerify) e.currentTarget.style.background = '#EDEDED'
        }}
      >
        {isVerifying ? 'Verifying...' : 'Verify'}
      </button>

      {errorMsg && (
        <p
          style={{
            fontSize: '11px',
            color: 'rgba(239,68,68,0.8)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {errorMsg}
        </p>
      )}

      <div className="flex items-center justify-center" style={{ gap: '12px', marginTop: '4px' }}>
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: '11px',
            color: canSend ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
            cursor: canSend ? 'pointer' : 'default',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {sendButtonLabel}
        </button>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>·</span>
        <button
          onClick={handleBackToEmail}
          disabled={isVerifying}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.55)',
            cursor: isVerifying ? 'default' : 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          Use different email
        </button>
      </div>
    </div>
  )
}

/** Google "G" multicolor logo per Google's brand guidelines. */
function GoogleLogo() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
