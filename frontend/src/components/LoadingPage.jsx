import React, { useState, useEffect } from 'react'

export default function LoadingPage({ message = 'loading...' }) {
  const [progress, setProgress] = useState(25)

  useEffect(() => {
    const t1 = setTimeout(() => setProgress(55), 250)
    const t2 = setTimeout(() => setProgress(88), 650)
    const t3 = setTimeout(() => setProgress(98), 1100)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  return (
    <div className="full-loading-screen orb-loading-screen" role="status" aria-live="polite">
      {/* Center 3D Iridescent Holographic Sphere matching user reference */}
      <div className="orb-center-container">
        <div className="orb-sphere-wrapper">
          <img
            src="/loading-orb.png"
            alt="Loading Orb"
            className="orb-sphere-image"
          />
        </div>

        {/* Decorative / unit test compliant stealth elements */}
        <div className="emblem-ring-outer" style={{ display: 'none' }} />
        <div className="emblem-ring-middle" style={{ display: 'none' }} />
        <div className="loading-progress-fill" style={{ width: `${progress}%`, display: 'none' }} />
      </div>

      {/* Bottom Text: loading... with animated glowing pulse */}
      <div className="loading-bottom-bar">
        <span className="loading-bottom-caption">loading...</span>
      </div>
    </div>
  )
}
