import { useState, useEffect, useCallback, useRef } from 'react'
import jsQR from 'jsqr'
import {
  IconCamera,
  IconCheck,
  IconClock,
  IconCalendar,
  IconLogOut,
  IconUserCircle,
  IconRefresh
} from '../Icons'
import { Skeleton } from './Skeleton'

function playSuccessBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // quiet catch
  }
}

export default function StaffPortal({
  apiBase,
  staffUser,
  onLogout,
  showToast,
}) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeCheckin, setActiveCheckin] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [dayoffs, setDayoffs] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [actionResult, setActionResult] = useState(null)

  // Camera QR scanner optional toggle
  const [showCamera, setShowCamera] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameIdRef = useRef(null)
  const streamRef = useRef(null)

  // Live Digital Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch staff's current shift status and dayoffs
  const fetchStaffStatus = useCallback(async () => {
    if (!staffUser || !staffUser.id) return
    setLoading(true)
    try {
      // 1. Fetch checkins to find active shift
      const checkinRes = await fetch(`${apiBase}/checkins`)
      if (checkinRes.ok) {
        const json = await checkinRes.json()
        const userRecords = (json.data || []).filter(
          c => c.staff_id === staffUser.id || c.email === staffUser.email || c.name === staffUser.name
        )
        const currentActive = userRecords.find(c => c.status === 'checked_in')
        setActiveCheckin(currentActive || null)
        setRecentLogs(userRecords.slice(0, 5))
      }

      // 2. Fetch staff's assigned dayoffs
      const dayoffRes = await fetch(`${apiBase}/staff/${staffUser.id}/dayoffs`)
      if (dayoffRes.ok) {
        const dayoffJson = await dayoffRes.json()
        setDayoffs(dayoffJson.data || [])
      }
    } catch {
      // quiet catch
    } finally {
      setLoading(false)
    }
  }, [apiBase, staffUser])

  useEffect(() => {
    fetchStaffStatus()
  }, [fetchStaffStatus])

  // Today ISO date string
  const todayStr = new Date().toISOString().split('T')[0]
  const todayDayoff = dayoffs.find(d => String(d.date).substring(0, 10) === todayStr)

  // Execute Clock In / Clock Out
  const handleClockAction = async () => {
    setProcessing(true)
    setActionResult(null)

    try {
      if (!activeCheckin) {
        // CLOCK IN
        const payload = {
          staff_id: staffUser.id,
          name: staffUser.name,
          email: staffUser.email,
          type: 'employee',
          department: staffUser.role || 'Barista',
          badge_no: `STAFF-${staffUser.id}`,
          location: 'Staff Portal Terminal',
          note: todayDayoff ? `Clocked in on Day Off (${todayDayoff.type})` : 'Clocked in via Staff Portal',
        }

        const res = await fetch(`${apiBase}/checkins`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const json = await res.json()
        if (!res.ok) throw new Error(json.message || 'Clock in failed')

        playSuccessBeep()
        setActionResult({
          type: 'success',
          action: 'Clocked In Successfully!',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: json.data?.punctuality_status === 'on_time' ? 'On-Time (Good Standing ✓)' : 'Late Arrival ⚠️',
        })
        if (showToast) showToast(`Clocked in! Welcome, ${staffUser.name}`, 'success')
      } else {
        // CLOCK OUT
        const res = await fetch(`${apiBase}/checkins/${activeCheckin.id}/checkout`, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
        })

        const json = await res.json()
        if (!res.ok) throw new Error(json.message || 'Clock out failed')

        playSuccessBeep()
        setActionResult({
          type: 'success',
          action: 'Clocked Out Successfully!',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Shift Completed',
        })
        if (showToast) showToast(`Shift completed! Great job today, ${staffUser.name}!`, 'success')
      }

      await fetchStaffStatus()
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err.message || 'Operation failed',
      })
      if (showToast) showToast(err.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  // Camera functions
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
      }
    } catch (err) {
      if (showToast) showToast('Could not start camera: ' + err.message, 'error')
      setShowCamera(false)
    }
  }, [showToast, stopCamera])

  useEffect(() => {
    if (showCamera) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [showCamera, startCamera, stopCamera])

  // Continuous frame loop with jsQR for QR scan
  useEffect(() => {
    if (!cameraActive) return

    const tick = () => {
      if (
        videoRef.current &&
        videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
        canvasRef.current
      ) {
        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code && code.data) {
          // Scanned QR code
          handleClockAction()
          setShowCamera(false)
          return
        }
      }
      animFrameIdRef.current = requestAnimationFrame(tick)
    }

    animFrameIdRef.current = requestAnimationFrame(tick)
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current)
        animFrameIdRef.current = null
      }
    }
  }, [cameraActive])

  return (
    <div className="staff-portal-page">
      {/* Top Navbar */}
      <header className="staff-portal-nav">
        <div className="staff-portal-brand">
          <div className="login-logo-badge" style={{ padding: '4px 8px' }}>
            <span className="login-logo-text" style={{ fontSize: '15px' }}>Chafé</span>
            <span className="login-logo-tag" style={{ fontSize: '10px' }}>STAFF</span>
          </div>
          <span className="staff-portal-title">Employee Portal</span>
        </div>

        <div className="staff-portal-user-meta">
          <div className="user-avatar-circle" style={{ width: '34px', height: '34px' }}>
            <IconUserCircle size={22} color="#0284c7" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{staffUser?.name}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {staffUser?.role} • @{staffUser?.username || 'staff'}
            </div>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={onLogout}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginLeft: '12px' }}
          >
            <IconLogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="staff-portal-content">
        {/* Banner: If Today is Assigned Day Off */}
        {todayDayoff && (
          <div className="staff-dayoff-banner">
            <div className="dayoff-banner-icon">🌴</div>
            <div className="dayoff-banner-text">
              <h4>TODAY IS YOUR SCHEDULED DAY OFF ({todayDayoff.type.toUpperCase().replace('_', ' ')})</h4>
              <p>
                Reason: <strong>{todayDayoff.reason || 'Rest Day'}</strong>. You are scheduled off duty today.
                You can still clock in below if covering a shift.
              </p>
            </div>
          </div>
        )}

        <div className="staff-portal-grid">
          {/* Left Column: Shift Check In / Out Card */}
          <div className="content-panel staff-action-panel">
            <div className="panel-header-bar">
              <div className="panel-heading-title">MY SHIFT ATTENDANCE</div>
              <button className="panel-gear-btn" onClick={fetchStaffStatus} title="Refresh status">
                <IconRefresh size={14} />
              </button>
            </div>

            <div style={{ padding: '24px', textAlign: 'center' }}>
              {/* Digital Clock */}
              <div className="portal-digital-clock">
                <div className="clock-time">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="clock-date">
                  {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* Shift Hours info */}
              <div className="portal-shift-meta-box">
                <div className="shift-meta-item">
                  <span className="shift-meta-label">SCHEDULED SHIFT</span>
                  <strong className="shift-meta-val">
                    ⏰ {staffUser?.shift_start || '07:30'} - {staffUser?.shift_end || '16:00'}
                  </strong>
                </div>

                <div className="shift-meta-item">
                  <span className="shift-meta-label">CURRENT STATUS</span>
                  <span className={`badge-status-pill ${activeCheckin ? 'green' : 'blue'}`}>
                    {activeCheckin ? '🟢 Active On Shift' : '⚪ Off Duty'}
                  </span>
                </div>
              </div>

              {/* Active check-in details if clocked in */}
              {activeCheckin && (
                <div className="active-shift-details-card">
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#047857' }}>
                    Clocked in at {new Date(activeCheckin.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#065f46', marginTop: '4px' }}>
                    Punctuality: {activeCheckin.punctuality_status === 'on_time' ? 'On-Time (Good Standing ✓)' : `Late Arrival (${activeCheckin.late_minutes} min late)`}
                  </div>
                </div>
              )}

              {/* Action Result Notification */}
              {actionResult && (
                <div
                  className={`portal-alert ${actionResult.type === 'success' ? 'success' : 'error'}`}
                  style={{ margin: '16px 0', padding: '12px', borderRadius: '8px' }}
                >
                  <strong>{actionResult.action || actionResult.message}</strong>
                  {actionResult.status && <div>{actionResult.status} at {actionResult.time}</div>}
                </div>
              )}

              {/* Big Interactive 1-Tap Clock Button */}
              <div style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className={`btn-giant-clock ${activeCheckin ? 'checkout-mode' : 'checkin-mode'}`}
                  onClick={handleClockAction}
                  disabled={processing}
                >
                  <div className="giant-btn-inner">
                    <span className="giant-btn-icon">
                      {activeCheckin ? '🛑' : '☕'}
                    </span>
                    <span className="giant-btn-title">
                      {processing
                        ? 'Processing...'
                        : activeCheckin
                        ? 'TAP TO CLOCK OUT'
                        : 'TAP TO CLOCK IN'}
                    </span>
                    <span className="giant-btn-subtitle">
                      {activeCheckin
                        ? 'Finish your shift & log checkout time'
                        : `Start shift as ${staffUser?.role}`}
                    </span>
                  </div>
                </button>
              </div>

              {/* Optional Camera Scanner Toggle */}
              <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                  onClick={() => setShowCamera(!showCamera)}
                >
                  <IconCamera size={15} />
                  <span>{showCamera ? 'Hide Camera QR Scanner' : 'Use Camera QR Scanner'}</span>
                </button>

                {showCamera && (
                  <div style={{ marginTop: '12px', position: 'relative', maxWidth: '320px', margin: '12px auto' }}>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      style={{ width: '100%', borderRadius: '12px', border: '2px solid #0284c7' }}
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                      Show your Staff QR code badge to the camera
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Scheduled Days Off & Recent Shifts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Scheduled Days Off Card */}
            <div className="content-panel">
              <div className="panel-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconCalendar size={16} color="#0f172a" />
                  <div className="panel-heading-title">MY SCHEDULED DAYS OFF & VACATIONS</div>
                </div>
                <span className="badge-status-pill blue">{dayoffs.length} Scheduled</span>
              </div>

              <div style={{ padding: '16px 20px' }}>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Skeleton width="100%" height="42px" borderRadius="8px" />
                    <Skeleton width="100%" height="42px" borderRadius="8px" />
                  </div>
                ) : dayoffs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                    🌴 No days off scheduled yet. Contact your administrator to assign rest days.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {dayoffs.map((item) => {
                      const isPast = new Date(item.date) < new Date(todayStr)
                      const isToday = String(item.date).substring(0, 10) === todayStr

                      return (
                        <div key={item.id} className={`staff-dayoff-row ${isToday ? 'today-highlight' : ''}`}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="dayoff-icon-circle">
                              {item.type === 'annual_leave' ? '🏖️' : item.type === 'sick_leave' ? '🏥' : '🌴'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                                {item.date} {isToday && '(Today)'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {item.type.replace('_', ' ').toUpperCase()} • {item.reason || 'Rest Day'}
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className={`badge-status-pill ${isToday ? 'green' : isPast ? 'blue' : 'amber'}`}>
                              {isToday ? 'Today' : isPast ? 'Passed' : 'Upcoming'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Shift Activity */}
            <div className="content-panel">
              <div className="panel-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconClock size={16} color="#0f172a" />
                  <div className="panel-heading-title">MY RECENT SHIFT HISTORY</div>
                </div>
              </div>

              <div style={{ padding: '16px 20px' }}>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Skeleton width="100%" height="36px" borderRadius="6px" />
                    <Skeleton width="100%" height="36px" borderRadius="6px" />
                    <Skeleton width="100%" height="36px" borderRadius="6px" />
                  </div>
                ) : recentLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
                    No recent shift logs recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recentLogs.map((log) => (
                      <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>
                        <div>
                          <strong>{log.check_in_at ? new Date(log.check_in_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Shift'}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            In: {log.check_in_at ? new Date(log.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            {log.check_out_at && ` • Out: ${new Date(log.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span className={`badge-status-pill ${log.status === 'checked_in' ? 'green' : 'blue'}`}>
                            {log.status === 'checked_in' ? 'Active' : 'Completed'}
                          </span>
                          <div style={{ fontSize: '10px', color: log.punctuality_status === 'on_time' ? '#10b981' : '#ea580c', marginTop: '2px', fontWeight: 600 }}>
                            {log.punctuality_status === 'on_time' ? 'On-Time' : 'Late'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
