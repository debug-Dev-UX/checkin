import React, { useState, useEffect } from 'react'

export default function LoadingPage({ message = 'Loading Chafé HR System...' }) {
  const [progress, setProgress] = useState(16)
  const [stageIndex, setStageIndex] = useState(0)

  const STAGES = [
    { text: 'Establishing secure cloud handshake...', pct: 24 },
    { text: 'Syncing staff roster & multi-branch schedules...', pct: 52 },
    { text: 'Retrieving real-time attendance activities...', pct: 78 },
    { text: 'Calibrating biometric & GPS validation...', pct: 92 },
    { text: 'Finalizing executive workspace...', pct: 98 },
  ]

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(52)
      setStageIndex(1)
    }, 220)

    const t2 = setTimeout(() => {
      setProgress(78)
      setStageIndex(2)
    }, 520)

    const t3 = setTimeout(() => {
      setProgress(92)
      setStageIndex(3)
    }, 900)

    const t4 = setTimeout(() => {
      setProgress(98)
      setStageIndex(4)
    }, 1350)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [])

  const currentStage = STAGES[stageIndex] || STAGES[0]

  return (
    <div className="full-loading-screen" role="status" aria-live="polite">
      {/* Dynamic atmospheric ambient glow orbs */}
      <div className="loading-bg-glow glow-top"></div>
      <div className="loading-bg-glow glow-bottom"></div>
      <div className="loading-bg-glow glow-center"></div>

      {/* Decorative architectural grid background overlay */}
      <div className="loading-grid-overlay"></div>

      {/* Floating Glassmorphic Executive Card */}
      <div className="loading-content-box">
        {/* Animated Multi-Layer Rings Emblem */}
        <div className="loading-brand-emblem" aria-hidden="true">
          {/* Layer 1: Outer radiant gradient orbit with satellite beacon */}
          <div className="emblem-ring-outer">
            <div className="emblem-satellite-beacon"></div>
          </div>

          {/* Layer 2: Middle counter-rotating precision dashed ring */}
          <div className="emblem-ring-middle"></div>

          {/* Layer 3: Inner orbit ring with cardinal micro-ticks */}
          <div className="emblem-ring-inner">
            <span className="emblem-tick tick-n"></span>
            <span className="emblem-tick tick-s"></span>
            <span className="emblem-tick tick-e"></span>
            <span className="emblem-tick tick-w"></span>
          </div>

          {/* Layer 4: Glass Core with Executive HR Security Monogram */}
          <div className="emblem-core-glass">
            <svg
              className="emblem-shield-svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L4 6V11C4 16.55 7.4 21.74 12 23C16.6 21.74 20 16.55 20 11V6L12 2Z"
                fill="url(#emblemShieldGrad)"
                fillOpacity="0.25"
                stroke="url(#emblemShieldStroke)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 12L11 14L15.5 9.5"
                stroke="#38bdf8"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="6.2" r="1.3" fill="#10b981" />
              <defs>
                <linearGradient id="emblemShieldGrad" x1="4" y1="2" x2="20" y2="23" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="0.5" stopColor="#06b6d4" />
                  <stop offset="1" stopColor="#10b981" />
                </linearGradient>
                <linearGradient id="emblemShieldStroke" x1="4" y1="2" x2="20" y2="23" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#818cf8" />
                  <stop offset="0.6" stopColor="#38bdf8" />
                  <stop offset="1" stopColor="#34d399" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Brand Header & Badge */}
        <div className="loading-brand-header">
          <div className="loading-badge">
            <span className="badge-live-dot"></span>
            <span className="loading-logo-text">CHAFÉ</span>
            <span className="loading-badge-divider"></span>
            <span className="loading-logo-tag">ENTERPRISE HR</span>
          </div>
          <h2 className="loading-title">{message}</h2>
          <p className="loading-subtitle" key={stageIndex}>
            {currentStage.text}
          </p>
        </div>

        {/* Progress Bar & Live Counter */}
        <div className="loading-progress-wrapper">
          <div className="loading-progress-meta">
            <span className="loading-meta-label">INITIALIZING SYSTEM</span>
            <span className="loading-pct-counter">{Math.round(progress)}%</span>
          </div>
          <div className="loading-progress-track">
            <div
              className="loading-progress-fill"
              style={{ width: `${progress}%` }}
            >
              <div className="progress-shimmer-beam"></div>
            </div>
          </div>
        </div>

        {/* Security & System Metadata */}
        <div className="loading-meta-status">
          <div className="status-pill">
            <span className="status-icon">🔒</span>
            <span>256-BIT SSL</span>
          </div>
          <span className="meta-bullet">•</span>
          <div className="status-pill">
            <span className="meta-pulse-dot"></span>
            <span>LIVE SYNC</span>
          </div>
          <span className="meta-bullet">•</span>
          <div className="status-pill">
            <span className="status-icon">⚡</span>
            <span>v2.4 READY</span>
          </div>
        </div>
      </div>
    </div>
  )
}
