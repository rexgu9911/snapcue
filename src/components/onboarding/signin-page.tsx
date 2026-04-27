import { SignInForm } from '../signin-form'
import { BackButton } from './shared'

export function SignInContent({ onBack }: { onBack: () => void }) {
  return (
    <>
      <BackButton onClick={onBack} />

      <div
        className="flex flex-1 flex-col items-center justify-center"
        style={{ gap: '16px', maxWidth: '320px', minHeight: 0 }}
      >
        <div className="flex flex-col items-center text-center" style={{ gap: '6px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: '-0.01em',
            }}
          >
            Sign in to sync credits across devices
          </h2>
          <p
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.5,
            }}
          >
            We&apos;ll email you a 6-digit code. No password needed.
          </p>
        </div>

        <SignInForm />
      </div>
    </>
  )
}
