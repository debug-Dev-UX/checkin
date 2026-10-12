import React, { useMemo } from 'react'

/**
 * NeonLoadingSpinner
 * Replicates the glowing neon circular dot spinner with centered "LOADING" text
 * on a deep black background, matching the exact visual style in the reference image.
 */
export default function NeonLoadingSpinner({
  size = 280,
  text = 'LOADING',
  showText = true,
  className = '',
  speed = 1.4, // seconds per revolution
}) {
  const dotCount = 28
  const startDeg = 100 // ~6:20 o'clock position (tail start)
  const sweepDeg = 325 // sweeps clockwise to ~65 deg (5:10 o'clock position)
  const cx = 160
  const cy = 160
  const R = 108

  // Calculate pre-computed dots for the circular neon spiral
  const dots = useMemo(() => {
    const list = []
    for (let i = 0; i < dotCount; i++) {
      const t = i / (dotCount - 1)
      const deg = (startDeg + t * sweepDeg) % 360
      const rad = (deg * Math.PI) / 180
      const x = +(cx + R * Math.cos(rad)).toFixed(2)
      const y = +(cy + R * Math.sin(rad)).toFixed(2)
      // Radius smoothly expands from 1.0px to 12.8px with exponential curve
      const r = +(1.0 + Math.pow(t, 1.48) * 11.8).toFixed(2)
      // Opacity scales from faint tail (0.2) to full brilliant head (1.0)
      const opacity = +(0.2 + Math.pow(t, 0.75) * 0.8).toFixed(2)

      list.push({ i, t, x, y, r, opacity })
    }
    return list
  }, [dotCount, startDeg, sweepDeg, cx, cy, R])

  return (
    <div
      className={`neon-spinner-container ${className}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      role="progressbar"
      aria-label="Loading"
    >
      <svg
        viewBox="0 0 320 320"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          display: 'block',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Spherical 3D gradient for the largest leading head spheres */}
          <radialGradient id="neonSphereHeadGrad" cx="36%" cy="34%" r="66%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="30%" stopColor="#38bdf8" />
            <stop offset="65%" stopColor="#0284c7" />
            <stop offset="90%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#075985" />
          </radialGradient>

          {/* Medium glowing spherical gradient */}
          <radialGradient id="neonSphereMedGrad" cx="38%" cy="36%" r="64%">
            <stop offset="0%" stopColor="#f0f9ff" />
            <stop offset="30%" stopColor="#38bdf8" />
            <stop offset="70%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </radialGradient>

          {/* Small dot gradient */}
          <radialGradient id="neonSphereSmallGrad" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0284c7" />
          </radialGradient>

          {/* Intense neon cyan glow bloom for head dots */}
          <filter id="neonHeadBloom" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="12" result="ambientBloom" />
            <feGaussianBlur stdDeviation="5" result="sharpBloom" />
            <feMerge>
              <feMergeNode in="ambientBloom" />
              <feMergeNode in="sharpBloom" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle glow for mid dots */}
          <filter id="neonMedBloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="midBlur" />
            <feMerge>
              <feMergeNode in="midBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The rotating ring of beads/dots */}
        <g
          className="neon-dots-track"
          style={{
            transformOrigin: '160px 160px',
            animation: `neonSpinRotation ${speed}s linear infinite`,
          }}
        >
          {dots.map(dot => {
            let fill = 'url(#neonSphereSmallGrad)'
            let filter = undefined

            if (dot.t >= 0.8) {
              fill = 'url(#neonSphereHeadGrad)'
              filter = 'url(#neonHeadBloom)'
            } else if (dot.t >= 0.45) {
              fill = 'url(#neonSphereMedGrad)'
              filter = 'url(#neonMedBloom)'
            }

            return (
              <circle
                key={dot.i}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={fill}
                opacity={dot.opacity}
                filter={filter}
              />
            )
          })}
        </g>
      </svg>

      {/* Centered glowing uppercase LOADING text */}
      {showText && (
        <div
          className="neon-loading-title"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>
      )}
    </div>
  )
}
