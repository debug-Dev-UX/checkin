import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { LanguageProvider } from './context/LanguageContext'

// Register PWA Service Worker for Home Screen Installability
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration skipped:', err)
    })
  })
}

// Disable pinch-to-zoom, gesture zoom, and double-tap zoom across iOS & Android
if (typeof window !== 'undefined') {
  // Prevent multi-touch pinch to zoom
  document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault()
    }
  }, { passive: false })

  // Prevent iOS Safari gesture zoom
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault()
  })
  document.addEventListener('gesturechange', (e) => {
    e.preventDefault()
  })
  document.addEventListener('gestureend', (e) => {
    e.preventDefault()
  })

  // Prevent double-tap to zoom (while preserving normal input and button taps)
  let lastTouchEndTime = 0
  document.addEventListener('touchend', (e) => {
    const now = Date.now()
    if (now - lastTouchEndTime <= 300) {
      const tag = e.target?.tagName?.toLowerCase()
      if (tag !== 'input' && tag !== 'textarea') {
        e.preventDefault()
      }
    }
    lastTouchEndTime = now
  }, { passive: false })

  // Prevent Ctrl + Mouse wheel zoom (desktop / touchpad)
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault()
    }
  }, { passive: false })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)

