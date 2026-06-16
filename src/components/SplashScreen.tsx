import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import logoUrl from '../assets/polestarlogo.png'

interface SplashScreenProps {
  /** Whether the splash overlay is visible. */
  show: boolean
}

/**
 * Minimal startup splash: white background, centered Polestar logo, a welcome
 * headline, and a determinate loading bar. Rendered as an overlay so the app
 * mounts and restores state behind it — it never blocks project loading.
 */
export function SplashScreen({ show }: SplashScreenProps) {
  const [logoOk, setLogoOk] = useState(true)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          animate={{ opacity: 1 }}
          aria-label="Loading Polan"
          className="splash-screen"
          exit={{ opacity: 0 }}
          initial={{ opacity: 1 }}
          role="status"
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="splash-inner"
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {logoOk && (
              <img
                alt="Polestar Analytics"
                className="splash-logo"
                onError={() => setLogoOk(false)}
                src={logoUrl}
              />
            )}
            <h1 className="splash-title">Welcome to Polan</h1>
            <div className="splash-bar">
              <div className="splash-bar-fill" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
