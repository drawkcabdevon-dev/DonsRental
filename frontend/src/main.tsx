import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/index.css'
import App from './App.tsx'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Global error handlers for debugging black-screen issues
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[GLOBAL ERROR]', { message, source, lineno, colno, error })
  // Render error into root as last resort
  const root = document.getElementById('root')
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `<div style="padding:2rem;margin:2rem;background:#fee;border:2px solid red;border-radius:8px;font-family:monospace"><h2>JavaScript Error</h2><pre>${error?.stack || message}</pre></div>`
  }
}
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED REJECTION]', e.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
