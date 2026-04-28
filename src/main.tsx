import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { OnboardingView } from './components/onboarding-view'
import { SignInView } from './components/signin-view'
import { CoachmarkView } from './components/coachmark-view'
import { AnswerBubbleView } from './components/answer-bubble-view'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

const hash = window.location.hash
const isOnboarding = hash === '#onboarding'
const isSignin = hash === '#signin'
const isCoachmark = hash === '#coachmark'
const isAnswerBubble = hash === '#answer-bubble'

// Set mode-specific body styles
if (isOnboarding || isSignin) {
  document.body.style.background = '#0A0A0A'
} else if (isCoachmark || isAnswerBubble) {
  // Floating windows are fully transparent; only their component paints.
  document.documentElement.style.width = '100%'
  document.documentElement.style.height = '100%'
  document.body.style.width = '100vw'
  document.body.style.height = '100vh'
  document.body.style.background = 'transparent'
  root.style.width = '100vw'
  root.style.height = '100vh'
} else {
  // Dropdown mode: constrain width + dark background to prevent flash on resize
  document.body.style.width = '200px'
  document.body.style.background = 'rgba(30, 30, 30, 0.92)'
}

const coachmarkTailOffset = (() => {
  if (!isCoachmark) return 0
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('tailOffset')
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : 120
})()

createRoot(root).render(
  <StrictMode>
    {isOnboarding ? (
      <OnboardingView />
    ) : isSignin ? (
      <SignInView />
    ) : isCoachmark ? (
      <CoachmarkView tailOffset={coachmarkTailOffset} />
    ) : isAnswerBubble ? (
      <AnswerBubbleView />
    ) : (
      <App />
    )}
  </StrictMode>,
)
