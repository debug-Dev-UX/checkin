import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import jsQR from 'jsqr'
import {
  IconCamera,
  IconCheck,
  IconClock,
  IconCalendar,
  IconRefresh,
  IconUserCircle,
  IconGear,
  IconDoorIn,
  IconDoorOut,
  IconBell,
  IconPhone,
  IconMenu,
  IconSearch,
  IconHome,
  IconCoffee,
  IconTrophy,
  IconQrCode,
  IconLogOut,
  IconAlertTriangle,
  IconAward,
  IconX,
  IconMapPin,
  IconBuilding,
  IconZap,
  IconMail,
  IconSun
} from '../Icons'
import ProfileView from './ProfileView'
import ScanSuccessModal from './ScanSuccessModal'
import { useLanguage } from '../context/LanguageContext'
import {
  getTodayControlFromFirebase,
  getCheckinsFromFirebase,
  createCheckinInFirebase,
  checkoutInFirebase,
  updateStaffInFirebase,
  subscribeToBranches,
  subscribeToStoreAlerts,
} from '../services/firebaseService'
import {
  verifyRealtimeLocationForStaff,
  getBranches,
  getBranchById,
} from '../services/locationService'

/**
 * Web Audio API chime on successful scan / action
 */
function playSuccessBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.12) // D6

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

export default function UserDashboard({
  staffList = [],
  onShiftUpdated,
  onSwitchToAdmin,
}) {
  const { lang, t } = useLanguage()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameIdRef = useRef(null)
  const streamRef = useRef(null)
  const cameraSessionIdRef = useRef(0)

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date())

  // Active view tab: 'clock' (Home) | 'schedule' | 'scan' | 'profile'
  const [activeTab, setActiveTab] = useState('clock')

  // Search & Navigation state
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeModal, setActiveModal] = useState(null) // null | 'performance' | 'station' | 'alerts' | 'profile' | 'support' | 'action_confirm'
  const [pendingAction, setPendingAction] = useState(null) // 'in' | 'out'

  // Scanner state - ALWAYS back camera by default
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraFacing, setCameraFacing] = useState('environment') // 'environment' | 'user'
  const [cameraError, setCameraError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState(staffList[0]?.id?.toString() || '')

  // Result & logs
  const [scanResult, setScanResult] = useState(null)
  const [scanSuccessModal, setScanSuccessModal] = useState(null)
  const [lastScannedCode, setLastScannedCode] = useState(null)
  const [todayStaffLogs, setTodayStaffLogs] = useState([])

  // Dynamic Store Alerts
  const [storeAlerts, setStoreAlerts] = useState([])
  useEffect(() => {
    const unsub = subscribeToStoreAlerts((alerts) => {
      if (Array.isArray(alerts)) {
        setStoreAlerts(alerts.filter(a => a.isActive !== false))
      }
    })
    return () => {
      if (unsub) unsub()
    }
  }, [])

  // Geolocation validation state
  const [locationAlert, setLocationAlert] = useState(null)
  const [verifiedLocation, setVerifiedLocation] = useState(null)
  const [pendingLocationAction, setPendingLocationAction] = useState(null)

  // Multi-branch state
  const [branches, setBranches] = useState(() => getBranches())
  useEffect(() => {
    const unsub = subscribeToBranches((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setBranches(list)
      }
    })
    return () => {
      if (unsub) unsub()
    }
  }, [])

  // Live digital clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Sync selected staff id if empty
  useEffect(() => {
    if (!selectedStaffId && staffList.length > 0) {
      setSelectedStaffId(staffList[0].id.toString())
    }
  }, [staffList, selectedStaffId])

  const [profileOverrides, setProfileOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('chafe_custom_staff_profile')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Current selected staff member
  const currentStaff = useMemo(() => {
    const base = staffList.find(s => s.id?.toString() === selectedStaffId) || staffList[0] || {
      id: 1,
      name: 'Trinity Walls',
      role: 'Head Barista',
      department: 'Main Counter',
      shift_start: '07:30',
      shift_end: '16:00',
    }
    const savedAvatar = localStorage.getItem('chafe_profile_avatar')
    return {
      ...base,
      ...profileOverrides,
      photo_url: profileOverrides.photo_url || base.photo_url || savedAvatar || '',
    }
  }, [staffList, selectedStaffId, profileOverrides])

  // Initials
  const initials = useMemo(() => {
    if (!currentStaff?.name) return 'ST'
    return currentStaff.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }, [currentStaff])

  // Fetch today's staff logs
  const fetchTodayLogs = useCallback(async () => {
    try {
      const todayControl = await getTodayControlFromFirebase()
      const staffOnly = (todayControl.data || []).filter(item => item.type === 'employee')
      setTodayStaffLogs(staffOnly)
    } catch {
      // quiet catch
    }
  }, [])

  useEffect(() => {
    fetchTodayLogs()
  }, [fetchTodayLogs])

  // Check if selected staff is currently checked in
  const activeRecord = useMemo(() => {
    return todayStaffLogs.find(
      l => (
        (currentStaff?.id && (l.staff_id === currentStaff.id || String(l.staff_id) === String(currentStaff.id))) ||
        (currentStaff?.name && l.name?.toLowerCase() === currentStaff.name?.toLowerCase()) ||
        (currentStaff?.email && l.email?.toLowerCase() === currentStaff.email?.toLowerCase())
      ) && l.status === 'checked_in'
    )
  }, [todayStaffLogs, currentStaff])

  const isCheckedIn = Boolean(activeRecord || currentStaff?.is_on_shift)

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    cameraSessionIdRef.current += 1
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }
    // Explicitly stop all tracks on the active stream ref
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          track.enabled = false
          track.stop()
        })
      } catch (err) {
        console.warn('Error stopping stream tracks:', err)
      }
      streamRef.current = null
    }
    // Also explicitly stop tracks attached directly to the video element
    if (videoRef.current) {
      try {
        const videoStream = videoRef.current.srcObject
        if (videoStream && typeof videoStream.getTracks === 'function') {
          videoStream.getTracks().forEach(track => {
            track.enabled = false
            track.stop()
          })
        }
      } catch (err) {
        console.warn('Error stopping video element tracks:', err)
      }
      videoRef.current.srcObject = null
      try { videoRef.current.pause() } catch { /* ignore */ }
      try { videoRef.current.removeAttribute('src') } catch { /* ignore */ }
      try { videoRef.current.load?.() } catch { /* ignore */ }
    }
    setCameraActive(false)
  }, [])

  // Start camera stream (ALWAYS BACK CAMERA PREFERRED)
  const startCamera = useCallback(async () => {
    stopCamera()
    const currentSession = cameraSessionIdRef.current
    setCameraError(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access not supported by your browser.')
      return
    }

    try {
      let stream = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      // If camera was stopped or unmounted while awaiting getUserMedia, shut down stream immediately
      if (cameraSessionIdRef.current !== currentSession) {
        if (stream && stream.getTracks) {
          stream.getTracks().forEach(track => {
            try {
              track.enabled = false
              track.stop()
            } catch { /* ignore */ }
          })
        }
        return
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        if (cameraSessionIdRef.current !== currentSession) {
          stopCamera()
          return
        }
        setCameraActive(true)
      }
    } catch (err) {
      if (cameraSessionIdRef.current !== currentSession) {
        return
      }
      const isAbortError =
        err?.name === 'AbortError' ||
        err?.code === 20 ||
        (typeof err?.message === 'string' && (
          err.message.toLowerCase().includes('abort') ||
          err.message.toLowerCase().includes('aborted')
        ))
      if (isAbortError) {
        return
      }
      setCameraError(`Camera error: ${err.message || 'Permission denied'}`)
      setCameraActive(false)
    }
  }, [cameraFacing, stopCamera])

  const handleToggleFacing = () => {
    setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'))
  }

  useEffect(() => {
    if (activeTab === 'scan') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [activeTab, cameraFacing, startCamera, stopCamera])

  // Execute staff clock-in / clock-out
  const handleExecuteClock = useCallback(async (actionType, staffMember = currentStaff, source = 'Quick Touch') => {
    if (!staffMember) return
    setIsProcessing(true)
    stopCamera()

    try {
      const activeBranch =
        verifiedLocation?.branch ||
        (branches && branches.find(b => b.id === staffMember?.branch_id)) ||
        (branches && branches[0]) ||
        null

      if (actionType === 'in') {
        const payload = {
          staff_id: staffMember.id,
          name: staffMember.name,
          email: staffMember.email,
          photo_url: staffMember.photo_url || localStorage.getItem('chafe_profile_avatar') || null,
          type: 'employee',
          department: staffMember.role || staffMember.department || 'Service',
          badge_no: `STAFF-${staffMember.id || 'ROSTER'}`,
          branch_id: activeBranch?.id || staffMember?.branch_id || 'branch_2',
          branch_name: activeBranch?.name || staffMember?.branch_name || 'Chafé • Kohke',
          location: activeBranch?.name || staffMember?.branch_name || 'Main Counter Terminal',
          latitude: verifiedLocation?.coords?.lat || null,
          longitude: verifiedLocation?.coords?.lng || null,
          distance_to_store_meters: verifiedLocation?.distance || null,
          location_verified: !!verifiedLocation,
          note: `Clocked in via ${source} (GPS Verified ${verifiedLocation?.distance ?? 0}m)`,
        }

        const newRecord = await createCheckinInFirebase(payload)

        playSuccessBeep()
        setScanResult({
          type: 'success',
          action: 'Clocked In',
          name: staffMember.name,
          role: staffMember.role,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          status: newRecord?.punctuality_status === 'on_time' ? 'On-Time (Good Standing)' : 'Late Arrival',
        })
        setScanSuccessModal({
          action: 'in',
          name: staffMember.name,
          role: staffMember.role,
          photo_url: staffMember.photo_url || null,
          branch_name: activeBranch?.name || staffMember?.branch_name || 'Chafé Store',
          distance: verifiedLocation?.distance ?? null,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          date: new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          status: newRecord?.punctuality_status === 'on_time' ? 'On-Time (Good Standing)' : 'Late Arrival',
          isLate: newRecord?.punctuality_status === 'late',
          lateMins: newRecord?.late_minutes || 0,
        })
      } else {
        // Clock Out
        const checkinsData = await getCheckinsFromFirebase()
        const active = (checkinsData || []).find(
          c => c.status === 'checked_in' && (c.email === staffMember.email || c.name === staffMember.name)
        )

        if (!active) {
          throw new Error(`${staffMember.name} is not currently clocked in.`)
        }

        await checkoutInFirebase(active.id, staffMember.id)

        playSuccessBeep()
        setScanResult({
          type: 'success',
          action: 'Clocked Out',
          name: staffMember.name,
          role: staffMember.role,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          status: 'Shift Completed',
        })
        setScanSuccessModal({
          action: 'out',
          name: staffMember.name,
          role: staffMember.role,
          photo_url: staffMember.photo_url || null,
          branch_name: activeBranch?.name || staffMember?.branch_name || 'Chafé Store',
          distance: verifiedLocation?.distance ?? null,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          date: new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'Shift Completed',
          isLate: false,
          lateMins: 0,
        })
      }

      await fetchTodayLogs()
      if (onShiftUpdated) onShiftUpdated()

      setTimeout(() => {
        setScanResult(null)
      }, 5000)
    } catch (err) {
      setScanResult({
        type: 'error',
        message: err.message,
      })
      setTimeout(() => setScanResult(null), 5000)
    } finally {
      stopCamera()
      setIsProcessing(false)
      setActiveModal(null)
      setPendingAction(null)
    }
  }, [branches, currentStaff, fetchTodayLogs, onShiftUpdated, stopCamera, verifiedLocation])

  // Real-time location validation before opening camera scanner (Multi-Branch aware)
  const handleInitiateScan = async (action) => {
    setPendingLocationAction(action)
    try {
      setIsProcessing(true)
      if (showToast) showToast('Verifying real-time GPS location...', 'info')
      const loc = await verifyRealtimeLocationForStaff(currentStaff, branches)
      setVerifiedLocation(loc)
      setPendingAction(action)
      setActiveTab('scan')
      const branchName = loc.branch?.name || 'Store'
      if (showToast) showToast(`GPS Verified! (${loc.distance}m from ${branchName})`, 'success')
    } catch (err) {
      setLocationAlert(err)
      if (showToast) showToast(err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Continuous frame loop with jsQR for scan tab
  useEffect(() => {
    let active = true

    const scanFrame = () => {
      if (!active) return

      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && !isProcessing) {
        const video = videoRef.current
        const canvas = canvasRef.current || document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code && code.data && code.data !== lastScannedCode) {
          setLastScannedCode(code.data)
          const text = code.data.toLowerCase()

          let matchedStaff = staffList.find(s =>
            text.includes(s.email?.toLowerCase() || '---') ||
            text.includes(s.name?.toLowerCase() || '---') ||
            text.includes(`staff-${s.id}`)
          )

          if (!matchedStaff) matchedStaff = currentStaff

          if (matchedStaff) {
            playSuccessBeep()
            // Explicitly stop camera immediately upon QR detection so hardware turns off
            stopCamera()
            if (pendingAction) {
              handleExecuteClock(pendingAction, matchedStaff, 'QR Scan')
            } else {
              // Popup action modal to choose Check In or Check Out if no action chosen beforehand
              setPendingAction(isCheckedIn ? 'out' : 'in')
              setActiveModal('action_confirm')
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame)
    }

    if (cameraActive) {
      animFrameIdRef.current = requestAnimationFrame(scanFrame)
    }

    return () => {
      active = false
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current)
      }
    }
  }, [cameraActive, isProcessing, lastScannedCode, staffList, currentStaff, isCheckedIn])

  // TOP Staff Leaderboard Rankings
  const topRankings = useMemo(() => {
    const list = (staffList && staffList.length > 0) ? staffList : (currentStaff ? [currentStaff] : [])
    const ranked = list.map(stf => {
      const stfLogs = (todayStaffLogs || []).filter(c => (
        String(c.staff_id) === String(stf.id) ||
        (c.email && c.email.toLowerCase() === (stf.email || '').toLowerCase()) ||
        (c.name && c.name.toLowerCase() === (stf.name || '').toLowerCase())
      ))
      const total = stfLogs.length
      const late = stfLogs.filter(c => c.punctuality_status === 'late').length
      const onTime = Math.max(0, total - late)
      const rate = total > 0 ? Math.round((onTime / total) * 100) : 100
      return {
        id: stf.id,
        name: stf.name || 'Staff Member',
        role: stf.role || 'Barista',
        branch: stf.branch_name || 'Store',
        total,
        onTime,
        late,
        rate
      }
    })
    ranked.sort((a, b) => {
      if (b.onTime !== a.onTime) return b.onTime - a.onTime
      return b.rate - a.rate
    })
    return ranked
  }, [staffList, todayStaffLogs, currentStaff])

  // Hub items matching 3x3 grid
  const hubItems = useMemo(() => [
    { id: 'roster', title: t('shiftRoster', 'Shift Roster'), icon: <IconCalendar size={26} color="#ffffff" />, action: () => setActiveTab('schedule') },
    { id: 'dayoff', title: t('dayOff', 'Day Off'), icon: <IconSun size={26} color="#ffffff" />, action: () => setActiveTab('schedule') },
    { id: 'perf', title: t('performance', 'Performance'), icon: <IconTrophy size={26} color="#ffffff" />, action: () => setActiveModal('performance') },
    { id: 'logs', title: t('shiftLogs', 'Shift Logs'), icon: <IconClock size={26} color="#ffffff" />, action: () => setActiveTab('schedule') },
    { id: 'top', title: t('topStaff', 'TOP'), icon: <IconTrophy size={26} color="#ffffff" />, action: () => setActiveModal('top') },
    { id: 'badge', title: t('idBadge', 'ID Badge'), icon: <IconQrCode size={26} color="#ffffff" />, action: () => setActiveTab('badge') },
    { id: 'alerts', title: t('storeAlerts', 'Store Alerts'), icon: <IconBell size={26} color="#ffffff" />, action: () => setActiveModal('alerts') },
    { id: 'profile', title: t('myProfile', 'My Profile'), icon: <IconUserCircle size={26} color="#ffffff" />, action: () => setActiveTab('profile') },
    { id: 'support', title: t('support', 'Support'), icon: <IconPhone size={24} color="#ffffff" />, action: () => setActiveModal('support') },
  ], [t])

  const filteredHubItems = useMemo(() => {
    if (!searchQuery.trim()) return hubItems
    return hubItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [hubItems, searchQuery])

  // Formatted date and time string matching 12-hour style (e.g. 10:00 AM | 27 Nov 2026)
  const formattedShiftDateTime = useMemo(() => {
    const timeStr = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
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
            {t('staffWorkspace', 'Chafé • Staff Workspace')}
          </div>
        </div>

        <div className="mobile-header-search-bar">
          <span className="mobile-header-search-icon">
            <IconSearch size={16} />
          </span>
          <input
            type="text"
            className="mobile-header-search-input"
            placeholder={t('searchPlaceholder', 'Search staff, station, tools...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="mobile-header-bell-btn"
          onClick={() => setActiveModal('alerts')}
          title={t('storeAlerts', 'Store Alerts & Notifications')}
          aria-label="View Alerts"
        >
          <IconBell size={20} color="#ffffff" />
          <span className="mobile-bell-badge"></span>
        </button>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1 }}>
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
                    <div className="shift-card-avatar" style={{ overflow: 'hidden', position: 'relative' }}>
                      {(currentStaff?.photo_url || localStorage.getItem('chafe_profile_avatar')) ? (
                        <img
                          src={currentStaff?.photo_url || localStorage.getItem('chafe_profile_avatar')}
                          alt={currentStaff?.name || 'Staff'}
                          className="shift-card-avatar-img"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const fallback = e.currentTarget.nextElementSibling
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <span
                        className="shift-card-avatar-fallback"
                        style={{ display: (currentStaff?.photo_url || localStorage.getItem('chafe_profile_avatar')) ? 'none' : 'flex' }}
                      >
                        {initials}
                      </span>
                    </div>
                    <div>
                      <h2 className="shift-card-name">{currentStaff?.name || 'Trinity Walls'}</h2>
                      <div className="shift-card-time">{formattedShiftDateTime}</div>
                    </div>
                  </div>

                  <div className="shift-card-approved-badge">
                    {isCheckedIn ? 'On Shift' : 'Approved'}
                  </div>
                </div>

                <div className="shift-card-details-grid">
                  <div>
                    <div className="shift-detail-label">Host / Station</div>
                    <div className="shift-detail-val">
                      {currentStaff?.role || 'Barista'} • {currentStaff?.branch_name || branches.find(b => b.id === currentStaff?.branch_id)?.name || branches[0]?.name || 'Store'}
                    </div>
                  </div>
                  <div>
                    <div className="shift-detail-label">Purpose of Visit / Shift</div>
                    <div className="shift-detail-val">
                      {isCheckedIn
                        ? 'Active On Shift'
                        : `${currentStaff?.shift_start || '07:30'} - ${currentStaff?.shift_end || '16:00'}`}
                    </div>
                  </div>
                </div>

                {/* Staff Switcher for Store Terminal */}
                {staffList.length > 1 && (
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Switch Staff Profile:</span>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                    >
                      {staffList.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action Feedback Banner */}
              {scanResult && (
                <div
                  className={`pro-action-alert ${scanResult.type === 'success' ? 'alert-success' : 'alert-error'}`}
                  style={{ margin: '0 0 16px' }}
                >
                  <div className="alert-icon-box">
                    {scanResult.type === 'success' ? <IconCheck size={18} color="#059669" /> : <IconAlertTriangle size={18} color="#dc2626" />}
                  </div>
                  <div className="alert-content">
                    <strong>{scanResult.action ? `${scanResult.action} Confirmed!` : scanResult.message}</strong>
                    {scanResult.name && <div>{scanResult.name} • {scanResult.time} • {scanResult.status}</div>}
                  </div>
                </div>
              )}

              {/* 2. TWO LARGE ACTION CARDS: CHECK - IN & CHECK - OUT (GOLDEN BORDER) */}
              <div className="mobile-action-cards-grid">
                {/* Check - In Card */}
                <button
                  type="button"
                  className={`mobile-action-card ${!isCheckedIn ? 'active-state' : ''}`}
                  onClick={() => {
                    if (isCheckedIn) return
                    handleInitiateScan('in')
                  }}
                  disabled={isProcessing || isCheckedIn}
                  style={isCheckedIn ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >
                  <div className="mobile-action-icon">
                    <IconDoorIn size={36} color={isCheckedIn ? '#94a3b8' : '#f59e0b'} />
                  </div>
                  <div className="mobile-action-label" style={isCheckedIn ? { color: '#64748b' } : {}}>{t('clockIn', 'Check - In')}</div>
                  <div className="mobile-action-sublabel">
                    {!isCheckedIn ? t('readyToStart', 'Ready to Start') : t('alreadyOnShift', 'Already on Shift')}
                  </div>
                </button>

                {/* Check - Out Card */}
                <button
                  type="button"
                  className={`mobile-action-card ${isCheckedIn ? 'active-state' : ''}`}
                  onClick={() => handleInitiateScan('out')}
                  disabled={isProcessing}
                >
                  <div className="mobile-action-icon">
                    <IconDoorOut size={36} color="#f59e0b" />
                  </div>
                  <div className="mobile-action-label">{t('clockOut', 'Check - Out')}</div>
                  <div className="mobile-action-sublabel">
                    {isCheckedIn ? t('completeShift', 'Complete Shift') : t('noShift', 'No Active Shift')}
                  </div>
                </button>
              </div>
            </div>

            {/* Right Column: Work Hub 3x3 Grid & Today's Attendance Activity */}
            <div className="responsive-right-column">
              {/* 3. SECTION HEADING: TYPE OF VISIT / WORK HUB */}
              <div className="mobile-section-heading">
                <span>{t('typeOfVisit', 'Type of Visit')}</span>
                <span
                  className="mobile-section-heading-sub"
                  onClick={() => setActiveTab('schedule')}
                >
                  {t('todayLogs', 'Today')} ({todayStaffLogs.length}) →
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
                  <span>{t('recentShiftActivity', 'TODAY\'S SHIFT ACTIVITY')}</span>
                  <button
                    type="button"
                    className="pro-link-btn"
                    onClick={() => setActiveTab('schedule')}
                  >
                    {t('viewAllTimesheets', `View All (${todayStaffLogs.length}) →`)}
                  </button>
                </div>
                {todayStaffLogs.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '12px', padding: '8px 0' }}>
                    {t('noRecentLogs', 'No staff clocked in today yet.')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {todayStaffLogs.slice(0, 3).map((log) => (
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
                            {log.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {log.department} • {log.check_in_at ? new Date(log.check_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '-'}
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
        {/* TAB 2: CAMERA SCANNER (CENTER SCAN ACTION)                     */}
        {/* ============================================================== */}
        {activeTab === 'scan' && (
          <div style={{ padding: '18px' }}>
            <div className="pro-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>CAMERA QR SCANNER</h3>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>● BACK CAMERA ACTIVE</span>
                </div>
                <button
                  type="button"
                  className="pro-btn-secondary"
                  onClick={() => {
                    stopCamera()
                    setActiveTab('clock')
                  }}
                  style={{ padding: '5px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <IconX size={14} />
                  <span>Close</span>
                </button>
              </div>

              {/* Viewfinder Video */}
              <div className="camera-viewfinder-box" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                <video
                  ref={videoRef}
                  className="camera-video-element"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div className="scanner-reticle-overlay">
                  <div className="reticle-corner top-left" />
                  <div className="reticle-corner top-right" />
                  <div className="reticle-corner bottom-left" />
                  <div className="reticle-corner bottom-right" />
                  {cameraActive && <div className="scanning-laser-line" />}
                </div>

                {!cameraActive && (
                  <div className="camera-off-overlay">
                    <div style={{ marginBottom: '8px' }}>
                      <IconCamera size={36} color="#64748b" />
                    </div>
                    <strong>Starting Back Camera...</strong>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="camera-error-banner" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconAlertTriangle size={16} color="#dc2626" />
                  <span>{cameraError}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleToggleFacing}
                  style={{ flex: 1, padding: '10px', fontSize: '12px' }}
                >
                  <IconRefresh size={14} />
                  <span>Flip ({cameraFacing === 'environment' ? 'Rear' : 'Front'})</span>
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleExecuteClock(isCheckedIn ? 'out' : 'in')}
                  style={{ flex: 1, padding: '10px', fontSize: '12px' }}
                >
                  <span>1-Tap {isCheckedIn ? 'Clock Out' : 'Clock In'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: SCHEDULE / ROSTER VIEW                                  */}
        {/* ============================================================== */}
        {activeTab === 'schedule' && (
          <div style={{ padding: '18px' }}>
            <div className="pro-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>TODAY'S ATTENDANCE</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{todayStaffLogs.length} shifts logged</span>
              </div>

              {todayStaffLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '13px' }}>
                  No staff clocked in today yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {todayStaffLogs.map(log => (
                    <div
                      key={log.id}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9' }}
                    >
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{log.name}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {log.department} • {log.check_in_at ? new Date(log.check_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '-'}
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
        )}

        {/* ============================================================== */}
        {/* TAB 4: PROFILE TEMPLATE (MATCHING USER REFERENCE TEMPLATE)     */}
        {/* ============================================================== */}
        {activeTab === 'profile' && (
          <ProfileView
            user={currentStaff}
            branches={branches}
            onUpdateUser={async (updated) => {
              if (currentStaff) {
                setProfileOverrides(prev => ({ ...prev, ...updated }))
                if (currentStaff.id) {
                  await updateStaffInFirebase(currentStaff.id, updated)
                }
              }
              if (onShiftUpdated) onShiftUpdated()
            }}
            onBack={() => setActiveTab('clock')}
            onLogout={() => {
              showToast?.('Staff signed out', 'info')
              window.location.hash = '#login'
            }}
            onShowBadge={() => setActiveTab('badge')}
            showToast={showToast}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 5: DIGITAL ID BADGE / PASS VIEW                            */}
        {/* ============================================================== */}
        {activeTab === 'badge' && (
          <div style={{ padding: '18px' }}>
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

                  <h3 className="id-badge-name">{currentStaff?.name}</h3>
                  <div className="id-badge-role">{currentStaff?.role || 'Staff Member'}</div>
                  <div className="id-badge-code">STAFF ID: #{String(currentStaff?.id || 'MEM').slice(-6).toUpperCase()}</div>

                  <div className="id-badge-qr-box">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=STAFF-${encodeURIComponent(currentStaff?.id || '1')}&color=0f172a&bgcolor=ffffff`}
                      alt="Staff QR Pass"
                      className="id-badge-qr-image"
                      style={{ width: '160px', height: '160px' }}
                    />
                    <span className="id-badge-qr-caption">1-Tap Scan Code</span>
                  </div>

                  <div className="id-badge-footer">
                    <p>Hold this pass against entrance scanners to verify attendance.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* 5. MOBILE-FIRST FIXED BOTTOM NAVIGATION (MATCHING SCREENSHOT)  */}
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
            <span>{t('home', 'Home')}</span>
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
            <span>{t('schedule', 'Schedule')}</span>
          </button>

          {/* Item 3: Profile */}
          <button
            type="button"
            className={`mobile-bottom-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <div className="mobile-tab-icon">
              <IconUserCircle size={22} />
            </div>
            <span>{t('profile', 'Profile')}</span>
          </button>
        </div>
      </nav>

      {/* ============================================================== */}
      {/* 6. MOBILE SLIDE DRAWER (HAMBURGER MENU)                        */}
      {/* ============================================================== */}
      {isDrawerOpen && (
        <div className="mobile-app-drawer-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="mobile-app-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-avatar-row">
                <div className="drawer-avatar">{initials}</div>
                <div>
                  <div className="drawer-name">{currentStaff?.name || 'Staff Member'}</div>
                  <div className="drawer-role" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <IconCoffee size={12} color="#059669" />
                    <span>{currentStaff?.role || 'Staff'} • Chafé</span>
                  </div>
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
                <span>Shift Schedule</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveTab('scan'); setIsDrawerOpen(false) }}
              >
                <IconCamera size={18} color="#f59e0b" />
                <span>Camera Scanner</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveTab('profile'); setIsDrawerOpen(false) }}
              >
                <IconUserCircle size={18} color="#10b981" />
                <span>My Profile & Settings</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveTab('badge'); setIsDrawerOpen(false) }}
              >
                <IconQrCode size={18} color="#06b6d4" />
                <span>Digital ID Badge</span>
              </button>

              <div style={{ height: '1px', background: '#f1f5f9', margin: '8px 0' }} />

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveModal('performance'); setIsDrawerOpen(false) }}
              >
                <IconTrophy size={18} color="#eab308" />
                <span>Performance Review</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveModal('top'); setIsDrawerOpen(false) }}
              >
                <IconTrophy size={18} color="#eab308" />
                <span>TOP Staff Leaderboard</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setActiveModal('alerts'); setIsDrawerOpen(false) }}
              >
                <IconBell size={18} color="#ec4899" />
                <span>Store Alerts</span>
              </button>

              {onSwitchToAdmin && (
                <>
                  <div style={{ height: '1px', background: '#f1f5f9', margin: '8px 0' }} />
                  <button
                    type="button"
                    className="drawer-nav-item"
                    onClick={() => { setIsDrawerOpen(false); onSwitchToAdmin() }}
                    style={{ color: '#0284c7', fontWeight: 700 }}
                  >
                    <IconGear size={18} color="#0284c7" />
                    <span>Switch to Admin Dashboard</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. FEATURE MODALS (PERFORMANCE, TOP, ALERTS, PROFILE, SUPPORT) */}
      {/* ============================================================== */}
      {activeModal && activeModal !== 'action_confirm' && (
        <div className="mobile-feature-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="mobile-feature-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-feature-modal-header">
              <h3 className="mobile-feature-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeModal === 'performance' && <><IconAward size={18} color="#eab308" /> <span>Staff Performance Review</span></>}
                {activeModal === 'top' && <><IconTrophy size={18} color="#eab308" /> <span>TOP Staff Leaderboard</span></>}
                {activeModal === 'alerts' && <><IconBell size={18} color="#0284c7" /> <span>Store Announcements</span></>}
                {activeModal === 'profile' && <><IconUserCircle size={18} color="#7c3aed" /> <span>Staff Profile</span></>}
                {activeModal === 'support' && <><IconPhone size={18} color="#059669" /> <span>Store Support</span></>}
              </h3>
              <button
                type="button"
                className="mobile-feature-modal-close"
                onClick={() => setActiveModal(null)}
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="mobile-feature-modal-body">
              {activeModal === 'performance' && (
                <div>
                  <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                    <div style={{ fontSize: '38px', fontWeight: 900, color: '#10b981' }}>100%</div>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>Overall Punctuality Standard</div>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px', fontSize: '12.5px', color: '#166534', lineHeight: 1.5 }}>
                    <strong>Good Standing:</strong> Shift records are synced with cloud timesheets in real-time.
                  </div>
                </div>
              )}

              {activeModal === 'top' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                    Real-time attendance & punctuality leaderboard across all store locations.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                    {topRankings.map((stf, idx) => {
                      const isTop1 = idx === 0
                      const isTop2 = idx === 1
                      const isTop3 = idx === 2
                      const isMe = currentStaff && (String(stf.id) === String(currentStaff.id) || (stf.email && stf.email.toLowerCase() === (currentStaff.email || '').toLowerCase()))

                      return (
                        <div
                          key={stf.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            background: isTop1 ? 'linear-gradient(135deg, #fefce8, #fef9c3)' : isMe ? '#f0fdf4' : '#ffffff',
                            border: `1px solid ${isTop1 ? '#fde047' : isTop2 ? '#cbd5e1' : isTop3 ? '#fcd34d' : isMe ? '#86efac' : '#e2e8f0'}`,
                            boxShadow: isTop1 ? '0 2px 8px rgba(234, 179, 8, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Ranks 1, 2, 3 have badge icons. Rank 4+ have NO badge icon */}
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              background: isTop1 ? '#fef08a' : isTop2 ? '#f1f5f9' : isTop3 ? '#ffedd5' : '#f8fafc',
                              color: isTop1 ? '#854d0e' : isTop2 ? '#334155' : isTop3 ? '#9a3412' : '#64748b'
                            }}>
                              {isTop1 ? (
                                <IconTrophy size={16} color="#ca8a04" />
                              ) : isTop2 ? (
                                <IconAward size={16} color="#64748b" />
                              ) : isTop3 ? (
                                <IconAward size={16} color="#c2410c" />
                              ) : null}
                              <span style={{ fontSize: (isTop1 || isTop2 || isTop3) ? '10px' : '13px', lineHeight: 1 }}>#{idx + 1}</span>
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f172a' }}>{stf.name}</span>
                                {isMe && (
                                  <span style={{ fontSize: '10px', fontWeight: 700, background: '#10b981', color: '#ffffff', padding: '1px 6px', borderRadius: '4px' }}>
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {stf.role} • {stf.branch}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, fontSize: '14px', color: stf.rate >= 90 ? '#10b981' : stf.rate >= 75 ? '#0284c7' : '#f59e0b' }}>
                              {stf.rate}%
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                              {stf.onTime} on-time ({stf.total} shifts)
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {activeModal === 'alerts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {storeAlerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: '13px' }}>
                      {t('noAlerts', 'No active announcements at this time.')}
                    </div>
                  ) : (
                    storeAlerts.map(alert => (
                      <div
                        key={alert.id}
                        style={{
                          background: alert.priority === 'high' ? '#eff6ff' : '#f0fdf4',
                          border: `1px solid ${alert.priority === 'high' ? '#bfdbfe' : '#bbf7d0'}`,
                          borderRadius: '12px',
                          padding: '12px',
                          fontSize: '12.5px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ fontWeight: 800, color: alert.priority === 'high' ? '#1e40af' : '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <IconBell size={14} color={alert.priority === 'high' ? '#1e40af' : '#166534'} />
                            <span>{alert.title}</span>
                          </div>
                          {alert.priority === 'high' && (
                            <span style={{ fontSize: '10px', fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px' }}>
                              {t('priorityHigh', 'High Priority')}
                            </span>
                          )}
                        </div>
                        <div style={{ color: alert.priority === 'high' ? '#2563eb' : '#15803d', lineHeight: 1.4 }}>
                          {alert.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeModal === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Name:</span>
                    <strong style={{ color: '#0f172a' }}>{currentStaff?.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Role:</span>
                    <strong style={{ color: '#0f172a' }}>{currentStaff?.role}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Shift:</span>
                    <strong style={{ color: '#0f172a' }}>{currentStaff?.shift_start} - {currentStaff?.shift_end}</strong>
                  </div>
                </div>
              )}

              {activeModal === 'support' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                    <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', marginBottom: '4px' }}>
                      <IconPhone size={14} color="#059669" />
                      <span>Manager Hotline:</span>
                    </div>
                    <div style={{ color: '#64748b' }}>+1 (555) 234-5678</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                    <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', marginBottom: '4px' }}>
                      <IconMail size={14} color="#0284c7" />
                      <span>Shift Operations:</span>
                    </div>
                    <div style={{ color: '#64748b' }}>operations@chafe.internal</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {activeModal === 'action_confirm' && (
        <div className="staff-modal-backdrop" onClick={() => { setActiveModal(null); stopCamera(); }}>
          <div className="staff-action-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header">
              <div className="staff-modal-title-box">
                <span className="staff-modal-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <IconZap size={12} color="#f59e0b" />
                  <span>QR SCAN CONFIRMED</span>
                </span>
                <h3 className="staff-modal-title">Confirm Attendance Action</h3>
                <p className="staff-modal-subtitle">
                  Select your attendance status for {currentStaff?.name}:
                </p>
              </div>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => {
                  setActiveModal(null)
                  stopCamera()
                }}
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="staff-modal-body">
              <div
                className={`modal-action-card card-in ${!isCheckedIn ? 'recommended' : 'disabled'}`}
                style={isCheckedIn ? {
                  opacity: 0.55,
                  backgroundColor: '#f1f5f9',
                  borderColor: '#cbd5e1',
                  cursor: 'not-allowed',
                  filter: 'grayscale(0.6)',
                } : {}}
                onClick={() => {
                  if (isCheckedIn || isProcessing) return
                  handleExecuteClock('in')
                }}
                role="button"
                aria-disabled={isCheckedIn}
              >
                <div className="action-card-icon-col">
                  <div className="action-icon-circle in-circle" style={isCheckedIn ? { background: '#e2e8f0', borderColor: '#cbd5e1' } : {}}>
                    <IconDoorIn size={22} color={isCheckedIn ? '#64748b' : '#059669'} />
                  </div>
                </div>
                <div className="action-card-content">
                  <div className="action-card-header">
                    <h4 className="action-card-title" style={isCheckedIn ? { color: '#64748b' } : {}}>Clock In (Check In)</h4>
                    <span
                      className={`action-status-pill ${!isCheckedIn ? 'pill-ready' : 'pill-muted'}`}
                      style={isCheckedIn ? { background: '#e2e8f0', color: '#64748b' } : {}}
                    >
                      {!isCheckedIn ? 'Ready to Start' : 'Already on Shift'}
                    </span>
                  </div>
                  <p className="action-card-desc">
                    {isCheckedIn
                      ? 'You are already clocked into an active shift.'
                      : 'Verify your arrival time.'}
                  </p>
                </div>
                <div className="action-card-arrow">
                  <button
                    type="button"
                    disabled={isCheckedIn || isProcessing}
                    className="action-proceed-btn in-btn"
                    style={isCheckedIn ? {
                      background: '#94a3b8',
                      boxShadow: 'none',
                      cursor: 'not-allowed',
                      pointerEvents: 'none',
                    } : {}}
                  >
                    {isCheckedIn ? 'Already on Shift' : 'Confirm In'}
                  </button>
                </div>
              </div>

              <div
                className={`modal-action-card card-out ${isCheckedIn ? 'recommended' : ''}`}
                onClick={() => handleExecuteClock('out')}
              >
                <div className="action-card-icon-col">
                  <div className="action-icon-circle out-circle">
                    <IconDoorOut size={22} color="#dc2626" />
                  </div>
                </div>
                <div className="action-card-content">
                  <h4 className="action-card-title">Clock Out (Check Out)</h4>
                  <p className="action-card-desc">Complete your working hours.</p>
                </div>
                <div className="action-card-arrow">
                  <span className="action-proceed-btn out-btn">Confirm Out</span>
                </div>
              </div>
            </div>

            <div className="staff-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => {
                  setActiveModal(null)
                  stopCamera()
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Validation Alert Modal */}
      {locationAlert && (
        <div className="location-alert-backdrop" onClick={() => setLocationAlert(null)}>
          <div className="location-alert-card" onClick={(e) => e.stopPropagation()}>
            <div className="location-alert-icon">
              <IconMapPin size={28} color="#dc2626" />
            </div>
            <h3 className="location-alert-title">Real-Time Location Required</h3>
            <p className="location-alert-text">
              {locationAlert.message}
            </p>
            {locationAlert.distance !== undefined && (
              <div className="location-alert-details">
                {locationAlert.branch && (
                  <div style={{ marginBottom: '6px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <IconBuilding size={14} color="#059669" />
                    <span>Branch: <strong>{locationAlert.branch.name}</strong></span>
                  </div>
                )}
                Your Current Distance: <strong>{locationAlert.distance}m</strong> away<br />
                Allowed Scan Distance (Set by Admin): <strong>{locationAlert.allowedRadius || 200}m</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '12px', borderRadius: '10px' }}
                onClick={() => setLocationAlert(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, padding: '12px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => {
                  const act = pendingLocationAction
                  setLocationAlert(null)
                  if (act) {
                    handleInitiateScan(act)
                  }
                }}
              >
                <IconRefresh size={14} />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Scan Success Popup Confirmation Modal */}
      <ScanSuccessModal
        data={scanSuccessModal}
        onClose={() => {
          setScanSuccessModal(null)
          stopCamera()
        }}
      />
    </div>
  )
}
