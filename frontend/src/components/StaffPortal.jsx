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
  IconAlertTriangle,
  IconSun,
  IconFlashlight,
  IconZap,
  IconAward,
  IconX,
  IconMapPin,
  IconBuilding,
  IconMail,
  IconFileText,
  IconCheckCircle,
  IconXCircle,
  IconSend,
  IconStar,
  IconTrash,
  IconRotateCw,
  IconGear,
} from '../Icons'
import { Skeleton } from './Skeleton'
import ProfileView from './ProfileView'
import ScanSuccessModal from './ScanSuccessModal'
import { useLanguage } from '../context/LanguageContext'
import {
  getCheckinsFromFirebase,
  getStaffDayoffsFromFirebase,
  getDayoffsFromFirebase,
  subscribeToDayoffs,
  createCheckinInFirebase,
  checkoutInFirebase,
  subscribeToLiveCheckins,
  updateStaffInFirebase,
  isTodayRecord,
  subscribeToBranches,
  subscribeToStaff,
  subscribeToStoreAlerts,
  getStaffMessagesFromFirebase,
  createStaffMessageInFirebase,
  subscribeToStaffMessages,
  subscribeToAdminNotifications,
} from '../services/firebaseService'
import {
  verifyRealtimeLocationForStaff,
  getBranches,
  getBranchById,
} from '../services/locationService'
import {
  getAccountPermissions,
  getDismissedAlertIds,
  dismissAlertForAccount,
  dismissAllAlertsForAccount,
  resetDismissedAlertsForAccount,
} from '../services/cookieService'

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
  const { lang, t } = useLanguage()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeCheckin, setActiveCheckin] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [dayoffs, setDayoffs] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [actionResult, setActionResult] = useState(null)
  const [scanSuccessModal, setScanSuccessModal] = useState(null)
  const [activeTab, setActiveTab] = useState('clock') // 'clock' | 'schedule' | 'scan' | 'history' | 'badge'
  const [dayoffFilter, setDayoffFilter] = useState('all') // 'all' | 'upcoming' | 'past'
  const [scheduleMode, setScheduleMode] = useState('own') // 'own' (My Day Offs) | 'all' (Shift Roster - All Staff)
  const [allDayoffs, setAllDayoffs] = useState([])
  const [rosterSearch, setRosterSearch] = useState('')
  const [allStaffList, setAllStaffList] = useState([])
  const [allCheckinsList, setAllCheckinsList] = useState([])
  const [staffMessages, setStaffMessages] = useState([])
  const [supportForm, setSupportForm] = useState({ subject: '', message: '', priority: 'normal' })
  const [supportSending, setSupportSending] = useState(false)
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem('chafe_theme_mode') || 'light'
    } catch {
      return 'light'
    }
  })

  // Theme synchronization effect
  useEffect(() => {
    const handleStorageTheme = () => {
      try {
        const saved = localStorage.getItem('chafe_theme_mode') || 'light'
        setThemeMode(saved)
        if (saved === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark')
        } else {
          document.documentElement.removeAttribute('data-theme')
        }
      } catch {}
    }
    handleStorageTheme()
    window.addEventListener('storage', handleStorageTheme)
    window.addEventListener('chafe_theme_updated', handleStorageTheme)
    return () => {
      window.removeEventListener('storage', handleStorageTheme)
      window.removeEventListener('chafe_theme_updated', handleStorageTheme)
    }
  }, [])

  // Mobile App Interface State
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeModal, setActiveModal] = useState(null) // null | 'performance' | 'top' | 'alerts' | 'profile' | 'support'
  const [profileInitialModal, setProfileInitialModal] = useState(null) // null | 'settings' | 'alerts' | 'password'

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

  // Admin Notifications (push from admin to staff)
  const [adminNotifications, setAdminNotifications] = useState([])

  // Store Alerts & Notices Dismissal state per Staff Account (saved to cookies and localStorage)
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => getDismissedAlertIds(staffUser?.id))

  useEffect(() => {
    setDismissedAlertIds(getDismissedAlertIds(staffUser?.id))
    const handleDismissedUpdate = (e) => {
      if (!e.detail || !e.detail.userId || String(e.detail.userId) === String(staffUser?.id || 'guest')) {
        setDismissedAlertIds(getDismissedAlertIds(staffUser?.id))
      }
    }
    window.addEventListener('chafe_alerts_dismissed_updated', handleDismissedUpdate)
    return () => window.removeEventListener('chafe_alerts_dismissed_updated', handleDismissedUpdate)
  }, [staffUser?.id])

  useEffect(() => {
    const unsub = subscribeToAdminNotifications((list) => {
      if (!Array.isArray(list)) return
      const mine = list.filter(n =>
        n.is_broadcast ||
        !n.target_staff_id ||
        n.target_staff_id === 'all' ||
        (staffUser?.id && String(n.target_staff_id) === String(staffUser?.id)) ||
        (staffUser?.email && n.target_staff_id && n.target_staff_id.toLowerCase() === staffUser.email.toLowerCase()) ||
        (staffUser?.name && n.target_staff_name && n.target_staff_name.toLowerCase() === staffUser.name.toLowerCase())
      )
      setAdminNotifications(mine)
    })
    return () => { if (unsub) unsub() }
  }, [staffUser])

  // Filtered active notifications & alerts (excluding ones deleted/dismissed by this staff account)
  const activeAdminNotifs = useMemo(() => {
    return adminNotifications.filter(n => !dismissedAlertIds.includes(String(n.id)))
  }, [adminNotifications, dismissedAlertIds])

  const activeStoreAlerts = useMemo(() => {
    return storeAlerts.filter(a => !dismissedAlertIds.includes(String(a.id)))
  }, [storeAlerts, dismissedAlertIds])

  const [readAdminNotifIds, setReadAdminNotifIds] = useState(() => {
    const readKey = `chafe_read_admin_notifs_${staffUser?.id || 'guest'}`
    try { return JSON.parse(localStorage.getItem(readKey) || '[]') } catch { return [] }
  })

  useEffect(() => {
    const readKey = `chafe_read_admin_notifs_${staffUser?.id || 'guest'}`
    try {
      setReadAdminNotifIds(JSON.parse(localStorage.getItem(readKey) || '[]'))
    } catch {
      setReadAdminNotifIds([])
    }
  }, [staffUser?.id])

  const unreadAdminNotifCount = useMemo(() => {
    return activeAdminNotifs.filter(n => !readAdminNotifIds.includes(n.id)).length
  }, [activeAdminNotifs, readAdminNotifIds])

  const markAdminNotifsRead = () => {
    const readKey = `chafe_read_admin_notifs_${staffUser?.id || 'guest'}`
    const ids = activeAdminNotifs.map(n => n.id)
    try { localStorage.setItem(readKey, JSON.stringify(ids)) } catch {}
    setReadAdminNotifIds(ids)
  }

  const handleDeleteAlert = (alertId, e) => {
    if (e) e.stopPropagation()
    const updated = dismissAlertForAccount(staffUser?.id, String(alertId))
    setDismissedAlertIds(updated)
    showToast?.('Notice removed', 'info')
  }

  const handleDeleteAllAlerts = () => {
    const allIds = [
      ...activeAdminNotifs.map(n => String(n.id)),
      ...activeStoreAlerts.map(a => String(a.id))
    ]
    const updated = dismissAllAlertsForAccount(staffUser?.id, allIds)
    setDismissedAlertIds(updated)
    showToast?.('All notices cleared', 'info')
  }

  const handleRestoreDismissedAlerts = () => {
    resetDismissedAlertsForAccount(staffUser?.id)
    setDismissedAlertIds([])
    showToast?.('Notices restored', 'success')
  }

  // Action Modal State (Popup modal asking Check In or Check Out)
  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedScanAction, setSelectedScanAction] = useState(null) // 'in' | 'out' | null
  const [scannedQrData, setScannedQrData] = useState(null)
  const selectedScanActionRef = useRef(null)
  selectedScanActionRef.current = selectedScanAction

  // Real-time Geolocation State & Profile state
  const [locationAlert, setLocationAlert] = useState(null) // null | { message, distance, code, allowedRadius }
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

  const [staffProfile, setStaffProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('chafe_custom_staff_profile')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Ensure admin-assigned branch and location cannot be overridden by local storage
        delete parsed.branch_id
        delete parsed.branch_name
        delete parsed.location
        return { ...staffUser, ...parsed }
      }
    } catch { /* quiet */ }
    return staffUser || {}
  })

  useEffect(() => {
    if (staffUser) {
      setStaffProfile(prev => ({
        ...prev,
        ...staffUser,
        branch_id: staffUser.branch_id,
        branch_name: staffUser.branch_name,
        location: staffUser.location || staffUser.branch_name,
      }))
    }
  }, [staffUser])

  // Real-time synchronization: when Admin updates staff branch or location in Firestore, sync instantly without refresh
  useEffect(() => {
    if (!staffUser?.id) return
    const unsub = subscribeToStaff((allStaff) => {
      const updated = allStaff.find(s => String(s.id) === String(staffUser.id) || s.email === staffUser.email)
      if (updated) {
        setStaffProfile(prev => {
          const prevBranch = prev?.branch_name
          if (prevBranch && updated.branch_name && prevBranch !== updated.branch_name) {
            showToast?.(`Admin updated your assigned branch to ${updated.branch_name}!`, 'info')
          }
          return {
            ...prev,
            ...updated,
            branch_id: updated.branch_id,
            branch_name: updated.branch_name,
            location: updated.location || updated.branch_name,
            branch_address: updated.branch_address,
          }
        })
      }
    })
    return () => {
      if (unsub) unsub()
    }
  }, [staffUser?.id, staffUser?.email, showToast])

  // Auto-allow Camera & GPS Location cookie persistence on site visit
  useEffect(() => {
    const perms = getAccountPermissions(staffUser?.id)
    if (perms.location) {
      const targetStaff = staffProfile?.name ? staffProfile : staffUser
      verifyRealtimeLocationForStaff(targetStaff, branches)
        .then(loc => {
          setVerifiedLocation(loc)
        })
        .catch(() => {
          // background pre-check quiet
        })
    }
  }, [staffUser?.id, branches, staffProfile])

  const staffPhotoUrl = staffProfile?.photo_url || staffUser?.photo_url || localStorage.getItem('chafe_profile_avatar') || ''

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
  const cameraSessionIdRef = useRef(0)

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
      setAllCheckinsList(allCheckins || [])
      const userRecords = (allCheckins || []).filter(
        c => (
          (staffUser?.id && (c.staff_id === staffUser.id || String(c.staff_id) === String(staffUser.id))) ||
          (staffUser?.email && c.email?.toLowerCase() === staffUser.email?.toLowerCase()) ||
          (staffUser?.name && c.name?.toLowerCase() === staffUser.name?.toLowerCase())
        )
      )
      const currentActive = userRecords.find(c => c.status === 'checked_in')
      setActiveCheckin(currentActive || null)
      setRecentLogs(userRecords)

      // 2. Fetch staff's assigned dayoffs (own account)
      const userDayoffs = await getStaffDayoffsFromFirebase(staffUser.id)
      setDayoffs(userDayoffs || [])

      // 3. Fetch all staff dayoffs (shift roster)
      const allDayoffsData = await getDayoffsFromFirebase()
      setAllDayoffs(allDayoffsData || [])

      // 4. Fetch staff messages
      const msgs = await getStaffMessagesFromFirebase()
      const myMsgs = (msgs || []).filter(m => (
        String(m.staff_id) === String(staffUser?.id) ||
        (m.email && m.email.toLowerCase() === (staffUser?.email || '').toLowerCase())
      ))
      setStaffMessages(myMsgs)
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
      setAllCheckinsList(allCheckins || [])
      const userRecords = (allCheckins || []).filter(
        c => (
          (staffUser?.id && (c.staff_id === staffUser.id || String(c.staff_id) === String(staffUser.id))) ||
          (staffUser?.email && c.email?.toLowerCase() === staffUser.email?.toLowerCase()) ||
          (staffUser?.name && c.name?.toLowerCase() === staffUser.name?.toLowerCase())
        )
      )
      const currentActive = userRecords.find(c => c.status === 'checked_in')
      setActiveCheckin(currentActive || null)
      setRecentLogs(userRecords)
    })
    return () => unsubscribe()
  }, [staffUser])

  // Live subscription to all staff roster
  useEffect(() => {
    const unsub = subscribeToStaff((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setAllStaffList(list)
      }
    })
    return () => unsub()
  }, [])

  // Live subscription to staff messages from admin
  useEffect(() => {
    if (!staffUser) return
    const unsub = subscribeToStaffMessages((list) => {
      const myMsgs = (list || []).filter(m => (
        String(m.staff_id) === String(staffUser?.id) ||
        (m.email && m.email.toLowerCase() === (staffUser?.email || '').toLowerCase())
      ))
      setStaffMessages(myMsgs)
    })
    return () => unsub()
  }, [staffUser])

  // Live subscription to dayoffs (updates shift roster and own day offs in real-time)
  useEffect(() => {
    const unsub = subscribeToDayoffs((list) => {
      if (Array.isArray(list)) {
        setAllDayoffs(list)
        if (staffUser) {
          const mine = list.filter(item => (
            (staffUser?.id && String(item.staff_id) === String(staffUser.id)) ||
            (staffUser?.email && item.staff?.email && item.staff.email.toLowerCase() === staffUser.email.toLowerCase()) ||
            (staffUser?.name && (
              (item.staff_name && item.staff_name.toLowerCase() === staffUser.name.toLowerCase()) ||
              (item.name && item.name.toLowerCase() === staffUser.name.toLowerCase())
            ))
          ))
          setDayoffs(mine)
        }
      }
    })
    return () => unsub()
  }, [staffUser])

  // Current shift status: true if employee has an active checked_in record
  const isOnShift = Boolean(
    activeCheckin ||
    staffUser?.is_on_shift ||
    staffProfile?.is_on_shift ||
    (recentLogs && recentLogs.some(c => c.status === 'checked_in'))
  )

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

  // Filtered dayoffs (strictly own account only)
  const filteredDayoffs = useMemo(() => {
    return dayoffs.filter(item => {
      const isMine =
        (staffUser?.id && String(item.staff_id) === String(staffUser.id)) ||
        (staffUser?.email && item.staff?.email && item.staff.email.toLowerCase() === staffUser.email.toLowerCase()) ||
        (staffUser?.name && (
          (item.staff_name && item.staff_name.toLowerCase() === staffUser.name.toLowerCase()) ||
          (item.name && item.name.toLowerCase() === staffUser.name.toLowerCase()) ||
          (item.staff?.name && item.staff.name.toLowerCase() === staffUser.name.toLowerCase())
        ))
      if (!isMine) return false

      const isPast = String(item.date).substring(0, 10) < todayStr
      const isUpcoming = String(item.date).substring(0, 10) >= todayStr
      if (dayoffFilter === 'upcoming') return isUpcoming
      if (dayoffFilter === 'past') return isPast
      return true
    })
  }, [dayoffs, dayoffFilter, todayStr, staffUser])

  // Filtered team dayoffs for Shift Roster (All Staff Day Offs)
  const filteredTeamDayoffs = useMemo(() => {
    return allDayoffs.filter(item => {
      const isPast = String(item.date).substring(0, 10) < todayStr
      const isUpcoming = String(item.date).substring(0, 10) >= todayStr
      if (dayoffFilter === 'upcoming' && !isUpcoming) return false
      if (dayoffFilter === 'past' && !isPast) return false
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase()
        const sName = (item.staff_name || item.name || '').toLowerCase()
        const sBranch = (item.branch_name || '').toLowerCase()
        const sType = (item.type || '').toLowerCase()
        const sReason = (item.reason || '').toLowerCase()
        if (!sName.includes(q) && !sBranch.includes(q) && !sType.includes(q) && !sReason.includes(q)) return false
      }
      return true
    })
  }, [allDayoffs, dayoffFilter, rosterSearch, todayStr])

  // TOP Staff Leaderboard Rankings
  const topRankings = useMemo(() => {
    const list = (allStaffList && allStaffList.length > 0) ? allStaffList : (staffUser ? [staffUser] : [])
    const ranked = list.map(stf => {
      const stfCheckins = (allCheckinsList || []).filter(c => (
        String(c.staff_id) === String(stf.id) ||
        (c.email && c.email.toLowerCase() === (stf.email || '').toLowerCase()) ||
        (c.name && c.name.toLowerCase() === (stf.name || '').toLowerCase())
      ))
      const total = stfCheckins.length
      const late = stfCheckins.filter(c => c.punctuality_status === 'late').length
      const onTime = Math.max(0, total - late)
      const rate = total > 0 ? Math.round((onTime / total) * 100) : 100
      return {
        id: stf.id,
        name: stf.name || 'Staff Member',
        role: stf.role || 'Barista',
        branch: stf.branch_name || 'Store',
        photo_url: stf.photo_url || '',
        total,
        onTime,
        late,
        rate
      }
    })
    // Sort primarily by onTime count descending, then by punctuality rate descending
    ranked.sort((a, b) => {
      if (b.onTime !== a.onTime) return b.onTime - a.onTime
      return b.rate - a.rate
    })
    return ranked
  }, [allStaffList, allCheckinsList, staffUser])

  // Send message from Staff to Admin via Support Form
  const handleSendSupportMessage = async (e) => {
    if (e) e.preventDefault()
    if (!supportForm.message.trim()) {
      showToast?.('Please enter a message for admin management.', 'error')
      return
    }
    setSupportSending(true)
    try {
      await createStaffMessageInFirebase({
        staff_id: staffUser?.id || '',
        staff_name: staffProfile?.name || staffUser?.name || 'Staff Member',
        email: staffUser?.email || '',
        branch_name: staffUser?.branch_name || 'Store',
        subject: supportForm.subject.trim() || 'Staff Inquiry',
        message: supportForm.message.trim(),
        priority: supportForm.priority || 'normal',
      })
      setSupportForm({ subject: '', message: '', priority: 'normal' })
      showToast?.(
        lang === 'kh' ? 'សារត្រូវបានផ្ញើទៅ Admin រួចរាល់!' : 'Message sent to Admin successfully!',
        'success'
      )
    } catch {
      showToast?.('Failed to send message', 'error')
    } finally {
      setSupportSending(false)
    }
  }

  // Execute explicit Clock In or Clock Out
  const handleExecuteAttendance = async (actionType) => {
    if (processing) return
    if (actionType === 'in' && isOnShift) {
      if (showToast) showToast('You are already clocked into an active shift.', 'info')
      return
    }
    setProcessing(true)
    setActionResult(null)
    stopCamera()
    setShowCamera(false)

    try {
      const activeBranch =
        verifiedLocation?.branch ||
        (branches && branches.find(b => b.id === (staffProfile?.branch_id || staffUser?.branch_id))) ||
        (branches && branches[0]) ||
        null

      if (actionType === 'in') {
        // CLOCK IN
        const payload = {
          staff_id: staffUser.id,
          name: staffProfile?.name || staffUser.name,
          email: staffProfile?.email || staffUser.email,
          photo_url: staffPhotoUrl || null,
          type: 'employee',
          department: staffProfile?.role || staffUser.role || 'Service Team',
          badge_no: `STAFF-${staffUser.id || 'MEM'}`,
          branch_id: activeBranch?.id || staffUser?.branch_id || 'branch_2',
          branch_name: activeBranch?.name || staffUser?.branch_name || 'Chafé • Kohke',
          location: activeBranch?.name || staffUser?.branch_name || 'Staff Mobile Portal',
          latitude: verifiedLocation?.coords?.lat || null,
          longitude: verifiedLocation?.coords?.lng || null,
          distance_to_store_meters: verifiedLocation?.distance || null,
          location_verified: !!verifiedLocation,
          note: todayDayoff
            ? `Clocked in on Day Off (${todayDayoff.type})`
            : `Clocked in via Store QR (GPS Verified ${verifiedLocation?.distance ?? 0}m)`,
        }

        const newRecord = await createCheckinInFirebase(payload)

        playSuccessBeep()
        setActiveCheckin(newRecord)
        setRecentLogs(prev => [newRecord, ...(prev || [])])
        setActionResult({
          type: 'success',
          action: 'Shift Started Successfully! (Clocked In)',
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          status: newRecord?.punctuality_status === 'on_time' ? 'On-Time (Good Standing)' : 'Late Arrival',
        })
        setScanSuccessModal({
          action: 'in',
          name: staffProfile?.name || staffUser.name || 'Staff Member',
          role: staffProfile?.role || staffUser.role || 'Barista',
          photo_url: staffPhotoUrl || null,
          branch_name: activeBranch?.name || staffUser?.branch_name || 'Chafé Store',
          distance: verifiedLocation?.distance ?? null,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          date: new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          status: newRecord?.punctuality_status === 'on_time' ? 'On-Time (Good Standing)' : 'Late Arrival',
          isLate: newRecord?.punctuality_status === 'late',
          lateMins: newRecord?.late_minutes || 0,
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
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          status: 'Shift Logged to Timesheet',
        })
        setScanSuccessModal({
          action: 'out',
          name: staffProfile?.name || staffUser.name || 'Staff Member',
          role: staffProfile?.role || staffUser.role || 'Barista',
          photo_url: staffPhotoUrl || null,
          branch_name: activeBranch?.name || staffUser?.branch_name || 'Chafé Store',
          distance: verifiedLocation?.distance ?? null,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          date: new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'Shift Completed',
          isLate: false,
          lateMins: 0,
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
      stopCamera()
      setProcessing(false)
      setShowActionModal(false)
      setSelectedScanAction(null)
      setScannedQrData(null)
    }
  }

  // Real-time location validation before opening camera scanner (Multi-Branch aware)
  const handleInitiateScan = async (action) => {
    setPendingLocationAction(action)
    try {
      setProcessing(true)
      if (showToast) showToast('Verifying real-time GPS location...', 'info')
      const targetStaff = staffProfile?.name ? staffProfile : staffUser
      const loc = await verifyRealtimeLocationForStaff(targetStaff, branches)
      setVerifiedLocation(loc)
      setSelectedScanAction(action)
      setActiveTab('scan')
      const branchName = loc.branch?.name || 'Store'
      if (showToast) showToast(`GPS Verified! (${loc.distance}m from ${branchName})`, 'success')
    } catch (err) {
      setLocationAlert(err)
      if (showToast) showToast(err.message, 'error')
    } finally {
      setProcessing(false)
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
    cameraSessionIdRef.current += 1
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }
    // Explicitly stop all tracks on the active stream ref so camera hardware turns off
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
    // Also explicitly stop tracks attached directly to the video element (WebKit / iOS hardware requirement)
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
    setTorchOn(false)
  }, [])

  const startCamera = useCallback(async (facing = cameraFacing) => {
    stopCamera()
    const currentSession = cameraSessionIdRef.current
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
        // Silently ignore AbortError/DOMException abort during camera initialization
        return
      }
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
          // Explicitly stop camera immediately upon successful scan so hardware turns off
          stopCamera()
          setShowCamera(false)

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

  // Hub items matching 3x3 grid (Store Alerts moved to Settings menu)
  const hubItems = useMemo(() => [
    { id: 'roster', title: t('shiftRoster', 'Shift Roster'), icon: <IconCalendar size={26} color="#ffffff" />, action: () => { setScheduleMode('all'); setActiveTab('schedule') } },
    { id: 'dayoff', title: t('dayOff', 'Day Off'), icon: <IconSun size={26} color="#ffffff" />, action: () => { setScheduleMode('own'); setActiveTab('schedule') } },
    { id: 'perf', title: t('performance', 'Performance'), icon: <IconTrophy size={26} color="#ffffff" />, action: () => setActiveModal('performance') },
    { id: 'logs', title: t('shiftLogs', 'Shift Logs'), icon: <IconClock size={26} color="#ffffff" />, action: () => setActiveTab('history') },
    { id: 'top', title: t('topStaff', 'TOP'), icon: <IconTrophy size={26} color="#ffffff" />, action: () => setActiveModal('top') },
    { id: 'badge', title: t('idBadge', 'ID Badge'), icon: <IconQrCode size={26} color="#ffffff" />, action: () => setActiveTab('badge') },
    { id: 'settings', title: t('settings', 'Settings'), icon: <IconGear size={26} color="#ffffff" />, action: () => { setProfileInitialModal(null); setActiveTab('profile') } },
    { id: 'profile', title: t('myProfile', 'My Profile'), icon: <IconUserCircle size={26} color="#ffffff" />, action: () => { setProfileInitialModal(null); setActiveTab('profile') } },
    { id: 'support', title: t('support', 'Support'), icon: <IconPhone size={24} color="#ffffff" />, action: () => setActiveModal('support') },
  ], [t])

  const filteredHubItems = useMemo(() => {
    if (!searchQuery.trim()) return hubItems
    return hubItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [hubItems, searchQuery])

  // Formatted date and time string matching reference screenshot style (e.g. 10:00 AM | 27 Nov 2026)
  const formattedShiftDateTime = useMemo(() => {
    const timeStr = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    const dateStr = currentTime.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    return `${timeStr} | ${dateStr}`
  }, [currentTime])

  return (
    <div className={`mobile-app-layout-wrapper ${themeMode === 'dark' ? 'dark-theme' : ''}`}>
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
          onClick={() => { setActiveModal('alerts'); markAdminNotifsRead() }}
          title={t('storeAlerts', 'Store Alerts & Notifications')}
          aria-label="View Alerts"
        >
          <IconBell size={20} color="#ffffff" />
          {(activeStoreAlerts.length > 0 || unreadAdminNotifCount > 0) && (
            <span className="mobile-bell-badge" style={unreadAdminNotifCount > 0 ? { background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: 800, minWidth: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', position: 'absolute', top: '-2px', right: '-2px' } : {}}>
              {unreadAdminNotifCount > 0 ? unreadAdminNotifCount : ''}
            </span>
          )}
        </button>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1 }}>
        {/* Management Announcement Banner (Push from Admin) */}
        {unreadAdminNotifCount > 0 && activeAdminNotifs.length > 0 && (
          <div
            className="pro-admin-notif-banner"
            onClick={() => { setActiveModal('alerts'); markAdminNotifsRead(); }}
            style={{
              margin: '14px 18px 0',
              padding: '12px 16px',
              borderRadius: '14px',
              background: themeMode === 'dark'
                ? (activeAdminNotifs[0]?.priority === 'urgent' ? 'linear-gradient(135deg, #451a03, #291500)' : 'linear-gradient(135deg, #0c2b4e, #0a192f)')
                : (activeAdminNotifs[0]?.priority === 'urgent' ? 'linear-gradient(135deg, #fff7ed, #ffedd5)' : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)'),
              border: themeMode === 'dark'
                ? (activeAdminNotifs[0]?.priority === 'urgent' ? '1.5px solid #7c2d12' : '1.5px solid #0369a1')
                : (activeAdminNotifs[0]?.priority === 'urgent' ? '1.5px solid #fed7aa' : '1.5px solid #bae6fd'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'transform 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: activeAdminNotifs[0]?.priority === 'urgent' ? '#ea580c' : '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '18px',
                flexShrink: 0
              }}>
                {activeAdminNotifs[0]?.priority === 'urgent' ? '🚨' : '🔔'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '13px', color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>
                    {activeAdminNotifs[0]?.title || 'Notice from Management'}
                  </strong>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: activeAdminNotifs[0]?.priority === 'urgent' ? '#ea580c' : '#0284c7',
                    color: '#ffffff'
                  }}>
                    {activeAdminNotifs[0]?.priority === 'urgent' ? 'URGENT' : 'NEW NOTICE'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: themeMode === 'dark' ? '#cbd5e1' : '#475569', marginTop: '2px' }}>
                  {activeAdminNotifs[0]?.message}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', whiteSpace: 'nowrap' }}>View Alert →</span>
              <button
                type="button"
                className="banner-dismiss-btn"
                onClick={(e) => handleDeleteAlert(activeAdminNotifs[0]?.id, e)}
                title="Delete notice"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}
              >
                <IconTrash size={15} color="#ef4444" />
              </button>
            </div>
          </div>
        )}

        {/* Scheduled Day Off Banner (if applicable today) */}
        {todayDayoff && (
          <div className="pro-dayoff-alert-banner" style={{ margin: '14px 18px 0' }}>
            <div className="pro-dayoff-icon"><IconSun size={28} color="#0284c7" /></div>
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
                    <div className="shift-card-avatar" style={{ overflow: 'hidden', position: 'relative' }}>
                      {staffPhotoUrl ? (
                        <img
                          src={staffPhotoUrl}
                          alt={staffProfile?.name || staffUser?.name || 'Staff'}
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
                        style={{ display: staffPhotoUrl ? 'none' : 'flex' }}
                      >
                        {initials}
                      </span>
                    </div>
                    <div>
                      <h2 className="shift-card-name">{staffProfile?.name || staffUser?.name || 'Staff Member'}</h2>
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
                      {staffUser?.role || 'Barista'} • {staffUser?.branch_name || branches.find(b => b.id === staffUser?.branch_id)?.name || branches[0]?.name || 'Store'}
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
                  <div className="alert-icon-box">{actionResult.type === 'success' ? <IconCheck size={18} color="#059669" /> : <IconAlertTriangle size={18} color="#dc2626" />}</div>
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
                  className={`mobile-action-card ${!isOnShift ? 'active-state' : ''}`}
                  onClick={() => {
                    if (isOnShift) {
                      if (showToast) showToast('You are already clocked into an active shift.', 'info')
                      return
                    }
                    handleInitiateScan('in')
                  }}
                  disabled={processing || isOnShift}
                  style={isOnShift ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >
                  <div className="mobile-action-icon">
                    <IconDoorIn size={36} color={isOnShift ? '#94a3b8' : '#f59e0b'} />
                  </div>
                  <div className="mobile-action-label" style={isOnShift ? { color: '#64748b' } : {}}>{t('clockIn', 'Check - In')}</div>
                  <div className="mobile-action-sublabel">
                    {!isOnShift ? t('readyToStart', 'Ready to Start') : t('alreadyOnShift', 'Already on Shift')}
                  </div>
                </button>

                {/* Check - Out Card */}
                <button
                  type="button"
                  className={`mobile-action-card ${isOnShift ? 'active-state' : ''}`}
                  onClick={() => handleInitiateScan('out')}
                  disabled={processing}
                >
                  <div className="mobile-action-icon">
                    <IconDoorOut size={36} color="#f59e0b" />
                  </div>
                  <div className="mobile-action-label">{t('clockOut', 'Check - Out')}</div>
                  <div className="mobile-action-sublabel">
                    {isOnShift ? t('completeShift', 'Complete Shift') : t('noShift', 'No Active Shift')}
                  </div>
                </button>
              </div>

              {/* Active Session Timer Banner if Clocked In */}
              {activeCheckin && (
                <div className="pro-active-session-banner" style={{ margin: '0 0 16px' }}>
                  <div className="session-banner-top">
                    <span className="session-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span><span>ON SHIFT SESSION ACTIVE</span></span>
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
                        {activeCheckin.punctuality_status === 'on_time' ? 'On-Time (Good Standing)' : `Late by ${activeCheckin.late_minutes} min`}
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
                <span>{t('typeOfVisit', 'Type of Visit')}</span>
                <span
                  className="mobile-section-heading-sub"
                  onClick={() => setActiveTab('history')}
                >
                  {t('todayLogs', 'Recent Logs')} ({recentLogs.length}) →
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
                  <span>{t('recentShiftActivity', 'RECENT SHIFT ACTIVITY')}</span>
                  <button
                    type="button"
                    className="pro-link-btn"
                    onClick={() => setActiveTab('history')}
                  >
                    {t('viewAllTimesheets', 'View All Timesheets →')}
                  </button>
                </div>
                {recentLogs.slice(0, 3).length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '12px', padding: '8px 0' }}>
                    {t('noRecentLogs', 'No recent shift logs recorded yet.')}
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
                      ? 'CHECK IN MODE'
                      : selectedScanAction === 'out'
                      ? 'CHECK OUT MODE'
                      : cameraFacing === 'environment'
                      ? 'BACK CAMERA (REAR)'
                      : 'FRONT CAMERA'}
                  </span>
                </div>
                <button
                  type="button"
                  className="pro-btn-scanner-close"
                  onClick={() => {
                    stopCamera()
                    setShowCamera(false)
                    setActiveTab('clock')
                  }}
                  title="Close scanner"
                >
                  <IconX size={16} />
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
                        ? 'Point at Store QR to Clock In'
                        : selectedScanAction === 'out'
                        ? 'Point at Store QR to Clock Out'
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
                  <IconFlashlight size={14} />
                  <span>{torchOn ? 'Flash On' : 'Flashlight'}</span>
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
                <div className="notice-icon"><IconZap size={16} color="#f59e0b" /></div>
                <div className="notice-text">
                  <strong>
                    {selectedScanAction === 'in'
                      ? 'Check In Mode Active'
                      : selectedScanAction === 'out'
                      ? 'Check Out Mode Active'
                      : 'Universal Store QR Scanner'}
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
        {/* 6. TAB 2: MY SCHEDULE & DAYS OFF / SHIFT ROSTER */}
        {/* ============================================================== */}
        {activeTab === 'schedule' && (
          <div className="pro-card">
            {/* Mode Toggle Bar: My Day Offs (Own Account) vs Shift Roster (All Staff) */}
            <div style={{ padding: '16px 20px 0', display: 'flex', gap: '8px', borderBottom: `1px solid ${themeMode === 'dark' ? '#334155' : '#f1f5f9'}` }}>
              <button
                type="button"
                onClick={() => setScheduleMode('own')}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px 10px 0 0',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: 'none',
                  background: scheduleMode === 'own' ? (themeMode === 'dark' ? '#0284c7' : '#0f172a') : (themeMode === 'dark' ? '#1e293b' : '#f1f5f9'),
                  color: scheduleMode === 'own' ? '#ffffff' : (themeMode === 'dark' ? '#94a3b8' : '#64748b'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                <IconSun size={16} color={scheduleMode === 'own' ? (themeMode === 'dark' ? '#ffffff' : '#38bdf8') : '#94a3b8'} />
                <span>{t('myDayOffs', 'My Day Offs (Own Account)')}</span>
                <span style={{ fontSize: '11px', background: scheduleMode === 'own' ? (themeMode === 'dark' ? 'rgba(255,255,255,0.2)' : '#334155') : (themeMode === 'dark' ? '#334155' : '#e2e8f0'), color: scheduleMode === 'own' ? '#ffffff' : (themeMode === 'dark' ? '#cbd5e1' : '#475569'), padding: '1px 6px', borderRadius: '10px' }}>
                  {dayoffs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScheduleMode('all')}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px 10px 0 0',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: 'none',
                  background: scheduleMode === 'all' ? (themeMode === 'dark' ? '#0284c7' : '#0f172a') : (themeMode === 'dark' ? '#1e293b' : '#f1f5f9'),
                  color: scheduleMode === 'all' ? '#ffffff' : (themeMode === 'dark' ? '#94a3b8' : '#64748b'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                <IconCalendar size={16} color={scheduleMode === 'all' ? (themeMode === 'dark' ? '#ffffff' : '#38bdf8') : '#94a3b8'} />
                <span>{t('allStaffDayOffs', 'Shift Roster (All Staff Day Offs)')}</span>
                <span style={{ fontSize: '11px', background: scheduleMode === 'all' ? (themeMode === 'dark' ? 'rgba(255,255,255,0.2)' : '#334155') : (themeMode === 'dark' ? '#334155' : '#e2e8f0'), color: scheduleMode === 'all' ? '#ffffff' : (themeMode === 'dark' ? '#cbd5e1' : '#475569'), padding: '1px 6px', borderRadius: '10px' }}>
                  {allDayoffs.length}
                </span>
              </button>
            </div>

            <div className="pro-card-header">
              <div>
                <h2 className="pro-card-title">
                  {scheduleMode === 'own'
                    ? t('myDayOffs', 'MY SCHEDULED DAYS OFF (OWN ACCOUNT)')
                    : t('allStaffDayOffs', 'SHIFT ROSTER — ALL STAFF DAYS OFF')}
                </h2>
                <p className="pro-card-subtitle">
                  {scheduleMode === 'own'
                    ? 'Approved leaves and rest days assigned to your own account'
                    : 'Scheduled day offs and leaves across all team members and branches'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {scheduleMode === 'all' && (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search staff, branch, leave..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      style={{
                        padding: '6px 12px 6px 30px',
                        fontSize: '12px',
                        border: `1px solid ${themeMode === 'dark' ? '#334155' : '#cbd5e1'}`,
                        background: themeMode === 'dark' ? '#0f172a' : '#ffffff',
                        color: themeMode === 'dark' ? '#f8fafc' : '#0f172a',
                        borderRadius: '20px',
                        outline: 'none',
                        width: '180px'
                      }}
                    />
                    <span style={{ position: 'absolute', left: '10px', top: '7px', color: '#94a3b8' }}>
                      <IconSearch size={13} />
                    </span>
                  </div>
                )}

                <div className="pro-filter-pills">
                  <button
                    type="button"
                    className={`pro-filter-pill ${dayoffFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setDayoffFilter('all')}
                  >
                    All ({scheduleMode === 'own' ? dayoffs.length : allDayoffs.length})
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
            </div>

            <div className="pro-card-body">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Skeleton width="100%" height="48px" borderRadius="8px" />
                  <Skeleton width="100%" height="48px" borderRadius="8px" />
                </div>
              ) : scheduleMode === 'own' ? (
                // VIEW 1: OWN ACCOUNT DAY OFFS ONLY
                filteredDayoffs.length === 0 ? (
                  <div className="pro-empty-placeholder">
                    <div className="empty-icon"><IconSun size={32} color="#0284c7" /></div>
                    <h3>No Scheduled Days Off Found</h3>
                    <p>You currently do not have any {dayoffFilter !== 'all' ? dayoffFilter : ''} days off assigned to your account.</p>
                    <p className="sub">Contact your manager or use the Support form to request leave or swap days off.</p>
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
                              {item.type === 'annual_leave' ? <IconSun size={18} color="#0284c7" /> : item.type === 'sick_leave' ? <IconAward size={18} color="#dc2626" /> : item.type === 'holiday' ? <IconAward size={18} color="#d97706" /> : <IconSun size={18} color="#059669" />}
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
                            {String(item.type || 'DAY OFF').replace('_', ' ').toUpperCase()}
                          </div>
                          <div className="dayoff-card-reason">
                            {item.reason || 'Scheduled Rest & Recreation'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                // VIEW 2: SHIFT ROSTER - ALL STAFF DAY OFFS
                filteredTeamDayoffs.length === 0 ? (
                  <div className="pro-empty-placeholder">
                    <div className="empty-icon"><IconCalendar size={32} color="#0284c7" /></div>
                    <h3>No Team Day Offs Found</h3>
                    <p>No team day-offs match the selected criteria.</p>
                  </div>
                ) : (
                  <div className="pro-dayoffs-grid">
                    {filteredTeamDayoffs.map((item) => {
                      const isToday = String(item.date).substring(0, 10) === todayStr
                      const isPast = String(item.date).substring(0, 10) < todayStr
                      const isMine = String(item.staff_id) === String(staffUser?.id) || item.name === staffUser?.name

                      return (
                        <div key={item.id || Math.random()} className={`pro-dayoff-card ${isToday ? 'card-today-glow' : ''}`} style={isMine ? { borderColor: '#38bdf8', background: '#f0f9ff' } : {}}>
                          <div className="dayoff-card-top">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="dayoff-type-icon">
                                {item.type === 'annual_leave' ? <IconSun size={18} color="#0284c7" /> : <IconAward size={18} color="#d97706" />}
                              </span>
                              <div>
                                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.staff_name || item.staff?.name || item.name || 'Team Member'}</strong>
                                {isMine && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#0284c7', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>YOU</span>}
                                {(item.branch_name || item.staff?.branch_name) && <div style={{ fontSize: '10.5px', color: '#64748b' }}>{item.branch_name || item.staff?.branch_name}</div>}
                              </div>
                            </div>
                            <span className={`pro-badge ${isToday ? 'badge-emerald' : isPast ? 'badge-slate' : 'badge-blue'}`}>
                              {isToday ? 'TODAY' : isPast ? 'COMPLETED' : 'UPCOMING'}
                            </span>
                          </div>
                          <div className="dayoff-card-date" style={{ marginTop: '8px' }}>
                            {new Date(item.date + 'T00:00:00').toLocaleDateString([], {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="dayoff-card-type-name">
                            {String(item.type || 'DAY OFF').replace('_', ' ').toUpperCase()}
                          </div>
                          <div className="dayoff-card-reason">
                            {item.reason || 'Rest & Recharge'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
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
                  <div className="empty-icon"><IconFileText size={32} color="#94a3b8" /></div>
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
                                {log.punctuality_status === 'on_time' ? 'On-Time' : `Late (${log.late_minutes}m)`}
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

        {/* ============================================================== */}
        {/* 9. TAB 5: PROFILE TEMPLATE (MATCHING USER REFERENCE TEMPLATE)  */}
        {/* ============================================================== */}
        {activeTab === 'profile' && (
          <ProfileView
            user={staffProfile}
            branches={branches}
            onUpdateUser={async (updated) => {
              setStaffProfile(prev => ({ ...prev, ...updated }))
              if (staffUser) {
                Object.assign(staffUser, updated)
                if (staffUser.id) {
                  await updateStaffInFirebase(staffUser.id, updated)
                }
              }
            }}
            onBack={() => {
              setProfileInitialModal(null)
              setActiveTab('clock')
            }}
            onLogout={onLogout}
            onShowBadge={() => setActiveTab('badge')}
            showToast={showToast}
            initialModal={profileInitialModal}
            activeAdminNotifs={activeAdminNotifs}
            activeStoreAlerts={activeStoreAlerts}
            dismissedAlertIds={dismissedAlertIds}
            onDeleteAlert={handleDeleteAlert}
            onDeleteAllAlerts={handleDeleteAllAlerts}
            onRestoreDismissedAlerts={handleRestoreDismissedAlerts}
          />
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
                  <div className="drawer-role"><IconCoffee size={12} color="#059669" /> <span>{staffUser?.role || 'Team Member'} • Chafé</span></div>
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
                onClick={() => { setScheduleMode('all'); setActiveTab('schedule'); setIsDrawerOpen(false) }}
              >
                <IconCalendar size={18} color="#0284c7" />
                <span>Shift Roster (All Staff Day Offs)</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setScheduleMode('own'); setActiveTab('schedule'); setIsDrawerOpen(false) }}
              >
                <IconSun size={18} color="#f59e0b" />
                <span>My Day Offs (Own Account)</span>
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
                onClick={() => { setActiveModal('top'); setIsDrawerOpen(false) }}
              >
                <IconTrophy size={18} color="#eab308" />
                <span>TOP Staff Leaderboard</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setProfileInitialModal('settings'); setActiveTab('profile'); setIsDrawerOpen(false) }}
              >
                <IconGear size={18} color="#0284c7" />
                <span>Settings & Permissions</span>
              </button>

              <button
                type="button"
                className="drawer-nav-item"
                onClick={() => { setProfileInitialModal('alerts'); setActiveTab('profile'); setIsDrawerOpen(false) }}
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
      {/* 11. FEATURE MODALS (PERFORMANCE, TOP, ALERTS, PROFILE, SUPPORT) */}
      {/* ============================================================== */}
      {activeModal && (
        <div className="mobile-feature-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="mobile-feature-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-feature-modal-header">
              <h3 className="mobile-feature-modal-title">
                {activeModal === 'performance' && <><IconAward size={20} color="#eab308" /> Staff Performance Review</>}
                {activeModal === 'top' && <><IconTrophy size={20} color="#eab308" /> TOP Staff Leaderboard</>}
                {activeModal === 'alerts' && <><IconBell size={20} color="#ec4899" /> Store Alerts & Notices</>}
                {activeModal === 'profile' && <><IconUserCircle size={20} color="#10b981" /> Employee Profile</>}
                {activeModal === 'support' && <><IconPhone size={20} color="#14b8a6" /> Store Support & Admin Inquiries</>}
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
              {/* Performance Modal */}
              {activeModal === 'performance' && (
                <div>
                  <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                    <div style={{ fontSize: '38px', fontWeight: 900, color: '#10b981' }}>
                      {punctualityStats.rate}%
                    </div>
                    <div style={{ fontSize: '13px', color: themeMode === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 700 }}>
                      Overall Punctuality Rating
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: themeMode === 'dark' ? '#1e293b' : '#f8fafc', border: `1px solid ${themeMode === 'dark' ? '#334155' : '#e2e8f0'}`, padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>{punctualityStats.onTime}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>On-Time Shifts</div>
                    </div>
                    <div style={{ background: themeMode === 'dark' ? '#1e293b' : '#f8fafc', border: `1px solid ${themeMode === 'dark' ? '#334155' : '#e2e8f0'}`, padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b' }}>{punctualityStats.late}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Late Arrivals</div>
                    </div>
                  </div>

                  <div style={{
                    background: themeMode === 'dark' ? '#064e3b' : '#f0fdf4',
                    border: `1px solid ${themeMode === 'dark' ? '#059669' : '#bbf7d0'}`,
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '12.5px',
                    color: themeMode === 'dark' ? '#a7f3d0' : '#166534',
                    lineHeight: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <IconAward size={18} color={themeMode === 'dark' ? '#34d399' : '#166534'} />
                    <span><strong>Good Standing:</strong> Attendance records are verified and synced with cloud timesheets. Keep up the high standard of punctuality!</span>
                  </div>
                </div>
              )}

              {/* TOP Staff Leaderboard Modal */}
              {activeModal === 'top' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    background: themeMode === 'dark' ? '#1e293b' : '#f8fafc',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: `1px solid ${themeMode === 'dark' ? '#334155' : '#e2e8f0'}`,
                    fontSize: '12px',
                    color: themeMode === 'dark' ? '#cbd5e1' : '#475569',
                    lineHeight: 1.5
                  }}>
                    Real-time attendance & punctuality leaderboard across all store locations.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                    {topRankings.map((stf, idx) => {
                      const isTop1 = idx === 0
                      const isTop2 = idx === 1
                      const isTop3 = idx === 2
                      const isMe = String(stf.id) === String(staffUser?.id) || (stf.email && stf.email.toLowerCase() === (staffUser?.email || '').toLowerCase())

                      return (
                        <div
                          key={stf.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            background: themeMode === 'dark'
                              ? (isTop1 ? 'linear-gradient(135deg, #422006, #291500)' : isMe ? '#064e3b' : '#1e293b')
                              : (isTop1 ? 'linear-gradient(135deg, #fefce8, #fef9c3)' : isMe ? '#f0fdf4' : '#ffffff'),
                            border: themeMode === 'dark'
                              ? `1px solid ${isTop1 ? '#ca8a04' : isTop2 ? '#475569' : isTop3 ? '#ea580c' : isMe ? '#10b981' : '#334155'}`
                              : `1px solid ${isTop1 ? '#fde047' : isTop2 ? '#cbd5e1' : isTop3 ? '#fcd34d' : isMe ? '#86efac' : '#e2e8f0'}`,
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
                              background: themeMode === 'dark'
                                ? (isTop1 ? '#713f12' : isTop2 ? '#334155' : isTop3 ? '#7c2d12' : '#0f172a')
                                : (isTop1 ? '#fef08a' : isTop2 ? '#f1f5f9' : isTop3 ? '#ffedd5' : '#f8fafc'),
                              color: themeMode === 'dark'
                                ? (isTop1 ? '#fef08a' : isTop2 ? '#cbd5e1' : isTop3 ? '#ffedd5' : '#94a3b8')
                                : (isTop1 ? '#854d0e' : isTop2 ? '#334155' : isTop3 ? '#9a3412' : '#64748b')
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
                                <span style={{ fontWeight: 800, fontSize: '13.5px', color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>{stf.name}</span>
                                {isMe && (
                                  <span style={{ fontSize: '10px', fontWeight: 700, background: '#10b981', color: '#ffffff', padding: '1px 6px', borderRadius: '4px' }}>
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                {stf.role} • {stf.branch}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, fontSize: '14px', color: stf.rate >= 90 ? '#10b981' : stf.rate >= 75 ? '#0284c7' : '#f59e0b' }}>
                              {stf.rate}%
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                              {stf.onTime} on-time ({stf.total} shifts)
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Alerts Modal: Read & Delete Store Alerts & Notices */}
              {activeModal === 'alerts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Top Bar with Clear All button */}
                  {(activeAdminNotifs.length > 0 || activeStoreAlerts.length > 0) && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '8px',
                      borderBottom: `1px solid ${themeMode === 'dark' ? '#334155' : '#f1f5f9'}`
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: themeMode === 'dark' ? '#94a3b8' : '#64748b' }}>
                        {activeAdminNotifs.length + activeStoreAlerts.length} Active {activeAdminNotifs.length + activeStoreAlerts.length === 1 ? 'Notice' : 'Notices'}
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteAllAlerts}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '6px'
                        }}
                        title="Dismiss all notices"
                      >
                        <IconTrash size={13} color="#ef4444" />
                        <span>Dismiss All</span>
                      </button>
                    </div>
                  )}

                  {/* Admin Notifications Section */}
                  {activeAdminNotifs.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: themeMode === 'dark' ? '#f8fafc' : '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconBell size={13} color="#ea580c" />
                        MESSAGES FROM MANAGEMENT
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {activeAdminNotifs.map(notif => (
                          <div
                            key={notif.id}
                            style={{
                              background: themeMode === 'dark'
                                ? (notif.priority === 'urgent' ? '#451a03' : notif.priority === 'info' ? '#0f2942' : '#1e293b')
                                : (notif.priority === 'urgent' ? '#fff7ed' : notif.priority === 'info' ? '#eff6ff' : '#f8fafc'),
                              border: themeMode === 'dark'
                                ? `1px solid ${notif.priority === 'urgent' ? '#7c2d12' : notif.priority === 'info' ? '#0369a1' : '#334155'}`
                                : `1px solid ${notif.priority === 'urgent' ? '#fed7aa' : notif.priority === 'info' ? '#bfdbfe' : '#e2e8f0'}`,
                              borderRadius: '12px',
                              padding: '12px',
                              fontSize: '12.5px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <div style={{
                                fontWeight: 800,
                                color: themeMode === 'dark'
                                  ? '#f8fafc'
                                  : (notif.priority === 'urgent' ? '#c2410c' : notif.priority === 'info' ? '#1e40af' : '#0f172a'),
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                {notif.priority === 'urgent' ? '🚨' : notif.priority === 'info' ? 'ℹ️' : '🔔'}
                                <span>{notif.title}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {notif.priority === 'urgent' && (
                                  <span style={{ fontSize: '10px', fontWeight: 700, background: '#fed7aa', color: '#c2410c', padding: '2px 6px', borderRadius: '4px' }}>URGENT</span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteAlert(notif.id, e)}
                                  title="Delete notice"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <IconTrash size={14} color="#ef4444" />
                                </button>
                              </div>
                            </div>
                            <div style={{ color: themeMode === 'dark' ? '#cbd5e1' : '#334155', lineHeight: 1.5 }}>{notif.message}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>From Management • {new Date(notif.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Store Notices Section */}
                  {activeStoreAlerts.length > 0 && (
                    <div>
                      {activeAdminNotifs.length > 0 && (
                        <div style={{ fontSize: '11px', fontWeight: 800, color: themeMode === 'dark' ? '#f8fafc' : '#0f172a', marginBottom: '8px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <IconBell size={13} color="#0284c7" />
                          STORE NOTICES
                        </div>
                      )}
                      {activeStoreAlerts.map(alert => (
                        <div
                          key={alert.id}
                          style={{
                            background: themeMode === 'dark'
                              ? (alert.priority === 'high' ? '#0f2942' : '#064e3b')
                              : (alert.priority === 'high' ? '#eff6ff' : '#f0fdf4'),
                            border: themeMode === 'dark'
                              ? `1px solid ${alert.priority === 'high' ? '#0369a1' : '#059669'}`
                              : `1px solid ${alert.priority === 'high' ? '#bfdbfe' : '#bbf7d0'}`,
                            borderRadius: '12px',
                            padding: '12px',
                            fontSize: '12.5px',
                            marginBottom: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{
                              fontWeight: 800,
                              color: themeMode === 'dark'
                                ? '#f8fafc'
                                : (alert.priority === 'high' ? '#1e40af' : '#166534'),
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <IconBell size={13} />
                              <span>{alert.title}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {alert.priority === 'high' && (
                                <span style={{ fontSize: '10px', fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px' }}>
                                  {t('priorityHigh', 'High Priority')}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleDeleteAlert(alert.id, e)}
                                title="Delete notice"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px'
                                }}
                              >
                                <IconTrash size={14} color="#ef4444" />
                              </button>
                            </div>
                          </div>
                          <div style={{ color: themeMode === 'dark' ? '#cbd5e1' : (alert.priority === 'high' ? '#2563eb' : '#15803d'), lineHeight: 1.4 }}>
                            {alert.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeAdminNotifs.length === 0 && activeStoreAlerts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '13px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <IconCheckCircle size={38} color="#10b981" />
                      </div>
                      <strong style={{ display: 'block', fontSize: '14px', color: themeMode === 'dark' ? '#f8fafc' : '#0f172a', marginBottom: '4px' }}>
                        {t('noAlerts', 'No active announcements at this time.')}
                      </strong>
                      <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#94a3b8' }}>
                        You have read or cleared all store alerts and management notices.
                      </p>
                      {dismissedAlertIds.length > 0 && (
                        <button
                          type="button"
                          onClick={handleRestoreDismissedAlerts}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            background: themeMode === 'dark' ? '#1e293b' : '#f1f5f9',
                            border: `1px solid ${themeMode === 'dark' ? '#334155' : '#cbd5e1'}`,
                            color: themeMode === 'dark' ? '#38bdf8' : '#0284c7',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <IconRotateCw size={13} />
                          <span>Restore Cleared Notices ({dismissedAlertIds.length})</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}


              {/* Profile Modal */}
              {activeModal === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: `1px solid ${themeMode === 'dark' ? '#334155' : '#f1f5f9'}` }}>
                    <span style={{ color: '#94a3b8' }}>Full Name:</span>
                    <strong style={{ color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>{staffUser?.name || 'Staff Member'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: `1px solid ${themeMode === 'dark' ? '#334155' : '#f1f5f9'}` }}>
                    <span style={{ color: '#94a3b8' }}>Role / Department:</span>
                    <strong style={{ color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>{staffUser?.role || 'Barista'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: `1px solid ${themeMode === 'dark' ? '#334155' : '#f1f5f9'}` }}>
                    <span style={{ color: '#94a3b8' }}>Email:</span>
                    <strong style={{ color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>{staffUser?.email || 'staff@chafe.com'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: `1px solid ${themeMode === 'dark' ? '#334155' : '#f1f5f9'}` }}>
                    <span style={{ color: '#94a3b8' }}>Shift Hours:</span>
                    <strong style={{ color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>{staffUser?.shift_start || '07:30'} - {staffUser?.shift_end || '16:00'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Employee Code:</span>
                    <strong style={{ color: '#0284c7' }}>STAFF-#{String(staffUser?.id || '').slice(-6).toUpperCase()}</strong>
                  </div>
                </div>
              )}

              {/* Support & Send Message to Admin Modal */}
              {activeModal === 'support' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  {/* Contact Hotlines */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: themeMode === 'dark' ? '#1e293b' : '#f8fafc', padding: '12px', borderRadius: '10px', border: `1px solid ${themeMode === 'dark' ? '#334155' : '#e2e8f0'}` }}>
                      <div style={{ fontWeight: 800, color: themeMode === 'dark' ? '#f8fafc' : '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconPhone size={14} color="#0284c7" />
                        <span>Manager Hotline</span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>+1 (555) 234-5678</div>
                    </div>
                    <div style={{ background: themeMode === 'dark' ? '#1e293b' : '#f8fafc', padding: '12px', borderRadius: '10px', border: `1px solid ${themeMode === 'dark' ? '#334155' : '#e2e8f0'}` }}>
                      <div style={{ fontWeight: 800, color: themeMode === 'dark' ? '#f8fafc' : '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconMail size={14} color="#0284c7" />
                        <span>Email Desk</span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>support@chafe.internal</div>
                    </div>
                  </div>

                  {/* Form to Send Message to Admin */}
                  <div style={{ background: themeMode === 'dark' ? '#1e293b' : '#ffffff', border: `1px solid ${themeMode === 'dark' ? '#334155' : '#cbd5e1'}`, borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: themeMode === 'dark' ? '#f8fafc' : '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <IconSend size={15} color="#0284c7" />
                      <span>Send Inquiry or Request to Admin</span>
                    </div>

                    <form onSubmit={handleSendSupportMessage} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: themeMode === 'dark' ? '#cbd5e1' : '#475569', display: 'block', marginBottom: '4px' }}>
                            Subject
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Schedule swap, Supply issue..."
                            value={supportForm.subject}
                            onChange={(e) => setSupportForm(prev => ({ ...prev, subject: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: `1px solid ${themeMode === 'dark' ? '#334155' : '#cbd5e1'}`,
                              background: themeMode === 'dark' ? '#0f172a' : '#ffffff',
                              color: themeMode === 'dark' ? '#f8fafc' : '#0f172a',
                              fontSize: '12px',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: themeMode === 'dark' ? '#cbd5e1' : '#475569', display: 'block', marginBottom: '4px' }}>
                            Priority
                          </label>
                          <select
                            value={supportForm.priority}
                            onChange={(e) => setSupportForm(prev => ({ ...prev, priority: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: `1px solid ${themeMode === 'dark' ? '#334155' : '#cbd5e1'}`,
                              background: themeMode === 'dark' ? '#0f172a' : '#ffffff',
                              color: themeMode === 'dark' ? '#f8fafc' : '#0f172a',
                              fontSize: '12px',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="normal">Normal</option>
                            <option value="urgent">Urgent</option>
                            <option value="leave_request">Leave Request</option>
                            <option value="emergency">Emergency</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: themeMode === 'dark' ? '#cbd5e1' : '#475569', display: 'block', marginBottom: '4px' }}>
                          Message to Admin *
                        </label>
                        <textarea
                          placeholder="Type your message, issue, or request for management here..."
                          rows={3}
                          value={supportForm.message}
                          onChange={(e) => setSupportForm(prev => ({ ...prev, message: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: `1px solid ${themeMode === 'dark' ? '#334155' : '#cbd5e1'}`,
                            background: themeMode === 'dark' ? '#0f172a' : '#ffffff',
                            color: themeMode === 'dark' ? '#f8fafc' : '#0f172a',
                            fontSize: '12px',
                            outline: 'none',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={supportSending || !supportForm.message.trim()}
                        style={{
                          background: supportSending ? '#94a3b8' : '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          fontWeight: 800,
                          fontSize: '12.5px',
                          cursor: supportSending ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        <IconSend size={14} color="#ffffff" />
                        <span>{supportSending ? 'Sending...' : 'Send Message to Admin'}</span>
                      </button>
                    </form>
                  </div>

                  {/* Sent Inquiries & Admin Replies History */}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '12px', color: '#475569', marginBottom: '8px' }}>
                      My Inquiries & Admin Replies ({staffMessages.length})
                    </div>
                    {staffMessages.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '11.5px', textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                        You haven't sent any messages to admin yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {staffMessages.map(msg => (
                          <div
                            key={msg.id}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '10px 12px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>{msg.subject || 'Inquiry'}</strong>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: msg.status === 'replied' ? '#dcfce7' : msg.status === 'read' ? '#dbeafe' : '#fef3c7',
                                color: msg.status === 'replied' ? '#15803d' : msg.status === 'read' ? '#1e40af' : '#b45309'
                              }}>
                                {msg.status === 'replied' ? 'Replied' : msg.status === 'read' ? 'Read by Admin' : 'Pending'}
                              </span>
                            </div>
                            <div style={{ color: '#475569', fontSize: '11.5px', lineHeight: 1.4 }}>
                              {msg.message}
                            </div>
                            {(msg.reply || msg.admin_reply) && (
                              <div style={{ marginTop: '8px', padding: '8px 10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '11px', color: '#065f46' }}>
                                <strong>Admin Reply:</strong> {msg.reply || msg.admin_reply}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
        <div className="staff-modal-backdrop" onClick={() => { if (!processing) { setShowActionModal(false); stopCamera(); } }}>
          <div
            className="staff-action-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-action-title"
          >
            <div className="staff-modal-header">
              <div className="staff-modal-title-box">
                <span className="staff-modal-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {scannedQrData ? <><IconZap size={13} color="#f59e0b" /> QR CODE SCANNED</> : <><IconCamera size={13} /> STORE ATTENDANCE</>}
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
                onClick={() => {
                  if (!processing) {
                    setShowActionModal(false)
                    stopCamera()
                  }
                }}
                aria-label="Close modal"
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="staff-modal-body">
              {/* Option 1: Clock In Card */}
              <div
                className={`modal-action-card card-in ${!isOnShift ? 'recommended' : 'disabled'}`}
                style={isOnShift ? {
                  opacity: 0.55,
                  backgroundColor: '#f1f5f9',
                  borderColor: '#cbd5e1',
                  cursor: 'not-allowed',
                  filter: 'grayscale(0.6)',
                } : {}}
                onClick={() => {
                  if (processing || isOnShift) return
                  if (scannedQrData) {
                    handleExecuteAttendance('in')
                  } else {
                    setSelectedScanAction('in')
                    setShowActionModal(false)
                    setActiveTab('scan')
                  }
                }}
                role="button"
                aria-disabled={isOnShift}
              >
                <div className="action-card-icon-col">
                  <div className="action-icon-circle in-circle" style={isOnShift ? { background: '#e2e8f0', borderColor: '#cbd5e1' } : {}}>
                    <IconDoorIn size={22} color={isOnShift ? '#64748b' : '#059669'} />
                  </div>
                </div>
                <div className="action-card-content">
                  <div className="action-card-header">
                    <h4 className="action-card-title" style={isOnShift ? { color: '#64748b' } : {}}>Clock In (Check In)</h4>
                    {!isOnShift ? (
                      <span className="action-status-pill pill-ready">Ready to Start</span>
                    ) : (
                      <span className="action-status-pill pill-muted" style={{ background: '#e2e8f0', color: '#64748b' }}>
                        Already on Shift
                      </span>
                    )}
                  </div>
                  <p className="action-card-desc">
                    {isOnShift
                      ? 'You are already clocked into an active shift. Clock out when your work is finished.'
                      : 'Start your shift arrival time. Punctuality is automatically verified.'}
                  </p>
                  <div className="action-card-meta">
                    <span>Shift: <strong>{staffUser?.shift_start || '07:30'} - {staffUser?.shift_end || '16:00'}</strong></span>
                  </div>
                </div>
                <div className="action-card-arrow">
                  <button
                    type="button"
                    disabled={isOnShift || processing}
                    className="action-proceed-btn in-btn"
                    style={isOnShift ? {
                      background: '#94a3b8',
                      boxShadow: 'none',
                      cursor: 'not-allowed',
                      pointerEvents: 'none',
                    } : {}}
                  >
                    {isOnShift ? 'Already Clocked In' : (scannedQrData ? 'Confirm In' : 'Scan to In →')}
                  </button>
                </div>
              </div>

              {/* Option 2: Clock Out Card */}
              <div
                className={`modal-action-card card-out ${isOnShift ? 'recommended' : ''}`}
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
                    <IconDoorOut size={22} color="#dc2626" />
                  </div>
                </div>
                <div className="action-card-content">
                  <div className="action-card-header">
                    <h4 className="action-card-title">Clock Out (Check Out)</h4>
                    {isOnShift ? (
                      <span className="action-status-pill pill-active">Shift Active</span>
                    ) : (
                      <span className="action-status-pill pill-muted">No Shift</span>
                    )}
                  </div>
                  <p className="action-card-desc">
                    Finish your work shift and record your total working hours.
                  </p>
                  <div className="action-card-meta">
                    {isOnShift ? (
                      <span>Active Session: <strong>{elapsedShiftTime}</strong></span>
                    ) : (
                      <span>Current status: Not on shift</span>
                    )}
                  </div>
                </div>
                <div className="action-card-arrow">
                  <span className="action-proceed-btn out-btn">
                    {scannedQrData ? 'Confirm Out' : 'Scan to Out →'}
                  </span>
                </div>
              </div>
            </div>

            <div className="staff-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => {
                  setShowActionModal(false)
                  stopCamera()
                }}
                disabled={processing}
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
            <div className="location-alert-icon"><IconMapPin size={28} color="#dc2626" /></div>
            <h3 className="location-alert-title">Real-Time Location Required</h3>
            <p className="location-alert-text">
              {locationAlert.message}
            </p>
            {locationAlert.distance !== undefined && (
              <div className="location-alert-details">
                {locationAlert.branch && (
                  <div style={{ marginBottom: '6px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                style={{ flex: 1, padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
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

