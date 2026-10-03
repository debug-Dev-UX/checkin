import React, { useState, useEffect } from 'react'

export default function LoadingPage({ message = 'Loading Chafé HR System...' }) {
  const [progress, setProgress] = useState(15)
  const [stageText, setStageText] = useState('Connecting to server...')

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setProgress(45)
      setStageText('Syncing staff roster & schedules...')
    }, 200)

    const timer2 = setTimeout(() => {
      setProgress(75)
      setStageText('Retrieving check-in activities...')
    }, 450)

    const timer3 = setTimeout(() => {
      setProgress(95)
      setStageText('Preparing artisan dashboard...')
    }, 700)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [])

  return (
    <div className="full-loading-screen" role="status" aria-live="polite">
      {/* Background ambient glow circles */}
      <div className="loading-bg-glow glow-top"></div>
      <div className="loading-bg-glow glow-bottom"></div>

      <div className="loading-content-box">
        {/* Animated Brand Emblem */}
        <div className="loading-brand-emblem">
          <div className="emblem-outer-ring"></div>
          <div className="emblem-inner-cup">
            <span className="coffee-emoji">☕</span>
            <div className="steam-line steam-1"></div>
            <div className="steam-line steam-2"></div>
            <div className="steam-line steam-3"></div>
          </div>
        </div>

        {/* Brand Title */}
        <div className="loading-brand-header">
          <div className="loading-badge">
            <span className="loading-logo-text">Chafé</span>
            <span className="loading-logo-tag">HR</span>
          </div>
          <h2 className="loading-title">{message}</h2>
          <p className="loading-subtitle">{stageText}</p>
        </div>

        {/* Progress Bar */}
        <div className="loading-progress-track">
          <div
            className="loading-progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Status indicator pulse */}
        <div className="loading-meta-status">
          <span className="meta-pulse-dot"></span>
          <span>Live API Connection • port 8000</span>
        </div>
      </div>
    </div>
  )
}
