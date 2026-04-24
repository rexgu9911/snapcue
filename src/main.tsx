import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { OnboardingView } from './components/onboarding-view'
import { SignInView } from './components/signin-view'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

const hash = window.location.hash
const isOnboarding = hash === '#onboarding'
const isSignin = hash === '#signin'

// Set mode-specific body styles
if (isOnboarding || isSignin) {
  document.body.style.background = '#0A0A0A'
} else {
  // Dropdown mode: constrain width + dark background to prevent flash on resize
  document.body.style.width = '200px'
  document.body.style.background = 'rgba(30, 30, 30, 0.92)'
}

createRoot(root).render(
  <StrictMode>
    {isOnboarding ? <OnboardingView /> : isSignin ? <SignInView /> : <App />}
  </StrictMode>,
)
