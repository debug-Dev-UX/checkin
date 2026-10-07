import { useEffect, useState } from 'react'
import {
  IconCheck,
  IconClock,
  IconCalendar,
  IconMapPin,
  IconDoorIn,
  IconDoorOut,
  IconX,
  IconAlertTriangle,
  IconTarget,
} from '../Icons'

function formatLateDuration(mins, withParens = true) {
  const m = Math.max(0, parseInt(mins, 10) || 0)
  const hours = Math.floor(m / 60)
  const rem = m % 60
  const formatted = hours > 0
    ? `${hours}h:${String(rem).padStart(2, '0')}min`
    : `0h:${String(rem).padStart(2, '0')}min`
  return withParens ? `(${formatted})` : formatted
}

export default function ScanSuccessModal({ data, onClose, autoCloseSeconds = 6 }) {
  const [secondsRemaining, setSecondsRemaining] = useState(autoCloseSeconds)

  useEffect(() => {
    if (!data) return

    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          if (onClose) onClose()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [data, onClose])

  if (!data) return null

  const isClockIn = data.action === 'in'
  const initials = (data.name || 'ST')
    .split(' ')
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <div
      className="scan-success-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="scan-success-modal-dialog"
        onClick={e => e.stopPropagation()}
      >
        {/* Animated Success Badge with Glowing Waves */}
        <div className="scan-success-hero">
          <div className="scan-success-pulse-ring" />
          <div className="scan-success-icon-badge">
            <IconCheck size={36} color="#ffffff" strokeWidth={3} />
          </div>
          <button
            type="button"
            className="scan-success-close-x"
            onClick={onClose}
            title="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="scan-success-header-text">
          <h2 className="scan-success-title">
            {isClockIn ? 'Clocked In Successfully!' : 'Clocked Out Successfully!'}
          </h2>
          <div className="scan-success-title-kh">
            {isClockIn ? 'បានចុះវត្តមានចូលធ្វើការជោគជ័យ!' : 'បានចុះវត្តមានចេញពីធ្វើការជោគជ័យ!'}
          </div>
        </div>

        {/* Action Pill Tag */}
        <div className="scan-success-action-pill-wrap">
          <span className={`scan-action-pill ${isClockIn ? 'pill-in' : 'pill-out'}`}>
            {isClockIn ? (
              <>
                <IconDoorIn size={14} color="#059669" />
                <span>SHIFT STARTED • ចូលធ្វើការ</span>
              </>
            ) : (
              <>
                <IconDoorOut size={14} color="#d97706" />
                <span>SHIFT COMPLETED • ចេញធ្វើការ</span>
              </>
            )}
          </span>
        </div>

        {/* Staff Profile Card */}
        <div className="scan-success-staff-card">
          <div className="scan-staff-avatar-wrap">
            {data.photo_url ? (
              <img
                src={data.photo_url}
                alt={data.name}
                className="scan-staff-avatar-img"
              />
            ) : (
              <div className="scan-staff-avatar-placeholder">
                {initials}
              </div>
            )}
          </div>
          <div className="scan-staff-meta">
            <h3 className="scan-staff-name">{data.name}</h3>
            <div className="scan-staff-role">{data.role || 'Staff Member'}</div>
            {data.branch_name && (
              <div className="scan-staff-branch">
                <IconMapPin size={12} color="#059669" />
                <span>{data.branch_name}</span>
                {data.distance !== null && data.distance !== undefined && (
                  <span className="scan-distance-chip">
                    Verified {Math.round(data.distance)}m
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="scan-success-meta-grid">
          <div className="scan-meta-box">
            <div className="scan-meta-box-label">
              <IconClock size={12} color="#64748b" />
              <span>TIME / ម៉ោង</span>
            </div>
            <div className="scan-meta-box-val highlight-time">
              {data.time || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
          </div>

          <div className="scan-meta-box">
            <div className="scan-meta-box-label">
              <IconCalendar size={12} color="#64748b" />
              <span>DATE / កាលបរិច្ឆេទ</span>
            </div>
            <div className="scan-meta-box-val">
              {data.date || new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Punctuality Status Banner */}
        <div className={`scan-punctuality-card ${data.isLate ? 'card-late' : 'card-ontime'}`}>
          <div className="scan-punctuality-icon">
            {data.isLate ? <IconAlertTriangle size={20} color="#dc2626" /> : <IconTarget size={20} color="#059669" />}
          </div>
          <div className="scan-punctuality-info">
            <div className="scan-punctuality-title">
              {data.isLate ? 'Late Arrival Recorded' : 'Punctual • Good Standing'}
            </div>
            <div className="scan-punctuality-sub">
              {data.isLate
                ? `${formatLateDuration(data.lateMins || 1, true)} past scheduled grace period`
                : 'Punctuality rate and record updated in HR system'}
            </div>
          </div>
        </div>

        {/* Dismiss Button with Auto-Close Countdown */}
        <div className="scan-success-footer">
          <button
            type="button"
            className="scan-success-done-btn"
            onClick={onClose}
          >
            <span>Done / រួចរាល់ ({secondsRemaining}s)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
