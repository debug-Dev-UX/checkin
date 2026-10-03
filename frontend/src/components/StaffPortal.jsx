import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import jsQR from 'jsqr'
import {
  IconCamera,
  IconCheck,
  IconClock,
  IconCalendar,
  IconLogOut,
  IconUserCircle,
  IconRefresh,
  IconQrCode,
  IconPrinter,
  IconTrophy,
  IconUsers
} from '../Icons'
import { Skeleton } from './Skeleton'
import {
  getCheckinsFromFirebase,
  getStaffDayoffsFromFirebase,
  createCheckinInFirebase,
  checkoutInFirebase
} from '../services/firebaseService'

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
  const [activeTab, setActiveTab] = useState('clock') // 'clock' | 'schedule' | 'history' | 'badge'
  const [dayoffFilter, setDayoffFilter] = useState('all') // 'all' | 'upcoming' | 'past'

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

  // Live Elapsed Shift Timer calculation
  const elapsedShiftTime = useMemo(() => {
    if (!activeCheckin || !activeCheckin.check_in_at) return null
    const start = new Date(activeCheckin.check_in_at)
    const diff = Math.max(0, Math.floor((currentTime - start) / 1000))
    const hours = Math.floor(diff / 3600)
    const mins = Math.floor((diff % 3600) / 60)
    const secs = diff % 60
    return `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
  }, [activeCheckin, currentTime])

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [currentTime])

  // Fetch staff's current shift status and dayoffs
  const fetchStaffStatus = useCallback(async () => {
    if (!staffUser || !staffUser.id) return
    setLoading(true)
    try {
      // 1. Fetch checkins to find active shift and history
      const allCheckins = await getCheckinsFromFirebase()
      const userRecords = (allCheckins || []).filter(
        c => c.staff_id === staffUser.id || c.email === staffUser.email || c.name === staffUser.name
      )
      const currentActive = userRecords.find(c => c.status === 'checked_in')
      setActiveCheckin(currentActive || null)
      setRecentLogs(userRecords)

      // 2. Fetch staff's assigned dayoffs
      const userDayoffs = await getStaffDayoffsFromFirebase(staffUser.id)
      setDayoffs(userDayoffs || [])
    } catch {
      // quiet catch
    } finally {
      setLoading(false)
    }
  }, [staffUser])

  useEffect(() => {
    fetchStaffStatus()
  }, [fetchStaffStatus])

  // Today ISO date string
  const todayStr = new Date().toISOString().split('T')[0]
  const todayDayoff = dayoffs.find(d => String(d.date).substring(0, 10) === todayStr)

  // Calculate staff punctuality statistics
  const punctualityStats = useMemo(() => {
    const completed = recentLogs.filter(l => l.type === 'employee')
    if (completed.length === 0) return { rate: 100, onTime: 0, late: 0, total: 0 }
    const late = completed.filter(l => l.punctuality_status === 'late').length
    const onTime = completed.length - late
    const rate = Math.round((onTime / completed.length) * 100)
    return { rate, onTime, late, total: completed.length }
  }, [recentLogs])

  // Filtered dayoffs
  const filteredDayoffs = useMemo(() => {
    return dayoffs.filter(item => {
      const isPast = String(item.date).substring(0, 10) < todayStr
      const isUpcoming = String(item.date).substring(0, 10) >= todayStr
      if (dayoffFilter === 'upcoming') return isUpcoming
      if (dayoffFilter === 'past') return isPast
      return true
    })
  }, [dayoffs, dayoffFilter, todayStr])

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
          department: staffUser.role || 'Service Team',
          badge_no: `STAFF-${staffUser.id || 'MEM'}`,
          location: 'Staff Mobile Portal',
          note: todayDayoff
            ? `Clocked in on Day Off (${todayDayoff.type})`
            : 'Clocked in via Staff Badge Scan',
        }

        const newRecord = await createCheckinInFirebase(payload)

        playSuccessBeep()
        setActionResult({
          type: 'success',
          action: 'Shift Started Successfully!',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: newRecord?.punctuality_status === 'on_time' ? 'On-Time (Good Standing ✓)' : 'Late Arrival ⚠️',
        })
        if (showToast) showToast(`Clocked in! Welcome, ${staffUser.name}`, 'success')
      } else {
        // CLOCK OUT
        await checkoutInFirebase(activeCheckin.id)

        playSuccessBeep()
        setActionResult({
          type: 'success',
          action: 'Shift Completed Successfully!',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Shift Logged to Timesheet ✓',
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

  // Get initials for profile badge
  const initials = useMemo(() => {
    if (!staffUser?.name) return 'ST'
    return staffUser.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }, [staffUser?.name])

  // QR code image URL for digital badge
  const qrBadgeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=STAFF-${encodeURIComponent(staffUser?.id || staffUser?.username || 'STAFF')}&color=0f172a&bgcolor=ffffff`

  const handlePrintTimesheet = () => {
    window.print()
  }

  return (
    <div className="pro-staff-portal">
      {/* ============================================================== */}
      {/* 1. PROFESSIONAL TOP NAVBAR */}
      {/* ============================================================== */}
      <header className="pro-staff-nav">
        <div className="pro-staff-brand-box">
          <div className="pro-brand-logo">
            <span className="pro-brand-name">Chafé</span>
            <span className="pro-brand-tag">EMPLOYEE</span>
          </div>
          <span className="pro-portal-label">Staff Workspace</span>
        </div>

        <div className="pro-staff-nav-right">
          <div className="pro-nav-user-pill">
            <div className="pro-user-avatar">{initials}</div>
            <div className="pro-user-info-text">
              <span className="pro-user-name">{staffUser?.name}</span>
              <span className="pro-user-role">{staffUser?.role || 'Team Member'}</span>
            </div>
          </div>

          <button
            type="button"
            className="pro-btn-signout"
            onClick={onLogout}
            title="Sign out of employee portal"
          >
            <IconLogOut size={15} />
            <span className="signout-label">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. HERO GREETING & PROFILE BANNER */}
      {/* ============================================================== */}
      <section className="pro-staff-hero">
        <div className="pro-staff-hero-glow"></div>
        <div className="pro-staff-hero-inner">
          <div className="pro-hero-profile">
            <div className="pro-hero-avatar-ring">
              <div className="pro-hero-avatar">{initials}</div>
              {activeCheckin && <span className="pro-avatar-live-dot" title="Active on shift"></span>}
            </div>

            <div className="pro-hero-meta">
              <div className="pro-hero-greeting-line">
                <span className="pro-hero-greeting">{greeting}, {staffUser?.name?.split(' ')[0] || 'Team'}</span>
                <span className={`pro-shift-status-pill ${activeCheckin ? 'status-active' : 'status-off'}`}>
                  {activeCheckin ? '● ON SHIFT' : '○ OFF DUTY'}
                </span>
              </div>
              <h1 className="pro-hero-full-name">{staffUser?.name}</h1>
              <div className="pro-hero-tags">
                <span className="pro-tag role-tag">☕ {staffUser?.role || 'Staff'}</span>
                <span className="pro-tag id-tag">ID: STAFF-{String(staffUser?.id || '').slice(-6).toUpperCase()}</span>
                <span className="pro-tag shift-tag">Shift: {staffUser?.shift_start || '07:30'} - {staffUser?.shift_end || '16:00'}</span>
              </div>
            </div>
          </div>

          <div className="pro-hero-quick-actions">
            <button
              type="button"
              className="pro-hero-action-btn"
              onClick={fetchStaffStatus}
              title="Sync live status with cloud"
            >
              <IconRefresh size={14} />
              <span>Sync Cloud</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="pro-portal-container">
        {/* Scheduled Day Off Banner (if applicable today) */}
        {todayDayoff && (
          <div className="pro-dayoff-alert-banner">
            <div className="pro-dayoff-icon">🌴</div>
            <div className="pro-dayoff-info">
              <h3>TODAY IS YOUR SCHEDULED DAY OFF ({todayDayoff.type.replace('_', ' ').toUpperCase()})</h3>
              <p>
                Reason: <strong>{todayDayoff.reason || 'Rest & Recharge'}</strong>. You are scheduled off duty today.
                You may still clock in below if you are covering an extra shift.
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. TOP 4 KPI CARDS */}
        {/* ============================================================== */}
        <section className="pro-kpi-grid">
          {/* Card 1: Shift Status & Elapsed Timer */}
          <div className={`pro-kpi-card ${activeCheckin ? 'active-kpi' : ''}`}>
            <div className="pro-kpi-header">
              <span className="pro-kpi-title">CURRENT SHIFT STATUS</span>
              <div className={`pro-kpi-badge ${activeCheckin ? 'badge-emerald' : 'badge-slate'}`}>
                {activeCheckin ? 'ACTIVE' : 'IDLE'}
              </div>
            </div>
            <div className="pro-kpi-value-row">
              <span className="pro-kpi-main-val">
                {activeCheckin ? elapsedShiftTime : 'Off Duty'}
              </span>
            </div>
            <div className="pro-kpi-footer-note">
              {activeCheckin
                ? `Clocked in at ${new Date(activeCheckin.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : `Next regular shift: ${staffUser?.shift_start || '07:30'}`}
            </div>
          </div>

          {/* Card 2: Today's Schedule */}
          <div className="pro-kpi-card">
            <div className="pro-kpi-header">
              <span className="pro-kpi-title">TODAY'S SCHEDULE</span>
              <IconCalendar size={18} color="#0284c7" />
            </div>
            <div className="pro-kpi-value-row">
              <span className="pro-kpi-main-val">
                {todayDayoff ? '🌴 Day Off' : `${staffUser?.shift_start || '07:30'} - ${staffUser?.shift_end || '16:00'}`}
              </span>
            </div>
            <div className="pro-kpi-footer-note">
              {todayDayoff ? `${todayDayoff.type.replace('_', ' ').toUpperCase()}` : 'Standard Working Shift'}
            </div>
          </div>

          {/* Card 3: Punctuality Record */}
          <div className="pro-kpi-card">
            <div className="pro-kpi-header">
              <span className="pro-kpi-title">PUNCTUALITY RATING</span>
              <IconTrophy size={18} color="#f59e0b" />
            </div>
            <div className="pro-kpi-value-row">
              <span className="pro-kpi-main-val">{punctualityStats.rate}%</span>
              <span className="pro-kpi-sub-text">On-Time</span>
            </div>
            <div className="pro-kpi-footer-note">
              {punctualityStats.late === 0
                ? '⭐ Perfect on-time attendance'
                : `${punctualityStats.late} late arrival(s) recorded`}
            </div>
          </div>

          {/* Card 4: Monthly Shift Count */}
          <div className="pro-kpi-card">
            <div className="pro-kpi-header">
              <span className="pro-kpi-title">TOTAL SHIFTS LOGGED</span>
              <IconClock size={18} color="#8b5cf6" />
            </div>
            <div className="pro-kpi-value-row">
              <span className="pro-kpi-main-val">{punctualityStats.total}</span>
              <span className="pro-kpi-sub-text">Shifts</span>
            </div>
            <div className="pro-kpi-footer-note">
              Logged in verified attendance history
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 4. PROFESSIONAL NAVIGATION TABS */}
        {/* ============================================================== */}
        <nav className="pro-tabs-nav">
          <button
            type="button"
            className={`pro-tab-btn ${activeTab === 'clock' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('clock')}
          >
            <span className="tab-icon">⚡</span>
            <span>Clock In / Out</span>
          </button>

          <button
            type="button"
            className={`pro-tab-btn ${activeTab === 'schedule' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <span className="tab-icon">🌴</span>
            <span>My Schedule & Leaves ({dayoffs.length})</span>
          </button>

          <button
            type="button"
            className={`pro-tab-btn ${activeTab === 'history' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="tab-icon">📜</span>
            <span>Shift History & Timesheet</span>
          </button>

          <button
            type="button"
            className={`pro-tab-btn ${activeTab === 'badge' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('badge')}
          >
            <span className="tab-icon">🪪</span>
            <span>Digital ID Badge</span>
          </button>
        </nav>

        {/* ============================================================== */}
        {/* 5. TAB 1: CLOCK IN / OUT CENTER */}
        {/* ============================================================== */}
        {activeTab === 'clock' && (
          <div className="pro-tab-content-grid">
            {/* Left: Clock Terminal Card */}
            <div className="pro-card pro-clock-card">
              <div className="pro-card-header">
                <div>
                  <h2 className="pro-card-title">ATTENDANCE TERMINAL</h2>
                  <p className="pro-card-subtitle">Real-time cloud timestamp verification</p>
                </div>
                <div className="pro-live-indicator">
                  <span className="live-pulse-dot"></span>
                  <span>LIVE SYSTEM</span>
                </div>
              </div>

              {/* Digital LED Clock Display */}
              <div className="pro-digital-clock-display">
                <div className="clock-led-time">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="clock-led-date">
                  {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* Active Shift Details Card if clocked in */}
              {activeCheckin && (
                <div className="pro-active-session-banner">
                  <div className="session-banner-top">
                    <span className="session-badge">🟢 ON SHIFT SESSION ACTIVE</span>
                    <span className="session-timer-live">{elapsedShiftTime}</span>
                  </div>
                  <div className="session-meta-row">
                    <div>
                      <span className="meta-label">CLOCKED IN AT</span>
                      <strong className="meta-val">
                        {new Date(activeCheckin.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                    <div>
                      <span className="meta-label">PUNCTUALITY</span>
                      <strong className={`meta-val ${activeCheckin.punctuality_status === 'on_time' ? 'text-emerald' : 'text-amber'}`}>
                        {activeCheckin.punctuality_status === 'on_time' ? 'On-Time (Good Standing ✓)' : `Late by ${activeCheckin.late_minutes} min`}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Result Notification */}
              {actionResult && (
                <div className={`pro-action-alert ${actionResult.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                  <div className="alert-icon-box">{actionResult.type === 'success' ? '✓' : '⚠️'}</div>
                  <div className="alert-content">
                    <strong>{actionResult.action || actionResult.message}</strong>
                    {actionResult.status && <div>{actionResult.status} at {actionResult.time}</div>}
                  </div>
                </div>
              )}

              {/* Badge Scanning Instruction Card */}
              <div className="pro-terminal-scan-guide">
                <div className="pro-scan-guide-card">
                  <div className="pro-scan-guide-icon">🪪</div>
                  <div className="pro-scan-guide-body">
                    <h4 className="pro-scan-guide-title">
                      {activeCheckin ? 'Ready to Clock Out?' : 'Attendance via QR Badge Pass'}
                    </h4>
                    <p className="pro-scan-guide-desc">
                      Present your personal Digital ID QR Pass at the entrance terminal scanner, or use the camera scanner below.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="pro-btn-quick-badge"
                  onClick={() => setActiveTab('badge')}
                >
                  <span>View My Digital ID QR Pass</span>
                  <span style={{ fontSize: '15px' }}>→</span>
                </button>
              </div>

              {/* Camera Scanner Toggle */}
              <div className="pro-camera-toggle-section">
                <button
                  type="button"
                  className="pro-btn-camera-toggle"
                  onClick={() => setShowCamera(!showCamera)}
                >
                  <IconCamera size={16} />
                  <span>{showCamera ? 'Close Badge Camera Scanner' : 'Scan Badge with Camera'}</span>
                </button>

                {showCamera && (
                  <div className="pro-camera-stream-wrapper">
                    <video ref={videoRef} playsInline muted className="pro-camera-video" />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="pro-camera-hint">
                      Hold your Staff QR Code in front of the lens to auto clock
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Schedule & Today Summary */}
            <div className="pro-side-column">
              {/* Today's Shift Card */}
              <div className="pro-card">
                <div className="pro-card-header">
                  <h3 className="pro-card-title">TODAY'S SHIFT OVERVIEW</h3>
                  <IconClock size={16} color="#0284c7" />
                </div>
                <div className="pro-card-body">
                  <div className="pro-info-row">
                    <span className="info-label">Assigned Shift</span>
                    <span className="info-value font-bold">⏰ {staffUser?.shift_start || '07:30'} - {staffUser?.shift_end || '16:00'}</span>
                  </div>
                  <div className="pro-info-row">
                    <span className="info-label">Department</span>
                    <span className="info-value">{staffUser?.role || 'Service Counter'}</span>
                  </div>
                  <div className="pro-info-row">
                    <span className="info-label">Hourly Compensation</span>
                    <span className="info-value font-bold text-emerald">${Number(staffUser?.hourly_rate || 20).toFixed(2)}/hr</span>
                  </div>
                  <div className="pro-info-row">
                    <span className="info-label">Day Off Today</span>
                    <span className="info-value">
                      {todayDayoff ? (
                        <span className="pro-badge badge-amber">🌴 {todayDayoff.type.replace('_', ' ').toUpperCase()}</span>
                      ) : (
                        <span className="pro-badge badge-emerald">On Schedule</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent 3 Shifts summary */}
              <div className="pro-card">
                <div className="pro-card-header">
                  <h3 className="pro-card-title">RECENT SHIFTS</h3>
                  <button
                    type="button"
                    className="pro-link-btn"
                    onClick={() => setActiveTab('history')}
                  >
                    View All →
                  </button>
                </div>
                <div className="pro-card-body">
                  {recentLogs.slice(0, 3).length === 0 ? (
                    <div className="pro-empty-card-msg">No recent shift logs recorded yet.</div>
                  ) : (
                    <div className="pro-recent-logs-list">
                      {recentLogs.slice(0, 3).map((log) => (
                        <div key={log.id} className="pro-log-item">
                          <div>
                            <div className="pro-log-date">
                              {log.check_in_at ? new Date(log.check_in_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Shift'}
                            </div>
                            <div className="pro-log-times">
                              {log.check_in_at ? new Date(log.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                              {log.check_out_at && ` → ${new Date(log.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            </div>
                          </div>
                          <div className="pro-log-status-right">
                            <span className={`pro-badge ${log.status === 'checked_in' ? 'badge-emerald' : 'badge-slate'}`}>
                              {log.status === 'checked_in' ? 'Active' : 'Completed'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 6. TAB 2: MY SCHEDULE & DAYS OFF */}
        {/* ============================================================== */}
        {activeTab === 'schedule' && (
          <div className="pro-card">
            <div className="pro-card-header">
              <div>
                <h2 className="pro-card-title">MY SCHEDULED DAYS OFF & VACATIONS</h2>
                <p className="pro-card-subtitle">Approved leaves and rest days assigned by management</p>
              </div>
              <div className="pro-filter-pills">
                <button
                  type="button"
                  className={`pro-filter-pill ${dayoffFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setDayoffFilter('all')}
                >
                  All ({dayoffs.length})
                </button>
                <button
                  type="button"
                  className={`pro-filter-pill ${dayoffFilter === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setDayoffFilter('upcoming')}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  className={`pro-filter-pill ${dayoffFilter === 'past' ? 'active' : ''}`}
                  onClick={() => setDayoffFilter('past')}
                >
                  Past
                </button>
              </div>
            </div>

            <div className="pro-card-body">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Skeleton width="100%" height="48px" borderRadius="8px" />
                  <Skeleton width="100%" height="48px" borderRadius="8px" />
                </div>
              ) : filteredDayoffs.length === 0 ? (
                <div className="pro-empty-placeholder">
                  <div className="empty-icon">🌴</div>
                  <h3>No Scheduled Days Off Found</h3>
                  <p>You currently do not have any {dayoffFilter !== 'all' ? dayoffFilter : ''} days off assigned.</p>
                  <p className="sub">Contact your manager if you need to schedule leave or swap days off.</p>
                </div>
              ) : (
                <div className="pro-dayoffs-grid">
                  {filteredDayoffs.map((item) => {
                    const isToday = String(item.date).substring(0, 10) === todayStr
                    const isPast = String(item.date).substring(0, 10) < todayStr

                    return (
                      <div key={item.id} className={`pro-dayoff-card ${isToday ? 'card-today-glow' : ''}`}>
                        <div className="dayoff-card-top">
                          <span className="dayoff-type-icon">
                            {item.type === 'annual_leave' ? '🏖️' : item.type === 'sick_leave' ? '🏥' : item.type === 'holiday' ? '🌟' : '🌴'}
                          </span>
                          <span className={`pro-badge ${isToday ? 'badge-emerald' : isPast ? 'badge-slate' : 'badge-blue'}`}>
                            {isToday ? 'TODAY' : isPast ? 'COMPLETED' : 'UPCOMING'}
                          </span>
                        </div>
                        <div className="dayoff-card-date">
                          {new Date(item.date + 'T00:00:00').toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="dayoff-card-type-name">
                          {item.type.replace('_', ' ').toUpperCase()}
                        </div>
                        <div className="dayoff-card-reason">
                          {item.reason || 'Scheduled Rest & Recreation'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 7. TAB 3: SHIFT HISTORY & TIMESHEET */}
        {/* ============================================================== */}
        {activeTab === 'history' && (
          <div className="pro-card">
            <div className="pro-card-header">
              <div>
                <h2 className="pro-card-title">MY SHIFT HISTORY & ATTENDANCE LOGS</h2>
                <p className="pro-card-subtitle">Verified cloud attendance records</p>
              </div>
              <button
                type="button"
                className="pro-btn-secondary"
                onClick={handlePrintTimesheet}
                title="Print timesheet"
              >
                <IconPrinter size={15} />
                <span>Print Timesheet</span>
              </button>
            </div>

            <div className="pro-card-body">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Skeleton width="100%" height="40px" borderRadius="6px" />
                  <Skeleton width="100%" height="40px" borderRadius="6px" />
                  <Skeleton width="100%" height="40px" borderRadius="6px" />
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="pro-empty-placeholder">
                  <div className="empty-icon">📜</div>
                  <h3>No Shift History Recorded</h3>
                  <p>When you clock in and out, your verified shift hours will be automatically recorded here.</p>
                </div>
              ) : (
                <div className="pro-table-wrapper">
                  <table className="pro-timesheet-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>CLOCK IN</th>
                        <th>CLOCK OUT</th>
                        <th>DEPARTMENT / LOCATION</th>
                        <th>STATUS</th>
                        <th>PUNCTUALITY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((log) => {
                        const inDate = log.check_in_at ? new Date(log.check_in_at) : null
                        const outDate = log.check_out_at ? new Date(log.check_out_at) : null

                        return (
                          <tr key={log.id}>
                            <td className="font-bold">
                              {inDate ? inDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                            </td>
                            <td>
                              {inDate ? inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td>
                              {outDate ? outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                                <span className="text-emerald font-bold">Active Now</span>
                              )}
                            </td>
                            <td>{log.department || 'Service Team'} • {log.location || 'Terminal'}</td>
                            <td>
                              <span className={`pro-badge ${log.status === 'checked_in' ? 'badge-emerald' : 'badge-slate'}`}>
                                {log.status === 'checked_in' ? 'Active' : 'Completed'}
                              </span>
                            </td>
                            <td>
                              <span className={`pro-badge ${log.punctuality_status === 'on_time' ? 'badge-emerald' : 'badge-amber'}`}>
                                {log.punctuality_status === 'on_time' ? '✓ On-Time' : `⚠️ Late (${log.late_minutes}m)`}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 8. TAB 4: DIGITAL ID BADGE */}
        {/* ============================================================== */}
        {activeTab === 'badge' && (
          <div className="pro-badge-tab-container">
            <div className="pro-id-badge-card">
              <div className="id-badge-top-banner">
                <span className="id-badge-brand">CHAFÉ SPECIALTY COFFEE</span>
                <span className="id-badge-chip">STAFF PASS</span>
              </div>

              <div className="id-badge-body">
                <div className="id-badge-avatar-wrap">
                  <div className="id-badge-avatar">{initials}</div>
                </div>

                <h3 className="id-badge-name">{staffUser?.name}</h3>
                <div className="id-badge-role">{staffUser?.role || 'Staff Member'}</div>
                <div className="id-badge-code">STAFF ID: #{String(staffUser?.id || '').slice(-6).toUpperCase()}</div>

                <div className="id-badge-qr-box">
                  <img
                    src={qrBadgeUrl}
                    alt={`Staff QR Badge for ${staffUser?.name}`}
                    className="id-badge-qr-image"
                  />
                  <span className="id-badge-qr-caption">1-Tap Scan Code</span>
                </div>

                <div className="id-badge-footer">
                  <p>Hold this badge against the entrance terminal or counter scanner to verify your shift attendance.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
