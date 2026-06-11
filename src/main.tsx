import { MotionGlobalConfig } from 'framer-motion'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Hidden tabs and embedded previews throttle rAF/timers so hard that
// animations never reach their final state, leaving entering UI invisible and
// exiting UI stuck on screen. If the app boots hidden, jump straight to final
// animation states.
if (document.hidden) {
  MotionGlobalConfig.skipAnimations = true
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
