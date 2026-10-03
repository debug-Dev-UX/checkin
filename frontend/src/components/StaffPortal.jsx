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
  IconUsers,
  IconDoorIn,
  IconDoorOut,
  IconBell,
  IconPhone,
  IconMenu,
  IconSearch,
  IconHome,
  IconCoffee,
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

  // Mobile App Interface State
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeModal, setActiveModal] = useState(null) // null | 'performance' | 'station' | 'alerts' | 'profile' | 'support'

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

  // Hub items matching 3x3 grid
  const hubItems = useMemo(() => [
    { id: 'roster', title: 'Shift Roster', icon: <IconCalendar size={26} color="#ffffff" />, action: () => setActiveTab('schedule') },
    { id: 'dayoff', title: 'Day Off', icon: <span style={{ fontSize: '24px', lineHeight: 1 }}>🌴</span>, action: () => setActiveTab('schedule') },
    { id: 'perf', title: 'Performance', icon: <IconTrophy size={26} color="#ffffff" />, action: () => setActiveModal('performance') },
    { id: 'logs', title: 'Shift Logs', icon: <IconClock size={26} color="#ffffff" />, action: () => setActiveTab('history') },
    { id: 'station', title: 'Station', icon: <IconCoffee size={26} color="#ffffff" />, action: () => setActiveModal('station') },
    { id: 'badge', title: 'ID Badge', icon: <IconQrCode size={26} color="#ffffff" />, action: () => setActiveTab('badge') },
    { id: 'alerts', title: 'Store Alerts', icon: <IconBell size={26} color="#ffffff" />, action: () => setActiveModal('alerts') },
    { id: 'profile', title: 'My Profile', icon: <IconUserCircle size={26} color="#ffffff" />, action: () => setActiveModal('profile') },
    { id: 'support', title: 'Support', icon: <IconPhone size={24} color="#ffffff" />, action: () => setActiveModal('support') },
  ], [])

  const filteredHubItems = useMemo(() => {
    if (!searchQuery.trim()) return hubItems
    return hubItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [hubItems, searchQuery])

  // Formatted date and time string matching reference screenshot style (e.g. 10.00 am | 27 Nov 2026)
  const formattedShiftDateTime = useMemo(() => {
    const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase().replace(' ', ' ')
    const dateStr = currentTime.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    return `${timeStr} | ${dateStr}`
  }, [currentTime])

  return (
    <div className="mobile-app-layout-wrapper">
      {/* ============================================================== */}
      {/* 1. TOP MOBILE APP BAR (MENU, SEARCH, NOTIFICATION BELL)       */}
      {/* ============================================================== */}
      <header className="mobile-app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="mobile-header-menu-btn"
            onClick={() => setIsDrawerOpen(true)}
            title="Open Menu"
            aria-label="Open Navigation Menu"
          >
            <IconMenu size={22} color="#ffffff" />
          </button>
          <div className="mobile-header-brand-title">
            Chafé • Staff Workspace
          </div>
        </div>

        <div className="mobile-header-search-bar">
          <span className="mobile-header-search-icon">
            <IconSearch size={16} />
          </span>
          <input
            type="text"
            className="mobile-header-search-input"
            placeholder="Search here"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="mobile-header-bell-btn"
          onClick={() => setActiveModal('alerts')}
          title="Store Alerts & Notifications"
          aria-label="View Alerts"
        >
          <IconBell size={20} color="#ffffff" />
          <span className="mobile-bell-badge"></span>
        </button>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1 }}>
        {/* Scheduled Day Off Banner (if applicable today) */}
        {todayDayoff && (
          <div className="pro-dayoff-alert-banner" style={{ margin: '14px 18px 0' }}>
            <div className="pro-dayoff-icon">🌴</div>
            <div className="pro-dayoff-info">
              <h3>SCHEDULED DAY OFF TODAY ({todayDayoff.type.replace('_', ' ').toUpperCase()})</h3>
              <p>
                Reason: <strong>{todayDayoff.reason || 'Rest & Recharge'}</strong>. You are scheduled off duty today.
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: HOME VIEW (FULL RESPONSIVE DESKTOP & MOBILE)           */}
        {/* ============================================================== */}
        {activeTab === 'clock' && (
          <div className="responsive-home-grid">
            {/* Left Column: Shift Details & Action Buttons */}
            <div className="responsive-left-column">
              {/* 1. TODAY'S SHIFT CARD (UPCOMING MEETINGS IN MOCKUP) */}
              <div className="mobile-shift-card">
                <div className="shift-card-top-row">
                  <div className="shift-card-user-info">
                    <div className="shift-card-avatar">
                      {initials}
                    </div>
                    <div>
                      <h2 className="shift-card-name">{staffUser?.name || 'Staff Member'}</h2>
                      <div className="shift-card-time">{formattedShiftDateTime}</div>
                    </div>
                  </div>

                  <div className="shift-card-approved-badge">
                    {activeCheckin ? 'On Shift' : 'Approved'}
                  </div>
                </div>

                <div className="shift-card-details-grid">
                  <div>
                    <div className="shift-detail-label">Host / Station</div>
                    <div className="shift-detail-val">
                      {staffUser?.department || staffUser?.role || 'Main Counter'} (Barista, Chafé)
                    </div>
                  </div>
                  <div>
                    <div className="shift-detail-label">Purpose of Visit / Shift</div>
                    <div className="shift-detail-val">
                      {activeCheckin
                        ? `Active (${elapsedShiftTime || 'In Progress'})`
                        : `${staffUser?.shift_start || '07:30'} - ${staffUser?.shift_end || '16:00'}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Result Notification if recently clocked in/out */}
              {actionResult && (
                <div
                  className={`pro-action-alert ${actionResult.type === 'success' ? 'alert-success' : 'alert-error'}`}
                  style={{ margin: '0 0 16px' }}
                >
                  <div className="alert-icon-box">{actionResult.type === 'success' ? '✓' : '⚠️'}</div>
                  <div className="alert-content">
                    <strong>{actionResult.action || actionResult.message}</strong>
                    {actionResult.status && <div>{actionResult.status} at {actionResult.time}</div>}
                  </div>
                </div>
              )}

              {/* 2. TWO LARGE ACTION CARDS: CHECK - IN & CHECK - OUT (GOLDEN BORDER) */}
              <div className="mobile-action-cards-grid">
                {/* Check - In Card */}
                <button
                  type="button"
                  className={`mobile-action-card ${!activeCheckin ? 'active-state' : ''}`}
                  onClick={() => handleOpenActionModal('in')}
                >
                  <div className="mobile-action-icon">
                    <IconDoorIn size={36} color="#f59e0b" />
                  </div>
                  <div className="mobile-action-label">Check - In</div>
                  <div className="mobile-action-sublabel">
                    {!activeCheckin ? 'Ready to Start' : 'Already on Shift'}
                  </div>
                </button>

                {/* Check - Out Card */}
                <button
                  type="button"
                  className={`mobile-action-card ${activeCheckin ? 'active-state' : ''}`}
                  onClick={() => handleOpenActionModal('out')}
                >
                  <div className="mobile-action-icon">
                    <IconDoorOut size={36} color="#f59e0b" />
                  </div>
                  <div className="mobile-action-label">Check - Out</div>
                  <div className="mobile-action-sublabel">
                    {activeCheckin ? 'Complete Shift' : 'No Active Shift'}
                  </div>
                </button>
              </div>

              {/* Active Session Timer Banner if Clocked In */}
              {activeCheckin && (
                <div className="pro-active-session-banner" style={{ margin: '0 0 16px' }}>
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
            </div>

            {/* Right Column: Work Hub 3x3 Grid & Recent Shift Logs */}
            <div className="responsive-right-column">
              {/* 3. SECTION HEADING: TYPE OF VISIT / WORK HUB */}
              <div className="mobile-section-heading">
                <span>Type of Visit</span>
                <span
                  className="mobile-section-heading-sub"
                  onClick={() => setActiveTab('history')}
                >
                  Recent Logs ({recentLogs.length}) →
                </span>
              </div>

              {/* 4. 3x3 FEATURE GRID (9 SQUARE BUTTONS) */}
              <div className="mobile-grid-3x3">
                {filteredHubItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="mobile-grid-card"
                    onClick={item.action}
                    title={item.title}
                  >
                    <div className="mobile-grid-card-icon">
                      {item.icon}
                    </div>
                    <div className="mobile-grid-card-label">
                      {item.title}
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop Recent Shift Activity Card */}
              <div className="desktop-recent-shifts-card">
                <div className="desktop-recent-header">
                  <span>RECENT SHIFT ACTIVITY</span>
                  <button
                    type="button"
                    className="pro-link-btn"
                    onClick={() => setActiveTab('history')}
                  >
                    View All Timesheets →
                  </button>
                </div>
                {recentLogs.slice(0, 3).length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '12px', padding: '8px 0' }}>
                    No recent shift logs recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recentLogs.slice(0, 3).map((log) => (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #f1f5f9'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                            {log.check_in_at ? new Date(log.check_in_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Shift'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {log.check_in_at ? new Date(log.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            {log.check_out_at && ` → ${new Date(log.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </div>
                        </div>
                        <span className={`pro-badge ${log.status === 'checked_in' ? 'badge-emerald' : 'badge-slate'}`}>
                          {log.status === 'checked_in' ? 'Active' : 'Completed'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
      {/* 9. MOBILE-FIRST FIXED BOTTOM NAVIGATION (MATCHING SCREENSHOT)  */}
      {/* ============================================================== */}
      <nav className="mobile-fixed-bottom-bar">
        <div className="mobile-bottom-bar-inner">
          {/* Item 1: Home */}
          <button
            type="button"
            className={`mobile-bottom-tab-btn ${activeTab === 'clock' ? 'active' : ''}`}
            onClick={() => setActiveTab('clock')}
          >
            <div className="mobile-tab-icon">
              <IconHome size={22} />
            </div>
            <span>Home</span>
          </button>

          {/* Item 2: Schedule */}
          <button
            type="button"
            className={`mobile-bottom-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <div className="mobile-tab-icon">
              <IconCalendar size={22} />
            </div>
            <span>Schedule</span>
          </button>

          {/* Item 3: QR Code (Camera Scanner) */}
          <button
            type="button"
            className={`mobile-bottom-tab-btn ${activeTab === 'scan' ? 'active' : ''}`}
            onClick={() => {
              setSelectedScanAction(null)
              setActiveTab('scan')
            }}
          >
            <div className="mobile-tab-icon">
              <IconCamera size={23} />
            </div>
            <span>QR Code</span>
          </button>

          {/* Item 4: Profile / Pass */}
          <button
            type="button"
            className={`mobile-bottom-tab-btn ${activeTab === 'badge' ? 'active' : ''}`}
            onClick={() => setActiveTab('badge')}
          >
            <div className="mobile-tab-icon">
              <IconUserCircle size={22} />
            </div>
            <span>Profile</span>
          </button>
        </div>
      </nav>

      {/* ============================================================== */}
      {/* 10. MOBILE SLIDE DRAWER (HAMBURGER MENU)                       */}
      {/* ============================================================== */}
      {isDrawerOpen && (
        <div className="mobile-app-drawer-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="mobile-app-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-avatar-row">
                <div className="drawer-avatar">{initials}</div>
                <div>
                  <div className="drawer-name">{staffUser?.name || 'Staff Member'}</div>
                  <div className="drawer-role">☕ {staffUser?.role || 'Team Member'} • Chafé</div>
                </div>
              </div>
            </div>

            <div className="drawer-body">
              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveTab('clock'); setIsDrawerOpen(false) }}
              >
                <IconHome size={18} color="#0284c7" />
                <span>Home Dashboard</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveTab('schedule'); setIsDrawerOpen(false) }}
              >
                <IconCalendar size={18} color="#10b981" />
                <span>My Schedule & Leaves</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveTab('scan'); setIsDrawerOpen(false) }}
              >
                <IconCamera size={18} color="#f59e0b" />
                <span>Camera QR Scanner</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveTab('history'); setIsDrawerOpen(false) }}
              >
                <IconClock size={18} color="#8b5cf6" />
                <span>Shift History & Timesheet</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveTab('badge'); setIsDrawerOpen(false) }}
              >
                <IconQrCode size={18} color="#06b6d4" />
                <span>Digital ID Pass</span>
              </button>

              <div style={{ height: '1px', background: '#f1f5f9', margin: '8px 0' }} />

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveModal('performance'); setIsDrawerOpen(false) }}
              >
                <IconTrophy size={18} color="#eab308" />
                <span>Performance Rating</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveModal('station'); setIsDrawerOpen(false) }}
              >
                <IconCoffee size={18} color="#d97706" />
                <span>Counter Station</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveModal('alerts'); setIsDrawerOpen(false) }}
              >
                <IconBell size={18} color="#ec4899" />
                <span>Store Announcements</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveModal('support'); setIsDrawerOpen(false) }}
              >
                <IconPhone size={18} color="#14b8a6" />
                <span>Store Support</span>
              </button>
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="drawer-btn-signout"
                onClick={() => { setIsDrawerOpen(false); onLogout() }}
              >
                <IconLogOut size={16} />
                <span>Sign Out of Employee Portal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 11. FEATURE MODALS (PERFORMANCE, STATION, ALERTS, PROFILE, SUPPORT) */}
      {/* ============================================================== */}
      {activeModal && (
        <div className="mobile-feature-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="mobile-feature-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-feature-modal-header">
              <h3 className="mobile-feature-modal-title">
                {activeModal === 'performance' && <><span>🏆</span> Staff Performance Review</>}
                {activeModal === 'station' && <><span>☕</span> Assigned Counter Station</>}
                {activeModal === 'alerts' && <><span>🔔</span> Store Alerts & Notices</>}
                {activeModal === 'profile' && <><span>👤</span> Employee Profile</>}
                {activeModal === 'support' && <><span>📞</span> Store Support & Contacts</>}
              </h3>
              <button
                type="button"
                className="mobile-feature-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="mobile-feature-modal-body">
              {/* Performance Modal */}
              {activeModal === 'performance' && (
                <div>
                  <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                    <div style={{ fontSize: '38px', fontWeight: 900, color: '#10b981' }}>
                      {punctualityStats.rate}%
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>
                      Overall Punctuality Rating
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{punctualityStats.onTime}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>On-Time Shifts</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b' }}>{punctualityStats.late}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Late Arrivals</div>
                    </div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px', fontSize: '12.5px', color: '#166534', lineHeight: 1.5 }}>
                    ⭐ <strong>Good Standing:</strong> Attendance records are verified and synced with cloud timesheets. Keep up the high standard of punctuality!
                  </div>
                </div>
              )}

              {/* Station Modal */}
              {activeModal === 'station' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Assigned Bar Station:</span>
                    <strong style={{ color: '#0f172a' }}>Main Espresso Bar #1</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Machine:</span>
                    <strong style={{ color: '#0f172a' }}>La Marzocco Linea PB (Ready ✓)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Recipe Standard:</span>
                    <strong style={{ color: '#0f172a' }}>18.5g In • 38g Out (27s)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Milk Steaming Station:</span>
                    <strong style={{ color: '#10b981' }}>Sanitized & Temperature Set (65°C)</strong>
                  </div>
                </div>
              )}

              {/* Alerts Modal */}
              {activeModal === 'alerts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px', fontSize: '12.5px' }}>
                    <div style={{ fontWeight: 800, color: '#1e40af', marginBottom: '4px' }}>☕ Bean Hopper Rotation Notice</div>
                    <div style={{ color: '#3b82f6', lineHeight: 1.4 }}>
                      Please ensure Colombian single origin beans are refilled before noon peak.
                    </div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px', fontSize: '12.5px' }}>
                    <div style={{ fontWeight: 800, color: '#166534', marginBottom: '4px' }}>📅 Upcoming Roster Published</div>
                    <div style={{ color: '#15803d', lineHeight: 1.4 }}>
                      New weekly shift schedules have been updated. View your days off in the Schedule tab.
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Modal */}
              {activeModal === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Full Name:</span>
                    <strong style={{ color: '#0f172a' }}>{staffUser?.name || 'Staff Member'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Role / Department:</span>
                    <strong style={{ color: '#0f172a' }}>{staffUser?.role || 'Barista'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Email:</span>
                    <strong style={{ color: '#0f172a' }}>{staffUser?.email || 'staff@chafe.com'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Shift Hours:</span>
                    <strong style={{ color: '#0f172a' }}>{staffUser?.shift_start || '07:30'} - {staffUser?.shift_end || '16:00'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Employee Code:</span>
                    <strong style={{ color: '#0284c7' }}>STAFF-#{String(staffUser?.id || '').slice(-6).toUpperCase()}</strong>
                  </div>
                </div>
              )}

              {/* Support Modal */}
              {activeModal === 'support' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>☕ Store Manager Hotline</div>
                    <div style={{ color: '#64748b' }}>+1 (555) 234-5678 (Call or WhatsApp)</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>📧 Shift Swapping & Inquiries</div>
                    <div style={{ color: '#64748b' }}>operations@chafe.internal</div>
                  </div>
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px', fontSize: '12px', color: '#92400e' }}>
                    Emergency shifts or sudden sick leaves should be notified at least 2 hours before shift start.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 12. POPUP MODAL: ASK CHECK IN OR CHECK OUT                     */}
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
                  {scannedQrData ? '⚡ QR CODE SCANNED' : '📷 STORE ATTENDANCE'}
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

