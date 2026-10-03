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
  checkoutInFirebase,
  subscribeToLiveCheckins,
  isTodayRecord
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
  const [activeTab, setActiveTab] = useState('clock') // 'clock' | 'schedule' | 'scan' | 'history' | 'badge'
  const [dayoffFilter, setDayoffFilter] = useState('all') // 'all' | 'upcoming' | 'past'

  // Action Modal State (Popup modal asking Check In or Check Out)
  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedScanAction, setSelectedScanAction] = useState(null) // 'in' | 'out' | null
  const [scannedQrData, setScannedQrData] = useState(null)
  const selectedScanActionRef = useRef(null)
  selectedScanActionRef.current = selectedScanAction

  // Camera QR scanner state - ALWAYS back camera by default
  const [cameraFacing, setCameraFacing] = useState('environment') // 'environment' (back) | 'user' (front)
  const [torchOn, setTorchOn] = useState(false)
  const isScanningRef = useRef(false)
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

  // Real-time live check-ins subscription: automatically updates on any scan from any device
  useEffect(() => {
    if (!staffUser || !staffUser.id) return
    const unsubscribe = subscribeToLiveCheckins((allCheckins) => {
      const userRecords = (allCheckins || []).filter(
        c => c.staff_id === staffUser.id || c.email === staffUser.email || c.name === staffUser.name
      )
      const currentActive = userRecords.find(c => c.status === 'checked_in')
      setActiveCheckin(currentActive || null)
      setRecentLogs(userRecords)
    })
    return () => unsubscribe()
  }, [staffUser])

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

  // Execute explicit Clock In or Clock Out
  const handleExecuteAttendance = async (actionType) => {
    if (processing) return
    setProcessing(true)
    setActionResult(null)

    try {
      if (actionType === 'in') {
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
            : 'Clocked in via Store QR Scan',
        }

        const newRecord = await createCheckinInFirebase(payload)

        playSuccessBeep()
        setActiveCheckin(newRecord)
        setRecentLogs(prev => [newRecord, ...(prev || [])])
        setActionResult({
          type: 'success',
          action: 'Shift Started Successfully! (Clocked In)',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: newRecord?.punctuality_status === 'on_time' ? 'On-Time (Good Standing ✓)' : 'Late Arrival ⚠️',
        })
        if (showToast) showToast(`Clocked in! Welcome, ${staffUser.name}`, 'success')
      } else {
        // CLOCK OUT
        await checkoutInFirebase(activeCheckin?.id, staffUser.id)

        playSuccessBeep()
        setActiveCheckin(null)
        setRecentLogs(prev => (prev || []).map(c => (c.status === 'checked_in' ? { ...c, status: 'checked_out', check_out_at: new Date().toISOString() } : c)))
        setActionResult({
          type: 'success',
          action: 'Shift Completed Successfully! (Clocked Out)',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Shift Logged to Timesheet ✓',
        })
        if (showToast) showToast(`Shift completed! Great job today, ${staffUser.name}!`, 'success')
      }

      await fetchStaffStatus()
      setActiveTab('clock')
      setShowCamera(false)
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err.message || 'Operation failed',
      })
      if (showToast) showToast(err.message, 'error')
    } finally {
      setProcessing(false)
      setShowActionModal(false)
      setSelectedScanAction(null)
      setScannedQrData(null)
    }
  }

  // Open modal helper
  const handleOpenActionModal = (preselected = null) => {
    setSelectedScanAction(preselected)
    setScannedQrData(null)
    setShowActionModal(true)
  }

  // Camera functions - ALWAYS PREFER BACK CAMERA (environment)
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
    setTorchOn(false)
  }, [])

  const startCamera = useCallback(async (facing = cameraFacing) => {
    stopCamera()
    try {
      let stream = null
      // 1. Always attempt back camera first with ideal constraints
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch {
        try {
          // 2. Fallback to exact facingMode string
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing },
            audio: false,
          })
        } catch {
          // 3. Fallback to default available video device (e.g. laptop webcam)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        }
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
      }
    } catch (err) {
      if (showToast) showToast('Could not access back camera: ' + err.message, 'error')
      setCameraActive(false)
      setShowCamera(false)
    }
  }, [cameraFacing, showToast, stopCamera])

  const handleToggleFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment'
    setCameraFacing(nextFacing)
    startCamera(nextFacing)
  }

  const handleToggleTorch = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return
    const capabilities = track.getCapabilities?.() || {}
    if (!capabilities.torch) {
      if (showToast) showToast('Flashlight not supported on this camera lens', 'info')
      return
    }
    try {
      const nextTorch = !torchOn
      await track.applyConstraints({
        advanced: [{ torch: nextTorch }],
      })
      setTorchOn(nextTorch)
    } catch {
      if (showToast) showToast('Could not toggle flashlight', 'error')
    }
  }

  useEffect(() => {
    if (activeTab === 'scan' || showCamera) {
      startCamera(cameraFacing)
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [activeTab, showCamera, cameraFacing, startCamera, stopCamera])

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

        if (code && code.data && !isScanningRef.current) {
          isScanningRef.current = true
          playSuccessBeep()
          if (navigator.vibrate) {
            try { navigator.vibrate([100, 50, 100]) } catch { /* ignore */ }
          }

          const currentAction = selectedScanActionRef.current
          if (currentAction === 'in') {
            handleExecuteAttendance('in')
          } else if (currentAction === 'out') {
            handleExecuteAttendance('out')
          } else {
            // No action was chosen beforehand: pop up modal to ask Check In or Check Out!
            setScannedQrData(code.data)
            setShowActionModal(true)
          }

          setTimeout(() => {
            isScanningRef.current = false
          }, 2500)
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
            className={`pro-tab-btn ${activeTab === 'scan' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('scan')}
          >
            <span className="tab-icon">📷</span>
            <span>Scan (Rear Camera)</span>
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
              {/* Direct Clock In & Clock Out Action Cards */}
              <div className="pro-terminal-scan-guide">
                <div className="pro-direct-clock-cards">
                  <button
                    type="button"
                    className={`pro-direct-action-btn in-btn ${!activeCheckin ? 'highlight' : ''}`}
                    onClick={() => handleOpenActionModal('in')}
                  >
                    <div className="action-btn-circle">🟢</div>
                    <div className="action-btn-text">
                      <span className="action-btn-title">Clock In</span>
                      <span className="action-btn-sub">{!activeCheckin ? 'Ready to Start Shift' : 'Already on Shift'}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`pro-direct-action-btn out-btn ${activeCheckin ? 'highlight' : ''}`}
                    onClick={() => handleOpenActionModal('out')}
                  >
                    <div className="action-btn-circle">🔴</div>
                    <div className="action-btn-text">
                      <span className="action-btn-title">Clock Out</span>
                      <span className="action-btn-sub">{activeCheckin ? 'Complete Shift Now' : 'No Active Shift'}</span>
                    </div>
                  </button>
                </div>

                <div className="pro-scan-actions-grid" style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    className="pro-btn-quick-scan"
                    onClick={() => handleOpenActionModal()}
                  >
                    <IconCamera size={16} />
                    <span>Scan Store QR Code</span>
                  </button>

                  <button
                    type="button"
                    className="pro-btn-quick-badge"
                    onClick={() => setActiveTab('badge')}
                  >
                    <IconQrCode size={16} />
                    <span>View My ID Pass</span>
                  </button>
                </div>

                <div className="pro-camera-hint-footer">
                  <span className="pro-lens-badge">
                    📷 One Universal QR Code: Scan to Check In or Check Out
                  </span>
                </div>
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
        {/* TAB 3: DEDICATED APP CAMERA SCANNER (CENTER SCAN TAB) */}
        {/* ============================================================== */}
        {activeTab === 'scan' && (
          <div className="pro-app-scanner-screen">
            <div className="pro-scanner-card">
              <div className="pro-scanner-header">
                <div className="pro-scanner-header-left">
                  <span className="pro-scanner-title">
                    {selectedScanAction === 'in'
                      ? 'SCAN QR TO CLOCK IN'
                      : selectedScanAction === 'out'
                      ? 'SCAN QR TO CLOCK OUT'
                      : 'CAMERA QR SCANNER'}
                  </span>
                  <span className={`pro-scanner-lens-badge ${selectedScanAction ? 'badge-' + selectedScanAction : ''}`}>
                    {selectedScanAction === 'in'
                      ? '🟢 CHECK IN MODE'
                      : selectedScanAction === 'out'
                      ? '🔴 CHECK OUT MODE'
                      : cameraFacing === 'environment'
                      ? '📷 BACK CAMERA (REAR)'
                      : '🤳 FRONT CAMERA'}
                  </span>
                </div>
                <button
                  type="button"
                  className="pro-btn-scanner-close"
                  onClick={() => setActiveTab('clock')}
                  title="Close scanner"
                >
                  ✕
                </button>
              </div>

              {/* Mode Selector Tabs inside Scanner */}
              <div className="pro-scanner-mode-bar">
                <button
                  type="button"
                  className={`scanner-mode-tab in-tab ${selectedScanAction === 'in' ? 'active-mode' : ''}`}
                  onClick={() => setSelectedScanAction('in')}
                >
                  <span>🟢 Clock In</span>
                </button>
                <button
                  type="button"
                  className={`scanner-mode-tab out-tab ${selectedScanAction === 'out' ? 'active-mode' : ''}`}
                  onClick={() => setSelectedScanAction('out')}
                >
                  <span>🔴 Clock Out</span>
                </button>
                <button
                  type="button"
                  className={`scanner-mode-tab ask-tab ${selectedScanAction === null ? 'active-mode' : ''}`}
                  onClick={() => setSelectedScanAction(null)}
                >
                  <span>❓ Ask on Scan</span>
                </button>
              </div>

              {/* Viewfinder Screen */}
              <div className="pro-viewfinder-wrapper">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="pro-viewfinder-video"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Viewfinder Target Mask */}
                <div className="pro-viewfinder-overlay">
                  <div className={`pro-target-reticle ${selectedScanAction === 'in' ? 'reticle-in' : selectedScanAction === 'out' ? 'reticle-out' : ''}`}>
                    {/* 4 Corner Brackets */}
                    <div className="corner top-left"></div>
                    <div className="corner top-right"></div>
                    <div className="corner bottom-left"></div>
                    <div className="corner bottom-right"></div>

                    {/* Animated Scanning Laser */}
                    <div className="pro-scanning-laser"></div>

                    <div className="pro-reticle-hint">
                      {selectedScanAction === 'in'
                        ? '🟢 Point at Store QR to Clock In'
                        : selectedScanAction === 'out'
                        ? '🔴 Point at Store QR to Clock Out'
                        : 'Align Store QR (Modal will ask Check In or Out)'}
                    </div>
                  </div>
                </div>

                {!cameraActive && (
                  <div className="pro-viewfinder-loading">
                    <div className="pro-spinner"></div>
                    <span>Initializing Back Camera...</span>
                  </div>
                )}
              </div>

              {/* Scanner Control Bar */}
              <div className="pro-scanner-controls">
                <button
                  type="button"
                  className="pro-scanner-ctrl-btn"
                  onClick={handleToggleFacing}
                  title="Flip camera"
                >
                  <IconRefresh size={16} />
                  <span>{cameraFacing === 'environment' ? 'Switch to Front' : 'Switch to Back'}</span>
                </button>

                <button
                  type="button"
                  className={`pro-scanner-ctrl-btn ${torchOn ? 'active' : ''}`}
                  onClick={handleToggleTorch}
                  title="Toggle flashlight"
                >
                  <span>{torchOn ? '🔦 Flash On' : '💡 Flashlight'}</span>
                </button>

                <button
                  type="button"
                  className="pro-scanner-ctrl-btn primary"
                  onClick={() => setActiveTab('badge')}
                  title="Display My ID Pass"
                >
                  <IconQrCode size={16} />
                  <span>Show My Pass</span>
                </button>
              </div>

              {/* Status footer notice */}
              <div className="pro-scanner-footer-notice">
                <div className="notice-icon">⚡</div>
                <div className="notice-text">
                  <strong>
                    {selectedScanAction === 'in'
                      ? '🟢 Check In Mode Active'
                      : selectedScanAction === 'out'
                      ? '🔴 Check Out Mode Active'
                      : '📷 Universal Store QR Scanner'}
                  </strong>
                  <p>
                    {selectedScanAction === 'in'
                      ? 'Point at the store QR code to instantly start your shift.'
                      : selectedScanAction === 'out'
                      ? 'Point at the store QR code to instantly complete your shift.'
                      : 'Scanning the store QR code will popup a modal to ask if you want to Clock In or Clock Out.'}
                  </p>
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

      {/* ============================================================== */}
      {/* 9. MOBILE-FIRST APP BOTTOM DOCK NAVIGATION (MENU BOTTOM SCAN CENTER) */}
      {/* ============================================================== */}
      <nav className="pro-app-bottom-nav">
        <div className="pro-bottom-nav-inner">
          {/* Tab 1: Attendance / Clock */}
          <button
            type="button"
            className={`pro-bottom-nav-btn ${activeTab === 'clock' ? 'active' : ''}`}
            onClick={() => setActiveTab('clock')}
          >
            <div className="bottom-btn-icon-wrap">
              <IconClock size={20} />
            </div>
            <span className="bottom-btn-label">Attendance</span>
          </button>

          {/* Tab 2: Schedule & Leaves */}
          <button
            type="button"
            className={`pro-bottom-nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <div className="bottom-btn-icon-wrap">
              <IconCalendar size={20} />
              {dayoffs.length > 0 && (
                <span className="bottom-btn-badge">{dayoffs.length}</span>
              )}
            </div>
            <span className="bottom-btn-label">Schedule</span>
          </button>

          {/* Tab 3: CENTER SCAN ACTION BUTTON (ELEVATED FAB) */}
          <div className="pro-bottom-scan-fab-wrap">
            <button
              type="button"
              className={`pro-bottom-scan-fab ${activeTab === 'scan' ? 'active-scan' : ''}`}
              onClick={() => handleOpenActionModal()}
              aria-label="Scan QR Code - Check In or Check Out"
            >
              <div className="fab-scan-glow"></div>
              <div className="fab-scan-pulse-ring"></div>
              <div className="fab-scan-core">
                <IconCamera size={26} color="#ffffff" />
                <span className="fab-scan-label">SCAN</span>
              </div>
            </button>
          </div>

          {/* Tab 4: History / Timesheet */}
          <button
            type="button"
            className={`pro-bottom-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <div className="bottom-btn-icon-wrap">
              <span style={{ fontSize: '18px', lineHeight: 1 }}>📜</span>
            </div>
            <span className="bottom-btn-label">Timesheet</span>
          </button>

          {/* Tab 5: Digital ID Badge */}
          <button
            type="button"
            className={`pro-bottom-nav-btn ${activeTab === 'badge' ? 'active' : ''}`}
            onClick={() => setActiveTab('badge')}
          >
            <div className="bottom-btn-icon-wrap">
              <span style={{ fontSize: '18px', lineHeight: 1 }}>🪪</span>
            </div>
            <span className="bottom-btn-label">My Pass</span>
          </button>
        </div>
      </nav>

      {/* ============================================================== */}
      {/* 10. POPUP MODAL: ASK CHECK IN OR CHECK OUT */}
      {/* ============================================================== */}
      {showActionModal && (
        <div className="staff-modal-backdrop" onClick={() => !processing && setShowActionModal(false)}>
          <div
            className="staff-action-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-action-title"
          >
            <div className="staff-modal-header">
              <div className="staff-modal-title-box">
                <span className="staff-modal-badge">
                  {scannedQrData ? '⚡ QR CODE SCANNED' : '📷 STORE QR ATTENDANCE'}
                </span>
                <h3 id="modal-action-title" className="staff-modal-title">
                  {scannedQrData ? 'Choose Attendance Action' : 'Check In or Check Out?'}
                </h3>
                <p className="staff-modal-subtitle">
                  {scannedQrData
                    ? 'QR Code detected! Select whether you are clocking in or clocking out:'
                    : 'The store uses one universal QR code. Choose what you would like to do:'}
                </p>
              </div>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => !processing && setShowActionModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="staff-modal-body">
              {/* Option 1: Clock In Card */}
              <div
                className={`modal-action-card card-in ${!activeCheckin ? 'recommended' : ''}`}
                onClick={() => {
                  if (processing) return
                  if (scannedQrData) {
                    handleExecuteAttendance('in')
                  } else {
                    setSelectedScanAction('in')
                    setShowActionModal(false)
                    setActiveTab('scan')
                  }
                }}
              >
                <div className="action-card-icon-col">
                  <div className="action-icon-circle in-circle">
                    <span style={{ fontSize: '26px' }}>🟢</span>
                  </div>
                </div>
                <div className="action-card-content">
                  <div className="action-card-header">
                    <h4 className="action-card-title">Clock In (Check In)</h4>
                    {!activeCheckin ? (
                      <span className="action-status-pill pill-ready">Ready to Start</span>
                    ) : (
                      <span className="action-status-pill pill-warn">Already In</span>
                    )}
                  </div>
                  <p className="action-card-desc">
                    Start your shift arrival time. Punctuality is automatically verified.
                  </p>
                  <div className="action-card-meta">
                    <span>⏰ Shift: <strong>{staffUser?.shift_start || '07:30'} - {staffUser?.shift_end || '16:00'}</strong></span>
                  </div>
                </div>
                <div className="action-card-arrow">
                  <span className="action-proceed-btn in-btn">
                    {scannedQrData ? 'Confirm In ✓' : 'Scan to In →'}
                  </span>
                </div>
              </div>

              {/* Option 2: Clock Out Card */}
              <div
                className={`modal-action-card card-out ${activeCheckin ? 'recommended' : ''}`}
                onClick={() => {
                  if (processing) return
                  if (scannedQrData) {
                    handleExecuteAttendance('out')
                  } else {
                    setSelectedScanAction('out')
                    setShowActionModal(false)
                    setActiveTab('scan')
                  }
                }}
              >
                <div className="action-card-icon-col">
                  <div className="action-icon-circle out-circle">
                    <span style={{ fontSize: '26px' }}>🔴</span>
                  </div>
                </div>
                <div className="action-card-content">
                  <div className="action-card-header">
                    <h4 className="action-card-title">Clock Out (Check Out)</h4>
                    {activeCheckin ? (
                      <span className="action-status-pill pill-active">Shift Active</span>
                    ) : (
                      <span className="action-status-pill pill-muted">No Shift</span>
                    )}
                  </div>
                  <p className="action-card-desc">
                    Finish your work shift and record your total working hours.
                  </p>
                  <div className="action-card-meta">
                    {activeCheckin ? (
                      <span>🟢 Active Session: <strong>{elapsedShiftTime}</strong></span>
                    ) : (
                      <span>Current status: Not on shift</span>
                    )}
                  </div>
                </div>
                <div className="action-card-arrow">
                  <span className="action-proceed-btn out-btn">
                    {scannedQrData ? 'Confirm Out ✓' : 'Scan to Out →'}
                  </span>
                </div>
              </div>
            </div>

            <div className="staff-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowActionModal(false)}
                disabled={processing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
