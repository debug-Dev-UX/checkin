import { useState, useEffect, useCallback, useMemo } from 'react'
import './App.css'
import {
  IconServerStack,
  IconPeaceHand,
  IconCocktail,
  IconHeartbeat,
  IconOverview,
  IconTrophy,
  IconUsers,
  IconQrCode,
  IconGear,
  IconPower,
  IconHamburger,
  IconSearch,
  IconEnvelope,
  IconUserCircle,
  IconChevronDown,
  IconArrowPointer,
  IconPlus,
  IconCheck,
  IconMoreVertical,
  IconTrash,
  IconClock,
  IconPrinter,
  IconCalendar,
  IconLock,
  IconKey,
  IconLogOut,
  IconEye,
  IconEyeOff,
  IconRefresh
} from './Icons'
import UserDashboard from './components/UserDashboard'
import LoginForm from './components/LoginForm'
import DayoffCalendar from './components/DayoffCalendar'
import StaffPortal from './components/StaffPortal'
import LoadingPage from './components/LoadingPage'
import {
  Skeleton,
  SkeletonBannerCards,
  SkeletonTable,
  SkeletonWidget
} from './components/Skeleton'
import { useLanguage } from './context/LanguageContext'
import {
  initFirebaseDatabase,
  getStatsFromFirebase,
  getCheckinsFromFirebase,
  getStaffFromFirebase,
  createStaffInFirebase,
  updateStaffInFirebase,
  deleteStaffInFirebase,
  createCheckinInFirebase,
  checkoutInFirebase,
  deleteCheckinInFirebase,
  getTodayControlFromFirebase,
  getSettingsFromFirebase,
  saveSettingsInFirebase,
  getPerformanceFromFirebase,
  subscribeToLiveCheckins,
  isTodayRecord,
  getBranchesFromFirebase,
  saveBranchesToFirebase,
  subscribeToBranches,
  subscribeToStaff,
  syncStaffCheckinsBranchInFirebase,
  getCustomRolesFromFirebase,
  saveCustomRolesToFirebase,
  DEFAULT_ROLES,
  getStoreAlertsFromFirebase,
  saveStoreAlertsToFirebase,
  DEFAULT_STORE_ALERTS,
} from './services/firebaseService'
import {
  getStoreLocation,
  setStoreLocation,
  getBranches,
  saveBranches,
  DEFAULT_BRANCHES
} from './services/locationService'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

// 12-Hour Select Time Picker Component (No 24-Hour)
function TimePicker12Hour({ value, onChange, disabled }) {
  const parseVal = (val) => {
    let hour = '08'
    let minute = '00'
    let ampm = 'AM'

    if (val && typeof val === 'string') {
      const v = val.trim()
      const match12 = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      if (match12) {
        hour = String(match12[1]).padStart(2, '0')
        minute = String(match12[2]).padStart(2, '0')
        ampm = match12[3].toUpperCase()
      } else {
        const match24 = v.match(/^(\d{1,2}):(\d{2})/)
        if (match24) {
          let h = parseInt(match24[1], 10)
          minute = String(match24[2]).padStart(2, '0')
          ampm = h >= 12 ? 'PM' : 'AM'
          h = h % 12 || 12
          hour = String(h).padStart(2, '0')
        }
      }
    }
    return { hour, minute, ampm }
  }

  const { hour, minute, ampm } = parseVal(value)

  const handleHourChange = (newH) => {
    onChange(`${newH}:${minute} ${ampm}`)
  }

  const handleMinChange = (newM) => {
    onChange(`${hour}:${newM} ${ampm}`)
  }

  const handleAmpmChange = (newAp) => {
    onChange(`${hour}:${minute} ${newAp}`)
  }

  const hourOptions = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
  const minuteOptions = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

  return (
    <div className="time-picker-12h">
      <select
        className="time-picker-select"
        value={hour}
        disabled={disabled}
        onChange={(e) => handleHourChange(e.target.value)}
        aria-label="Hour (12-hour)"
        style={{ flex: 1 }}
      >
        {hourOptions.map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span style={{ fontWeight: 800, color: '#64748b' }}>:</span>
      <select
        className="time-picker-select"
        value={minute}
        disabled={disabled}
        onChange={(e) => handleMinChange(e.target.value)}
        aria-label="Minute"
        style={{ flex: 1 }}
      >
        {minuteOptions.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        className="time-picker-select"
        value={ampm}
        disabled={disabled}
        onChange={(e) => handleAmpmChange(e.target.value)}
        aria-label="AM/PM"
        style={{
          width: '75px',
          fontWeight: 800,
          background: ampm === 'AM' ? '#f0fdf4' : '#fffbeb',
          color: ampm === 'AM' ? '#166534' : '#b45309',
          borderColor: ampm === 'AM' ? '#bbf7d0' : '#fde68a'
        }}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages]
  }
  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

export default function App() {
  const { lang, setLang, t } = useLanguage()

  // Navigation State with URL Hash Support (#user, #staff, #overview, #dayoffs, etc.)
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab') || params.get('mode')
    const hash = window.location.hash.replace('#', '').toLowerCase()
    const target = tabParam || hash
    if (['overview', 'performance', 'staff', 'dayoffs', 'control', 'settings', 'user', 'staff-scan', 'staff-portal'].includes(target)) {
      return target
    }
    return 'overview'
  }

  const [navTab, setNavTabState] = useState(getInitialTab)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const setNavTab = useCallback((tab) => {
    setNavTabState(tab)
    if (window.location.hash !== `#${tab}`) {
      window.location.hash = tab
    }
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase()
      if (['overview', 'performance', 'staff', 'dayoffs', 'control', 'settings', 'user', 'staff-scan', 'staff-portal'].includes(hash)) {
        setNavTabState(hash)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Current Authenticated User (Admin or Staff)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('chafe_auth_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const handleLoginSuccess = (loginData) => {
    setCurrentUser(loginData)
    try {
      localStorage.setItem('chafe_auth_user', JSON.stringify(loginData))
      if (loginData.token) localStorage.setItem('chafe_auth_token', loginData.token)
    } catch {
      // quiet
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    try {
      localStorage.removeItem('chafe_auth_user')
      localStorage.removeItem('chafe_auth_token')
    } catch {
      // quiet
    }
    showToast('Signed out successfully.')
  }

  // Real-time Overview Stats (Staff Attendance KPIs)
  const [stats, setStats] = useState({
    total_staff: 0,
    staff_checked_in_today: 0,
    staff_checked_out_today: 0,
    dayoff_today: 0,
    total_all: 0,
    active_now: 0,
    checked_out_today: 0,
    total_today: 0,
  })
  const [systemStatus, setSystemStatus] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)

  // Staff & Performance State (0 Data default)
  const [staffList, setStaffList] = useState([])
  const [performanceData, setPerformanceData] = useState({
    overall_punctuality: 0,
    total_shifts: 0,
    total_late_arrivals: 0,
    staff_performance: [],
  })

  // Control Room (Today & QR)
  const [todayData, setTodayData] = useState({
    summary: { active_now: 0, checked_out_today: 0, total_today: 0 },
    data: []
  })
  const [qrMode, setQrMode] = useState('guest') // 'guest' | 'staff'
  const [qrConfig, setQrConfig] = useState(null)

  // Settings
  const [cafeSettings, setCafeSettings] = useState({
    cafe_name: 'Chafé',
    operating_hours: '07:00 AM - 10:00 PM',
    late_grace_period_mins: 10,
    seating_capacity: 48,
    patio_capacity: 16,
    barista_target: 2,
    weekly_perf_alert: true,
    monthly_perf_alert: true,
    wifi_ssid: 'Chafe_Specialty_Guest',
    wifi_password: 'coffee2026',
  })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [storeLocation, setStoreLocationState] = useState(() => getStoreLocation())
  const [branches, setBranches] = useState(() => getBranches())
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all')
  const [isBranchesSaving, setIsBranchesSaving] = useState(false)

  // Filter & Search inside main table
  const [tableSearch, setTableSearch] = useState('')
  const [activeTableFilter, setActiveTableFilter] = useState('today') // 'today' | 'inside' | 'checked_out'
  const [isTableFilterMenuOpen, setIsTableFilterMenuOpen] = useState(false)
  const [tableSort, setTableSort] = useState('security') // 'security' | 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'status'
  const [isTableSortMenuOpen, setIsTableSortMenuOpen] = useState(false)
  const [advancedFilter, setAdvancedFilter] = useState('all') // 'all' | 'late' | 'on_time' | 'staff' | 'guest'
  const [tablePage, setTablePage] = useState(1) // Tasks & Notifications pager: 0 = All records, 1..10 = Pages

  // Weekly & Monthly Tardiness & Clean Record Audit State
  const [auditPeriod, setAuditPeriod] = useState('weekly') // 'weekly' | 'monthly'
  const [auditStaffFilter, setAuditStaffFilter] = useState('all') // 'all' | 'clean' | 'late' | staff_id

  // Header Menus & Modals
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [isMessagesOpen, setIsMessagesOpen] = useState(false)
  const [messagesTab, setMessagesTab] = useState('all') // 'all' | 'checkin_out' | 'late' | 'performance'
  const [isPerfModalOpen, setIsPerfModalOpen] = useState(false)
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  // Track read notification IDs
  const [readAlertIds, setReadAlertIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('chafe_read_alerts') || '[]')
    } catch {
      return []
    }
  })

  // Modals
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false)
  const [isCreateStaffModalOpen, setIsCreateStaffModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)

  // Action status & toast
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [toast, setToast] = useState(null)

  // Checkin Form
  const [checkinForm, setCheckinForm] = useState({
    name: '',
    email: '',
    type: 'guest',
    department: 'Main Dining',
    badge_no: 'TBL-01',
    location: 'Table 1',
    note: '',
  })
  const [checkinSubmitting, setCheckinSubmitting] = useState(false)

  // Staff Form
  const [staffForm, setStaffForm] = useState(() => {
    const initialBranches = getBranches()
    return {
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'Barista',
      branch_id: initialBranches[0]?.id || 'branch_2',
      branch_name: initialBranches[0]?.name || 'Chafé • Kohke',
      shift_start: '07:30 AM',
      shift_end: '04:00 PM',
      hourly_rate: 20.00,
    }
  })
  const [staffSubmitting, setStaffSubmitting] = useState(false)

  // Dynamic Roles (Custom roles created by Admin)
  const [customRoles, setCustomRoles] = useState(DEFAULT_ROLES)
  const [isAddingRoleInline, setIsAddingRoleInline] = useState(false)
  const [newRoleInput, setNewRoleInput] = useState('')

  useEffect(() => {
    getCustomRolesFromFirebase().then(roles => {
      if (Array.isArray(roles) && roles.length > 0) setCustomRoles(roles)
    })
  }, [])

  const handleCreateCustomRole = async (roleName) => {
    const trimmed = (roleName || '').trim()
    if (!trimmed) return null
    if (!customRoles.includes(trimmed)) {
      const nextRoles = [...customRoles, trimmed]
      setCustomRoles(nextRoles)
      await saveCustomRolesToFirebase(nextRoles)
      showToast(`Role "${trimmed}" created!`)
    }
    return trimmed
  }

  const handleDeleteCustomRole = async (roleToDelete) => {
    if (customRoles.length <= 1) {
      showToast('At least one role must remain.', 'error')
      return
    }
    const nextRoles = customRoles.filter(r => r !== roleToDelete)
    setCustomRoles(nextRoles)
    await saveCustomRolesToFirebase(nextRoles)
    showToast(`Role "${roleToDelete}" deleted.`)
  }

  // Dynamic Store Alerts & Notices (Admin managed)
  const [storeAlertsList, setStoreAlertsList] = useState(DEFAULT_STORE_ALERTS)
  const [newAlertForm, setNewAlertForm] = useState({ title: '', message: '', priority: 'normal' })
  const [editingAlertId, setEditingAlertId] = useState(null)
  const [editAlertForm, setEditAlertForm] = useState({ title: '', message: '', priority: 'normal' })

  useEffect(() => {
    getStoreAlertsFromFirebase().then(alerts => {
      if (Array.isArray(alerts) && alerts.length > 0) setStoreAlertsList(alerts)
    })
  }, [])

  const handleSaveStoreAlert = async (e) => {
    if (e) e.preventDefault()
    if (!newAlertForm.title.trim() || !newAlertForm.message.trim()) return
    const created = {
      id: `alert_${Date.now()}`,
      title: newAlertForm.title.trim(),
      message: newAlertForm.message.trim(),
      priority: newAlertForm.priority || 'normal',
      created_at: new Date().toISOString()
    }
    const updated = [created, ...storeAlertsList]
    setStoreAlertsList(updated)
    await saveStoreAlertsToFirebase(updated)
    setNewAlertForm({ title: '', message: '', priority: 'normal' })
    showToast('Store notice published!')
  }

  const handleUpdateStoreAlert = async (alertId) => {
    if (!editAlertForm.title.trim() || !editAlertForm.message.trim()) return
    const updated = storeAlertsList.map(a => a.id === alertId ? {
      ...a,
      title: editAlertForm.title.trim(),
      message: editAlertForm.message.trim(),
      priority: editAlertForm.priority || 'normal'
    } : a)
    setStoreAlertsList(updated)
    await saveStoreAlertsToFirebase(updated)
    setEditingAlertId(null)
    showToast('Store notice updated!')
  }

  const handleDeleteStoreAlert = async (alertId) => {
    const updated = storeAlertsList.filter(a => a.id !== alertId)
    setStoreAlertsList(updated)
    await saveStoreAlertsToFirebase(updated)
    showToast('Store notice removed.')
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Fetch backend status
  const fetchStatus = useCallback(async () => {
    setSystemStatus({
      status: 'online',
      framework: 'Firebase Firestore',
      database: { connected: true, connection: 'firestore', database_name: 'group-one-usea' },
    })
  }, [])

  // Fetch Overview Data
  const fetchOverviewData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsData, checkinsData] = await Promise.all([
        getStatsFromFirebase(),
        getCheckinsFromFirebase(),
      ])
      if (statsData) {
        setStats(statsData)
      }
      setCheckins(checkinsData || [])
    } catch {
      showToast('Could not sync with Firebase.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch Staff & Performance
  const fetchStaffData = useCallback(async () => {
    try {
      const [staffData, perfData] = await Promise.all([
        getStaffFromFirebase(),
        getPerformanceFromFirebase(),
      ])
      setStaffList(staffData || [])
      if (perfData) {
        setPerformanceData(perfData)
      }
    } catch {
      // quiet catch
    }
  }, [])

  // Fetch Control Room (Today & QR)
  const fetchControlData = useCallback(async () => {
    try {
      const todayCtrl = await getTodayControlFromFirebase()
      setTodayData(todayCtrl || { summary: {}, data: [] })
      setQrConfig({
        target_url: `${window.location.origin}/#user`,
        cafe_name: cafeSettings.cafe_name || 'Chafé'
      })
    } catch {
      // quiet catch
    }
  }, [cafeSettings.cafe_name])

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const settings = await getSettingsFromFirebase()
      if (settings) {
        setCafeSettings(settings)
      }
    } catch {
      // quiet catch
    }
  }, [])

  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const initApp = async () => {
      try {
        await initFirebaseDatabase()
        await Promise.allSettled([
          fetchStatus(),
          fetchOverviewData(),
          fetchStaffData(),
          fetchControlData(),
          fetchSettings(),
        ])
      } finally {
        setTimeout(() => {
          if (mounted) setInitialLoading(false)
        }, 550)
      }
    }
    initApp()
    return () => { mounted = false }
  }, [fetchStatus, fetchOverviewData, fetchStaffData, fetchControlData, fetchSettings])

  // Real-time synchronization: listen for all checkin updates from any device (staff phone or terminal)
  const [refreshing, setRefreshing] = useState(false)
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.allSettled([
        fetchOverviewData(),
        fetchControlData(),
        fetchStaffData(),
      ])
      showToast('Live data refreshed!', 'success')
    } catch {
      // quiet
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }, [fetchOverviewData, fetchControlData, fetchStaffData, showToast])

  useEffect(() => {
    const unsubscribe = subscribeToLiveCheckins(async (liveCheckins) => {
      if (!liveCheckins) return
      setCheckins(liveCheckins)

      // Calculate today's short logs in real time
      const todayList = liveCheckins.filter(c => isTodayRecord(c.created_at || c.check_in_at))
      const activeNow = todayList.filter(c => c.status === 'checked_in').length
      const checkedOut = todayList.filter(c => c.status === 'checked_out').length
      setTodayData({
        summary: {
          active_now: activeNow,
          checked_out_today: checkedOut,
          total_today: todayList.length
        },
        data: todayList
      })

      // Sync top banner KPI stats in real time
      try {
        const statsData = await getStatsFromFirebase()
        if (statsData) setStats(statsData)
      } catch {
        // quiet
      }
    })

    // Periodic 8-second auto-poll fallback
    const pollInterval = setInterval(() => {
      fetchControlData()
      fetchOverviewData()
    }, 8000)

    return () => {
      unsubscribe()
      clearInterval(pollInterval)
    }
  }, [fetchControlData, fetchOverviewData])

  // Real-time synchronization for staff roster: updates immediately when admin changes branch/location
  useEffect(() => {
    const unsubStaff = subscribeToStaff(async (liveStaff) => {
      if (!liveStaff || liveStaff.length === 0) return
      setStaffList(liveStaff)
    })
    return () => {
      if (unsubStaff) unsubStaff()
    }
  }, [])

  // Check out person action
  const handleCheckOut = async (id, name) => {
    setActionLoadingId(id)
    try {
      await checkoutInFirebase(id)
      showToast(`${name || 'Guest'} checked out successfully!`)
      fetchOverviewData()
      fetchControlData()
      fetchStatus()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Create Check-In
  const handleCheckinSubmit = async (e) => {
    e.preventDefault()
    if (!checkinForm.name.trim() || !checkinForm.email.trim()) {
      showToast('Please provide name and email.', 'error')
      return
    }

    setCheckinSubmitting(true)
    try {
      const chosenBranchId = checkinForm.branch_id || (selectedBranchFilter !== 'all' ? selectedBranchFilter : (branches[0]?.id || 'branch_2'))
      const chosenBranch = branches.find(b => b.id === chosenBranchId) || branches[0]
      const payload = {
        ...checkinForm,
        branch_id: chosenBranch?.id || 'branch_2',
        branch_name: chosenBranch?.name || 'Chafé • Kohke',
      }
      await createCheckinInFirebase(payload)
      showToast(`${checkinForm.name} checked in!`)
      setIsCheckinModalOpen(false)
      setCheckinForm({
        name: '',
        email: '',
        type: 'guest',
        department: 'Main Dining',
        badge_no: 'TBL-01',
        location: 'Table 1',
        branch_id: branches[0]?.id || 'branch_2',
        branch_name: branches[0]?.name || 'Chafé • Kohke',
        note: '',
      })
      fetchOverviewData()
      fetchControlData()
      fetchStaffData()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setCheckinSubmitting(false)
    }
  }

  // Fetch Branches
  const fetchBranches = useCallback(async () => {
    try {
      const list = await getBranchesFromFirebase()
      if (list && list.length > 0) {
        setBranches(list)
        saveBranches(list)
      }
    } catch {
      // quiet
    }
  }, [])

  useEffect(() => {
    fetchBranches()
    const unsubscribe = subscribeToBranches((list) => {
      // Do not overwrite local branches while user is actively editing in Settings tab
      if (list && list.length > 0 && navTab !== 'settings') {
        setBranches(list)
      }
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [fetchBranches, navTab])

  // Save Branch Settings
  const handleSaveBranches = async (updatedBranches) => {
    setIsBranchesSaving(true)
    try {
      const targetList = updatedBranches || branches
      const sanitized = targetList.map(b => ({
        ...b,
        lat: typeof b.lat === 'number' ? b.lat : (parseFloat(b.lat) || 0),
        lng: typeof b.lng === 'number' ? b.lng : (parseFloat(b.lng) || 0),
        radiusMeters: typeof b.radiusMeters === 'number' ? b.radiusMeters : (parseInt(b.radiusMeters, 10) || 50),
      }))
      await saveBranchesToFirebase(sanitized)
      setBranches(sanitized)
      saveBranches(sanitized)
      showToast('Branch GPS & allowed scan distance saved successfully!', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to save branches', 'error')
    } finally {
      setIsBranchesSaving(false)
    }
  }

  // Create Staff
  const handleCreateStaffSubmit = async (e) => {
    e.preventDefault()
    const trimmedName = (staffForm.name || '').trim()
    if (!trimmedName) {
      showToast('Staff Full Name is required.', 'error')
      return
    }

    setStaffSubmitting(true)
    try {
      const targetBranch = branches.find(b => b.id === staffForm.branch_id) || branches[0]
      const branchName = staffForm.branch_id === 'all'
        ? 'All Branches (Floating)'
        : (targetBranch?.name || branches[0]?.name || 'Chafé • Kohke')

      const fallbackUsername = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '') || `staff_${Date.now()}`
      const username = (staffForm.username && staffForm.username.trim().toLowerCase()) || fallbackUsername
      const email = (staffForm.email && staffForm.email.trim().toLowerCase()) || `${username}@chafe.com`
      const password = (staffForm.password && staffForm.password.trim()) || '123456'

      const payload = {
        ...staffForm,
        name: trimmedName,
        email: email,
        username: username,
        password: password,
        branch_id: staffForm.branch_id || targetBranch?.id || (branches[0] ? branches[0].id : 'branch_2'),
        branch_name: branchName,
        location: branchName, // Auto change location to match branch
        branch_address: targetBranch?.address || 'Siem Reap, Cambodia',
      }

      const created = await createStaffInFirebase(payload)

      // Instantly update state in memory so the new staff member is visible immediately
      setStaffList(prev => {
        const filtered = (prev || []).filter(s => s.id !== created.id && s.email !== created.email)
        return [created, ...filtered]
      })

      // If branch filter was set to another branch, reset to 'all' so the new staff is visible in table
      if (selectedBranchFilter !== 'all' && selectedBranchFilter !== payload.branch_id) {
        setSelectedBranchFilter('all')
      }

      showToast(`Staff member ${trimmedName} created for ${payload.branch_name}!`)
      setIsCreateStaffModalOpen(false)
      setStaffForm({
        name: '',
        email: '',
        username: '',
        password: '',
        role: 'Barista',
        branch_id: branches[0]?.id || 'branch_2',
        branch_name: branches[0]?.name || 'Chafé • Kohke',
        shift_start: '07:30',
        shift_end: '16:00',
        hourly_rate: 20.00,
      })
      await fetchStaffData()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setStaffSubmitting(false)
    }
  }

  // Update Staff Role, Shift, Branch or Credentials
  // When admin changes Branch at staff, auto change location and sync checkin records in real time
  const handleUpdateStaff = async (staffId, updatedFields) => {
    try {
      if (updatedFields.branch_id || updatedFields.branch_name) {
        const chosenBranch = branches.find(b => b.id === updatedFields.branch_id) || branches[0]
        const branchName = updatedFields.branch_id === 'all' ? 'All Branches (Floating)' : (chosenBranch?.name || updatedFields.branch_name || 'Chafé • Kohke')
        updatedFields.branch_name = branchName
        updatedFields.location = branchName // Auto change location to match branch
        updatedFields.branch_address = chosenBranch?.address || 'Siem Reap, Cambodia'
      }

      setStaffList(prev => prev.map(s => String(s.id) === String(staffId) ? { ...s, ...updatedFields } : s))
      await updateStaffInFirebase(staffId, updatedFields)

      // Auto change location for this staff member's checkin records in real time
      if (updatedFields.branch_id) {
        await syncStaffCheckinsBranchInFirebase(
          staffId,
          updatedFields.branch_id,
          updatedFields.branch_name,
          updatedFields.location
        )
      }

      showToast('Staff profile & store location updated successfully!', 'success')
      setEditingStaff(null)
      await fetchStaffData()
      await fetchOverviewData()
    } catch (err) {
      showToast(err.message || 'Failed to update staff', 'error')
    }
  }

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSettingsSaving(true)
    try {
      await saveSettingsInFirebase(cafeSettings)
      await handleSaveBranches(branches)
      showToast('Settings & Multi-Branch GPS saved successfully!')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSettingsSaving(false)
    }
  }

  // Filtered & Sorted Table Items
  const filteredRows = useMemo(() => {
    const list = checkins.filter(item => {
      if (selectedBranchFilter !== 'all') {
        const matchedStaff = staffList.find(s => s.id === item.staff_id || s.name === item.name)
        const itemBranch = item.branch_id || matchedStaff?.branch_id || (branches[0] ? branches[0].id : null)
        const selectedBranchObj = branches.find(b => b.id === selectedBranchFilter)
        const itemBranchName = item.branch_name || matchedStaff?.branch_name
        const matchByName = selectedBranchObj && itemBranchName && (itemBranchName === selectedBranchObj.name || itemBranchName.includes(selectedBranchObj.name))
        if (itemBranch !== selectedBranchFilter && itemBranch !== 'all' && !matchByName) return false
      }

      if (activeTableFilter === 'inside' && item.status !== 'checked_in') return false
      if (activeTableFilter === 'checked_out' && item.status !== 'checked_out') return false

      if (advancedFilter === 'late' && item.punctuality_status !== 'late') return false
      if (advancedFilter === 'on_time' && item.punctuality_status === 'late') return false
      if (advancedFilter === 'staff' && item.type !== 'employee') return false
      if (advancedFilter === 'guest' && item.type === 'employee') return false

      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase()
        const matchName = item.name?.toLowerCase().includes(q)
        const matchTable = item.badge_no?.toLowerCase().includes(q)
        const matchDept = item.department?.toLowerCase().includes(q)
        const matchLoc = item.location?.toLowerCase().includes(q)
        const matchSec = item.location_verified ? 'gps verified secure' : 'cloud db'
        return matchName || matchTable || matchDept || matchLoc || matchSec.includes(q)
      }

      return true
    })

    return list.slice().sort((a, b) => {
      if (tableSort === 'security') {
        const aSec = (a.location_verified || (a.note && a.note.includes('GPS Verified'))) ? 1 : 0
        const bSec = (b.location_verified || (b.note && b.note.includes('GPS Verified'))) ? 1 : 0
        if (bSec !== aSec) return bSec - aSec
        const aTime = new Date(a.check_in_at || a.created_at || 0).getTime()
        const bTime = new Date(b.check_in_at || b.created_at || 0).getTime()
        return bTime - aTime
      }
      if (tableSort === 'newest') {
        const aTime = new Date(a.check_in_at || a.created_at || 0).getTime()
        const bTime = new Date(b.check_in_at || b.created_at || 0).getTime()
        return bTime - aTime
      }
      if (tableSort === 'oldest') {
        const aTime = new Date(a.check_in_at || a.created_at || 0).getTime()
        const bTime = new Date(b.check_in_at || b.created_at || 0).getTime()
        return aTime - bTime
      }
      if (tableSort === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '')
      }
      if (tableSort === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '')
      }
      if (tableSort === 'status') {
        const aActive = a.status === 'checked_in' ? 1 : 0
        const bActive = b.status === 'checked_in' ? 1 : 0
        if (bActive !== aActive) return bActive - aActive
        return 0
      }
      return 0
    })
  }, [checkins, activeTableFilter, advancedFilter, tableSearch, selectedBranchFilter, staffList, branches, tableSort])

  // Paginated Rows for Tasks & Notifications (Bottom Table Pagination)
  const totalTablePages = Math.max(1, Math.ceil(filteredRows.length / 10))

  const paginatedRows = useMemo(() => {
    if (tablePage === 0) return filteredRows
    const pageSize = 10
    const safePage = Math.min(Math.max(1, tablePage), totalTablePages)
    const startIndex = (safePage - 1) * pageSize
    return filteredRows.slice(startIndex, startIndex + pageSize)
  }, [filteredRows, tablePage, totalTablePages])

  useEffect(() => {
    if (tablePage !== 0 && tablePage > totalTablePages) {
      setTablePage(1)
    }
  }, [totalTablePages, tablePage])

  // Filtered Staff List by Branch
  const filteredStaffList = useMemo(() => {
    if (selectedBranchFilter === 'all') return staffList
    const selectedBranchObj = branches.find(b => b.id === selectedBranchFilter)
    return staffList.filter(s => {
      if (s.branch_id === 'all') return true
      if (s.branch_id === selectedBranchFilter) return true
      if (!s.branch_id && branches[0] && selectedBranchFilter === branches[0].id) return true
      if (selectedBranchObj && s.branch_name && (s.branch_name === selectedBranchObj.name || s.branch_name.includes(selectedBranchObj.name))) return true
      return false
    })
  }, [staffList, selectedBranchFilter, branches])

  // Audit Rows for Weekly & Monthly Tardiness & Clean Record Audit
  const auditRows = useMemo(() => {
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const periodStart = auditPeriod === 'weekly' ? oneWeekAgo : oneMonthAgo

    // Process strictly real registered staff in the database (no demo data)
    const list = (staffList || []).map(stf => {
      const stfCheckins = (checkins || []).filter(c => {
        if (c.type !== 'employee') return false
        if (String(c.staff_id) !== String(stf.id) && c.email !== stf.email) return false
        const cDate = new Date(c.check_in_at || c.created_at)
        return cDate >= periodStart
      })

      const totalShifts = stfCheckins.length
      const lateCount = stfCheckins.filter(c => c.punctuality_status === 'late').length
      const onTimeCount = Math.max(0, totalShifts - lateCount)
      const grade = totalShifts > 0 ? Math.round((onTimeCount / totalShifts) * 100) : 100

      const matchedBranch = (branches || []).find(b => b.id === stf.branch_id)
      const branchDisplay = stf.branch_name || matchedBranch?.name || (branches?.[0]?.name || 'Chafé • Main Store')

      return {
        id: stf.id,
        name: stf.name,
        role: stf.role || 'Staff',
        branch: branchDisplay,
        avatar: stf.photo_url || '',
        totalShifts,
        onTimeCount,
        lateCount,
        grade
      }
    })

    // Filter by auditStaffFilter
    let filtered = list
    if (auditStaffFilter === 'clean') {
      filtered = filtered.filter(r => r.lateCount === 0)
    } else if (auditStaffFilter === 'late') {
      filtered = filtered.filter(r => r.lateCount > 0)
    } else if (auditStaffFilter !== 'all') {
      filtered = filtered.filter(r => String(r.id) === String(auditStaffFilter) || r.name === auditStaffFilter)
    }

    return filtered
  }, [staffList, checkins, auditPeriod, auditStaffFilter, branches])

  // 12-Hour Time Formatter (e.g. "8:30 AM", "1:15 PM")
  const formatTime = (timeStr) => {
    if (!timeStr) return '-'
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) {
      const parts = timeStr.trim().split(':')
      let h = parseInt(parts[0], 10)
      const m = parts[1]
      const ampm = h >= 12 ? 'PM' : 'AM'
      h = h % 12 || 12
      return `${h}:${m} ${ampm}`
    }
    const d = new Date(timeStr)
    if (isNaN(d.getTime())) return timeStr
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatDate = (timeStr) => {
    if (!timeStr) return '02/28/2026'
    const d = new Date(timeStr)
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`
  }

  // Live System Alerts & Messages
  const allAlerts = useMemo(() => {
    const list = []

    // 1. Weekly Performance Alert (1/Week)
    if (cafeSettings.weekly_perf_alert !== false) {
      list.push({
        id: 'alert_weekly_perf',
        category: 'performance',
        severity: 'info',
        icon: '📊',
        badge: '1/Week Alert',
        title: 'Weekly Attendance & Punctuality Digest',
        message: `Weekly staff punctuality rating is ${performanceData.overall_punctuality || 100}%. ${performanceData.total_late_arrivals || 0} late arrivals recorded across ${performanceData.total_shifts || 0} shifts this week.`,
        timestamp: 'Active for this week',
        targetTab: 'performance',
      })
    }

    // 2. Monthly Performance Alert (1/Month)
    if (cafeSettings.monthly_perf_alert !== false) {
      list.push({
        id: 'alert_monthly_perf',
        category: 'performance',
        severity: 'success',
        icon: '🏆',
        badge: '1/Month Review',
        title: 'Monthly Staff Performance Review',
        message: `Monthly roster attendance review active. ${staffList.length} staff roster members registered. Punctuality standard at ${performanceData.overall_punctuality || 100}%. Action plans maintained.`,
        timestamp: 'Active for this month',
        targetTab: 'performance',
      })
    }

    // 3. Late Check-In Alerts
    const lateRecords = checkins.filter(c => c.punctuality_status === 'late')
    lateRecords.forEach((c) => {
      list.push({
        id: `late_${c.id}`,
        category: 'late',
        severity: 'warning',
        icon: '⚠️',
        badge: 'Late Alert',
        title: `Late Check-In Alert: ${c.name}`,
        message: `${c.name} clocked in at ${formatTime(c.check_in_at || c.created_at)} (Exceeded ${cafeSettings.late_grace_period_mins || 10}m grace period).`,
        timestamp: formatDate(c.check_in_at || c.created_at) + ' ' + formatTime(c.check_in_at || c.created_at),
        targetTab: 'performance',
      })
    })

    // 4. Live Check-In / Check-Out Alerts from recent activity
    checkins.forEach((c) => {
      if (c.status === 'checked_in') {
        list.push({
          id: `in_${c.id}`,
          category: 'checkin_out',
          severity: 'success',
          icon: '🟢',
          badge: 'Check-In',
          title: `Staff Check-In: ${c.name}`,
          message: `${c.name} clocked in at ${formatTime(c.check_in_at || c.created_at)} at ${c.location || 'Main Counter'}.`,
          timestamp: formatDate(c.check_in_at || c.created_at) + ' ' + formatTime(c.check_in_at || c.created_at),
          targetTab: 'overview',
        })
      } else if (c.status === 'checked_out') {
        list.push({
          id: `out_${c.id}`,
          category: 'checkin_out',
          severity: 'info',
          icon: '🔵',
          badge: 'Check-Out',
          title: `Staff Check-Out: ${c.name}`,
          message: `${c.name} completed shift and clocked out at ${formatTime(c.check_out_at || c.created_at)}.`,
          timestamp: formatDate(c.check_out_at || c.created_at) + ' ' + formatTime(c.check_out_at || c.created_at),
          targetTab: 'overview',
        })
      }
    })

    return list
  }, [checkins, performanceData, staffList, cafeSettings])

  const unreadAlertsCount = useMemo(() => {
    return allAlerts.filter(a => !readAlertIds.includes(a.id)).length
  }, [allAlerts, readAlertIds])

  const handleMarkAllAlertsRead = () => {
    const allIds = allAlerts.map(a => a.id)
    setReadAlertIds(allIds)
    try {
      localStorage.setItem('chafe_read_alerts', JSON.stringify(allIds))
    } catch {}
    showToast('All alerts marked as read', 'success')
  }

  const handleToggleAlertRead = (id) => {
    setReadAlertIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      try {
        localStorage.setItem('chafe_read_alerts', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // Handlers for goals & performance modals
  const handleSaveGoals = async (e) => {
    e.preventDefault()
    setSettingsSaving(true)
    try {
      await saveSettingsInFirebase(cafeSettings)
      showToast('Capacity & Goals updated successfully!', 'success')
      setIsGoalsModalOpen(false)
    } catch {
      showToast('Failed to save capacity settings', 'error')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSavePerfSettings = async (e) => {
    e.preventDefault()
    setSettingsSaving(true)
    try {
      await saveSettingsInFirebase(cafeSettings)
      showToast('Performance alert schedule saved!', 'success')
      setIsPerfModalOpen(false)
    } catch {
      showToast('Failed to save performance settings', 'error')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleTriggerWeeklyAlert = () => {
    showToast('Weekly Performance Summary alert generated!', 'success')
    setIsMessagesOpen(true)
  }

  const handleTriggerMonthlyAlert = () => {
    showToast('Monthly Staff Performance Review alert generated!', 'success')
    setIsMessagesOpen(true)
  }

  // Click outside and escape listeners for dropdowns and popups
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.admin-dropdown-container')) {
        setIsAdminMenuOpen(false)
      }
      if (!e.target.closest('.pill-filter-container')) {
        setIsTableFilterMenuOpen(false)
        setIsTableSortMenuOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsCheckinModalOpen(false)
        setIsCreateStaffModalOpen(false)
        setEditingStaff(null)
        setIsAdminMenuOpen(false)
        setIsMessagesOpen(false)
        setIsTableFilterMenuOpen(false)
        setIsTableSortMenuOpen(false)
        setIsPerfModalOpen(false)
        setIsGoalsModalOpen(false)
        setIsProfileModalOpen(false)
      }
    }
    document.addEventListener('click', handleDocumentClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleDocumentClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Seating capacity percentages (0 Data accurate)
  const seatingCap = cafeSettings.seating_capacity || 48
  const patioCap = cafeSettings.patio_capacity || 16
  const baristaTarget = cafeSettings.barista_target || 2
  const currentActive = stats.active_now ?? 0
  const occupancyPct = seatingCap > 0 ? Math.min(100, Math.round((currentActive / seatingCap) * 100)) : 0
  const patioOccupancyPct = patioCap > 0 ? Math.min(100, Math.round(((stats.patio_active || 0) / patioCap) * 100)) : 0
  const staffOnShiftCount = staffList.filter(s => s.is_on_shift).length
  const staffCoveragePct = baristaTarget > 0 ? Math.min(100, Math.round((staffOnShiftCount / baristaTarget) * 100)) : 0
  // Initial full-page loading screen
  if (initialLoading) {
    return <LoadingPage message="Connecting to Chafé Server..." />
  }

  // Authentication gate: If not logged in, render LoginForm
  if (!currentUser) {
    return (
      <>
        <LoginForm apiBase={API_BASE} onLoginSuccess={handleLoginSuccess} />
        {toast && (
          <div className="toast-container">
            <div className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          </div>
        )}
      </>
    )
  }

  // If logged in as Staff member, render dedicated Staff Portal
  if (currentUser.role === 'staff') {
    return (
      <>
        <StaffPortal
          apiBase={API_BASE}
          staffUser={currentUser.staff}
          onLogout={handleLogout}
          showToast={showToast}
        />
        {toast && (
          <div className="toast-container">
            <div className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          </div>
        )}
      </>
    )
  }

  // Dedicated USER / CAMERA CHECK-IN TERMINAL (Accessible by Admin)
  if (navTab === 'user' || navTab === 'staff-scan') {
    return (
      <UserDashboard
        apiBase={API_BASE}
        staffList={staffList}
        onShiftUpdated={() => {
          fetchOverviewData()
          fetchStaffData()
          fetchControlData()
        }}
        onSwitchToAdmin={() => setNavTab('overview')}
      />
    )
  }

  return (
    <div className="dashboard-root">
      {/* ============================================================== */}
      {/* 1. LEFT SIDEBAR (Enterprise Layout matching reference) */}
      {/* ============================================================== */}
      {sidebarOpen && (
        <aside className="sidebar">
          {/* Brand Name without Logo */}
          <div className="sidebar-header">
            <div className="sidebar-brand-text">
              Chafé <span className="sidebar-brand-accent">HR</span>
            </div>
          </div>

          {/* User Profile Section with clean SVG */}
          <div className="user-profile-section">
            <div className="user-avatar-circle">
              <IconUserCircle size={28} color="#475569" />
            </div>
            <div className="user-info-text">
              <span className="user-welcome-label">Welcome,</span>
              <span className="user-display-name">Administrator</span>
            </div>
          </div>

          {/* Sidebar Nav Items */}
          <div className="sidebar-nav">
            <div className="nav-section-title">WORKBENCH</div>
            <button
              className={`sidebar-nav-item ${navTab === 'overview' ? 'active' : ''}`}
              onClick={() => setNavTab('overview')}
            >
              <span className="nav-item-icon">
                <IconOverview size={16} />
              </span>
              <span>Overview</span>
            </button>
            <button
              className={`sidebar-nav-item ${navTab === 'performance' ? 'active' : ''}`}
              onClick={() => setNavTab('performance')}
            >
              <span className="nav-item-icon">
                <IconTrophy size={16} />
              </span>
              <span>Performance</span>
            </button>
            <button
              className={`sidebar-nav-item ${navTab === 'staff' ? 'active' : ''}`}
              onClick={() => setNavTab('staff')}
            >
              <span className="nav-item-icon">
                <IconUsers size={16} />
              </span>
              <span>Staff Roster</span>
            </button>
            <button
              className={`sidebar-nav-item ${navTab === 'dayoffs' ? 'active' : ''}`}
              onClick={() => setNavTab('dayoffs')}
            >
              <span className="nav-item-icon">
                <IconCalendar size={16} />
              </span>
              <span>Day Off Calendar</span>
            </button>
            <button
              className={`sidebar-nav-item ${navTab === 'control' ? 'active' : ''}`}
              onClick={() => setNavTab('control')}
            >
              <span className="nav-item-icon">
                <IconQrCode size={16} />
              </span>
              <span>Control & QR</span>
            </button>

            <div className="nav-section-title">GENERAL</div>
            <button
              className={`sidebar-nav-item ${navTab === 'settings' ? 'active' : ''}`}
              onClick={() => setNavTab('settings')}
            >
              <span className="nav-item-icon">
                <IconGear size={16} />
              </span>
              <span>Settings</span>
            </button>
          </div>

          {/* Bottom Logout Button */}
          <div className="sidebar-footer">
            <button
              className="btn-logout"
              title="Sign Out"
              onClick={handleLogout}
            >
              <IconLogOut size={18} />
            </button>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>v2.4.0</span>
          </div>
        </aside>
      )}

      {/* ============================================================== */}
      {/* 2. MAIN WRAPPER & TOP NAVBAR */}
      {/* ============================================================== */}
      <div className="main-wrapper">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div className="top-navbar-left">
            <button
              className="btn-hamburger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle sidebar"
            >
              <IconHamburger size={18} color="#475569" />
            </button>

            {/* Topbar Search */}
            <div className="topbar-search-box">
              <input
                type="text"
                className="topbar-search-input"
                placeholder="Search..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
              <span className="topbar-search-icon">
                <IconSearch size={14} color="#94a3b8" />
              </span>
            </div>
          </div>

          {/* Topbar Right Controls */}
          <div className="top-navbar-right">
            {/* Admin Dropdown Menu */}
            <div className="admin-dropdown-container">
              <button
                className="admin-dropdown-btn"
                onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                title="System Administrator Options"
              >
                <IconGear size={14} color="#64748b" />
                <span>System Administrator</span>
                <IconChevronDown size={11} color="#94a3b8" />
              </button>

              {isAdminMenuOpen && (
                <div className="admin-dropdown-menu">
                  <div className="admin-dropdown-header">Quick Navigation</div>
                  <button
                    className="admin-dropdown-item"
                    onClick={() => { setNavTab('settings'); setIsAdminMenuOpen(false) }}
                  >
                    <IconGear size={14} color="#f97316" />
                    <span>System Settings</span>
                  </button>
                  <button
                    className="admin-dropdown-item"
                    onClick={() => { setNavTab('staff'); setIsAdminMenuOpen(false) }}
                  >
                    <IconUsers size={14} color="#0284c7" />
                    <span>Staff Directory</span>
                  </button>
                  <button
                    className="admin-dropdown-item"
                    onClick={() => { setNavTab('performance'); setIsAdminMenuOpen(false) }}
                  >
                    <IconTrophy size={14} color="#10b981" />
                    <span>Performance Reviews</span>
                  </button>
                  <button
                    className="admin-dropdown-item"
                    onClick={() => { setNavTab('dayoffs'); setIsAdminMenuOpen(false) }}
                  >
                    <IconCalendar size={14} color="#d97706" />
                    <span>Day Off Calendar</span>
                  </button>
                  <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />
                  <button
                    className="admin-dropdown-item"
                    onClick={() => { setIsAdminMenuOpen(false); handleLogout() }}
                    style={{ color: '#ef4444' }}
                  >
                    <IconLogOut size={14} color="#ef4444" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Messages & Alerts Envelope */}
            <button
              className="icon-badge-btn"
              title="System Alerts & Messages"
              onClick={() => setIsMessagesOpen(true)}
            >
              <IconEnvelope size={17} color="#64748b" />
              <span className={`badge-count ${unreadAlertsCount === 0 ? 'zero' : ''}`}>
                {unreadAlertsCount}
              </span>
            </button>

            {/* Administrator Profile Thumbnail */}
            <div
              className="user-thumbnail-header"
              onClick={() => setIsProfileModalOpen(true)}
              title="Click to view Administrator Profile"
            >
              <div className="user-thumbnail-avatar">
                <IconUserCircle size={18} color="#475569" />
              </div>
              <span className="user-thumbnail-name">Administrator</span>
            </div>

            <button
              className="btn-secondary"
              onClick={handleLogout}
              style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px' }}
              title="Sign Out"
            >
              <IconLogOut size={14} color="#ef4444" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* ============================================================== */}
        {/* 3. PAGE BODY CONTENT */}
        {/* ============================================================== */}
        <main className="page-container">
          {/* Page Title & Breadcrumb */}
          <div className="page-title-row">
            <h1 className="page-main-heading">
              {navTab === 'overview' && 'Dashboard'}
              {navTab === 'performance' && 'Staff Performance & Punctuality'}
              {navTab === 'staff' && 'Staff Directory & Credentials'}
              {navTab === 'dayoffs' && 'Staff Day Off & Schedule Calendar'}
              {navTab === 'control' && 'Control Room & QR Terminal'}
              {navTab === 'settings' && 'System Settings'}
              {navTab === 'staff-scan' && 'Staff Camera Check-In Terminal'}
            </h1>
            <div className="page-breadcrumb">
              Overview {navTab !== 'overview' && ` / ${navTab === 'staff-scan' ? 'Camera Scanner' : navTab.charAt(0).toUpperCase() + navTab.slice(1)}`}
            </div>
          </div>

          {/* Subheading row: Arrow Pointer + Start (Only on Overview page) */}
          {navTab === 'overview' && (
            <div className="section-subheading-row">
              <IconArrowPointer size={16} color="#1e293b" />
              <span>Start</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* 4 COLOR BANNER KPI CARDS (Only on Overview page) */}
          {/* ============================================================== */}
          {navTab === 'overview' && (
            loading ? (
              <SkeletonBannerCards />
            ) : (
              <section className="kpi-cards-row" aria-label="Staff Attendance KPIs">
                {/* Card 1: Vivid Magenta (TOTAL STAFF) */}
                <div
                  className="kpi-banner-card magenta"
                  onClick={() => setNavTab('staff')}
                  title="Click to view Staff Roster"
                >
                  <div className="kpi-banner-icon">
                    <IconUsers size={40} color="#ffffff" />
                  </div>
                  <div className="kpi-banner-content">
                    <span className="kpi-banner-label">TOTAL STAFF</span>
                    <span className="kpi-banner-value">{stats.total_staff || staffList.length}</span>
                  </div>
                </div>

                {/* Card 2: Vivid Cyan (CHECK IN TODAY) */}
                <div
                  className="kpi-banner-card cyan"
                  onClick={() => setActiveTableFilter('inside')}
                  title="Click to filter to Checked-In staff"
                >
                  <div className="kpi-banner-icon">
                    <IconPeaceHand size={42} color="#ffffff" />
                  </div>
                  <div className="kpi-banner-content">
                    <span className="kpi-banner-label">CHECK IN TODAY</span>
                    <span className="kpi-banner-value">{stats.staff_checked_in_today ?? staffList.filter(s => s.is_on_shift).length}</span>
                  </div>
                </div>

                {/* Card 3: Vivid Green (CHECK OUT TODAY) */}
                <div
                  className="kpi-banner-card green"
                  onClick={() => setActiveTableFilter('checked_out')}
                  title="Click to filter to Departed staff"
                >
                  <div className="kpi-banner-icon">
                    <IconCocktail size={42} color="#ffffff" />
                  </div>
                  <div className="kpi-banner-content">
                    <span className="kpi-banner-label">CHECK OUT TODAY</span>
                    <span className="kpi-banner-value">{stats.staff_checked_out_today ?? 0}</span>
                  </div>
                </div>

                {/* Card 4: Vivid Amber/Orange (DAYOFF TODAY) */}
                <div
                  className="kpi-banner-card amber"
                  onClick={() => setNavTab('dayoffs')}
                  title="Click to view Day Off Calendar"
                >
                  <div className="kpi-banner-icon">
                    <IconCalendar size={40} color="#ffffff" />
                  </div>
                  <div className="kpi-banner-content">
                    <span className="kpi-banner-label">DAYOFF TODAY</span>
                    <span className="kpi-banner-value">{stats.dayoff_today ?? staffList.filter(s => s.has_dayoff_today).length}</span>
                  </div>
                </div>
              </section>
            )
          )}

          {/* ============================================================== */}
          {/* TAB 1: OVERVIEW (Tasks & Notifications table) */}
          {/* ============================================================== */}
          {navTab === 'overview' && (
            <div>
              {/* Main Table Card */}
              <div className="content-panel">
                <div className="panel-header-bar">
                  <div className="panel-heading-title">
                    TASKS & NOTIFICATIONS (CHECK-IN / CHECK-OUT)
                  </div>
                  <button
                    className="panel-gear-btn"
                    title="Open Messages & Alerts Center"
                    onClick={() => setIsMessagesOpen(true)}
                  >
                    <IconGear size={16} />
                  </button>
                </div>

                {/* Sub Controls: Filter Pills & Quick Action */}
                <div className="panel-sub-controls">
                  <div className="pill-filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginRight: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Branch (សាខា):</span>
                      <select
                        value={selectedBranchFilter}
                        onChange={(e) => setSelectedBranchFilter(e.target.value)}
                        style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
                      >
                        <option value="all">🏢 All Branches (សាខាទាំងអស់)</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      className={`pill-filter-btn ${activeTableFilter === 'today' ? 'active' : ''}`}
                      onClick={() => setActiveTableFilter('today')}
                    >
                      Today
                    </button>
                    <button
                      className={`pill-filter-btn ${activeTableFilter === 'inside' ? 'active' : ''}`}
                      onClick={() => setActiveTableFilter('inside')}
                    >
                      Inside ({stats.active_now ?? 0})
                    </button>
                    <button
                      className={`pill-filter-btn ${activeTableFilter === 'checked_out' ? 'active' : ''}`}
                      onClick={() => setActiveTableFilter('checked_out')}
                    >
                      Departed
                    </button>

                    {/* Filter Dropdown */}
                    <div className="pill-filter-container">
                      <button
                        className={`pill-filter-btn ${advancedFilter !== 'all' ? 'active' : ''}`}
                        onClick={() => {
                          setIsTableFilterMenuOpen(!isTableFilterMenuOpen)
                          setIsTableSortMenuOpen(false)
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>
                          {advancedFilter === 'all' && 'Filter'}
                          {advancedFilter === 'late' && 'Filter: Late Shifts'}
                          {advancedFilter === 'on_time' && 'Filter: On-Time'}
                          {advancedFilter === 'staff' && 'Filter: Staff Only'}
                          {advancedFilter === 'guest' && 'Filter: Guests Only'}
                        </span>
                        <IconChevronDown size={10} />
                      </button>

                      {isTableFilterMenuOpen && (
                        <div className="filter-dropdown-menu">
                          <button
                            className={`filter-dropdown-item ${advancedFilter === 'all' ? 'active' : ''}`}
                            onClick={() => { setAdvancedFilter('all'); setIsTableFilterMenuOpen(false) }}
                          >
                            <span>All Records</span>
                            {advancedFilter === 'all' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                          <button
                            className={`filter-dropdown-item ${advancedFilter === 'late' ? 'active' : ''}`}
                            onClick={() => { setAdvancedFilter('late'); setIsTableFilterMenuOpen(false) }}
                          >
                            <span style={{ color: '#dc2626' }}>⚠️ Late Arrivals Only</span>
                            {advancedFilter === 'late' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                          <button
                            className={`filter-dropdown-item ${advancedFilter === 'on_time' ? 'active' : ''}`}
                            onClick={() => { setAdvancedFilter('on_time'); setIsTableFilterMenuOpen(false) }}
                          >
                            <span>✓ On-Time Shifts Only</span>
                            {advancedFilter === 'on_time' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                          <button
                            className={`filter-dropdown-item ${advancedFilter === 'staff' ? 'active' : ''}`}
                            onClick={() => { setAdvancedFilter('staff'); setIsTableFilterMenuOpen(false) }}
                          >
                            <span>👥 Staff Members Only</span>
                            {advancedFilter === 'staff' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                          <button
                            className={`filter-dropdown-item ${advancedFilter === 'guest' ? 'active' : ''}`}
                            onClick={() => { setAdvancedFilter('guest'); setIsTableFilterMenuOpen(false) }}
                          >
                            <span>☕ Guests / Visitors Only</span>
                            {advancedFilter === 'guest' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sort Dropdown for Security & Database Requests */}
                    <div className="pill-filter-container">
                      <button
                        className={`pill-filter-btn ${tableSort !== 'newest' ? 'active' : ''}`}
                        onClick={() => {
                          setIsTableSortMenuOpen(!isTableSortMenuOpen)
                          setIsTableFilterMenuOpen(false)
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Sort records by security database request, timestamp, or name"
                      >
                        <IconArrowPointer size={11} style={{ transform: 'rotate(90deg)' }} />
                        <span>
                          {tableSort === 'security' && 'Sort: 🛡️ Security Verified'}
                          {tableSort === 'newest' && 'Sort: 🕒 Newest'}
                          {tableSort === 'oldest' && 'Sort: ⏳ Oldest'}
                          {tableSort === 'name_asc' && 'Sort: 🔤 Name (A-Z)'}
                          {tableSort === 'name_desc' && 'Sort: 🔤 Name (Z-A)'}
                          {tableSort === 'status' && 'Sort: ⚡ Active First'}
                        </span>
                        <IconChevronDown size={10} />
                      </button>

                      {isTableSortMenuOpen && (
                        <div className="filter-dropdown-menu">
                          <button
                            className={`filter-dropdown-item ${tableSort === 'security' ? 'active' : ''}`}
                            onClick={() => { setTableSort('security'); setIsTableSortMenuOpen(false) }}
                          >
                            <span style={{ color: '#0284c7', fontWeight: 700 }}>🛡️ Security Verified First</span>
                            {tableSort === 'security' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                          <button
                            className={`filter-dropdown-item ${tableSort === 'newest' ? 'active' : ''}`}
                            onClick={() => { setTableSort('newest'); setIsTableSortMenuOpen(false) }}
                          >
                            <span>🕒 Newest First (Latest Request)</span>
                            {tableSort === 'newest' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                          <button
                            className={`filter-dropdown-item ${tableSort === 'oldest' ? 'active' : ''}`}
                            onClick={() => { setTableSort('oldest'); setIsTableSortMenuOpen(false) }}
                          >
                            <span>⏳ Oldest First</span>
                            {tableSort === 'oldest' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                          <button
                            className={`filter-dropdown-item ${tableSort === 'name_asc' ? 'active' : ''}`}
                            onClick={() => { setTableSort('name_asc'); setIsTableSortMenuOpen(false) }}
                          >
                            <span>🔤 Name (A → Z)</span>
                            {tableSort === 'name_asc' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                          <button
                            className={`filter-dropdown-item ${tableSort === 'name_desc' ? 'active' : ''}`}
                            onClick={() => { setTableSort('name_desc'); setIsTableSortMenuOpen(false) }}
                          >
                            <span>🔤 Name (Z → A)</span>
                            {tableSort === 'name_desc' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                          <button
                            className={`filter-dropdown-item ${tableSort === 'status' ? 'active' : ''}`}
                            onClick={() => { setTableSort('status'); setIsTableSortMenuOpen(false) }}
                          >
                            <span>⚡ Status (Active Checked-In First)</span>
                            {tableSort === 'status' && <IconCheck size={12} color="#ea580c" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    className="btn-quick-task"
                    onClick={() => setIsCheckinModalOpen(true)}
                  >
                    <IconPlus size={14} color="#ea580c" />
                    <span>Quick Check-In</span>
                  </button>
                </div>

                {/* Search Strip inside table card */}
                <div className="panel-search-strip">
                  <input
                    type="text"
                    className="table-filter-search"
                    placeholder="Search guest, table, badge..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                  />
                </div>

                {/* Corporate Table */}
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th 
                          onClick={() => setTableSort(s => s === 'name_asc' ? 'name_desc' : 'name_asc')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          title="Click to sort by Name"
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>Guest / Staff Name</span>
                            <span style={{ fontSize: '10px', color: tableSort.startsWith('name') ? '#ea580c' : '#94a3b8' }}>
                              {tableSort === 'name_asc' ? '▲' : tableSort === 'name_desc' ? '▼' : '⇅'}
                            </span>
                          </div>
                        </th>
                        <th>Assigned Table</th>
                        <th 
                          onClick={() => setTableSort(s => s === 'newest' ? 'oldest' : 'newest')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          title="Click to sort by Logged Time"
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>Due Date / Logged</span>
                            <span style={{ fontSize: '10px', color: (tableSort === 'newest' || tableSort === 'oldest') ? '#ea580c' : '#94a3b8' }}>
                              {tableSort === 'newest' ? '▼' : tableSort === 'oldest' ? '▲' : '⇅'}
                            </span>
                          </div>
                        </th>
                        <th 
                          onClick={() => setTableSort(s => s === 'status' ? 'newest' : 'status')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          title="Click to sort by Active Status"
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>Filter / Role</span>
                            <span style={{ fontSize: '10px', color: tableSort === 'status' ? '#ea580c' : '#94a3b8' }}>
                              {tableSort === 'status' ? '▼' : '⇅'}
                            </span>
                          </div>
                        </th>
                        <th 
                          onClick={() => setTableSort(s => s === 'security' ? 'newest' : 'security')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          title="Click to sort by Security Database Request (Verified First)"
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>Security Request</span>
                            <span style={{ fontSize: '10px', color: tableSort === 'security' ? '#0284c7' : '#94a3b8' }}>
                              {tableSort === 'security' ? '🛡️' : '⇅'}
                            </span>
                          </div>
                        </th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="6" style={{ padding: 0 }}>
                            <SkeletonTable rows={5} columns={6} />
                          </td>
                        </tr>
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            No activity records found for today.
                          </td>
                        </tr>
                      ) : paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            No activity records on Page {tablePage}. Click '0' to show all records, or '1' to go to page 1.
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((item) => {
                          const isInside = item.status === 'checked_in'
                          const matchedStaff = staffList.find(s => s.id === item.staff_id || s.name === item.name)
                          const photo = item.photo_url || matchedStaff?.photo_url || ''
                          return (
                            <tr key={item.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div className="table-staff-avatar-wrap">
                                    {photo ? (
                                      <img
                                        src={photo}
                                        alt={item.name}
                                        className="table-staff-avatar-img"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none'
                                          const fb = e.currentTarget.nextElementSibling
                                          if (fb) fb.style.display = 'flex'
                                        }}
                                      />
                                    ) : null}
                                    <div
                                      className="table-staff-avatar-initials"
                                      style={{ display: photo ? 'none' : 'flex' }}
                                    >
                                      {(item.name || 'G').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="task-name-text">{item.name}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                      {item.note || item.email}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <div className="assigned-to-cell">
                                  <span>Me</span>
                                  <div className="user-chip-avatar">
                                    {item.name ? item.name.charAt(0).toUpperCase() : 'G'}
                                  </div>
                                  <span style={{ fontSize: '12px', fontWeight: 600 }}>
                                    {item.location || 'Main Counter'}
                                  </span>
                                </div>
                              </td>

                              <td>
                                <div className={`due-date-text ${isInside ? 'on-time' : ''}`}>
                                  {formatDate(item.check_in_at || item.created_at)} ({formatTime(item.check_in_at || item.created_at)})
                                </div>
                              </td>

                              <td>
                                <span className={`badge-tag-pill ${isInside ? '' : 'completed'}`}>
                                  {isInside ? 'Seated (Active)' : 'Checked Out'}
                                </span>
                              </td>

                              <td>
                                {item.location_verified || (item.note && item.note.includes('GPS Verified')) ? (
                                  <span className="security-tag-badge verified" title={`GPS Geofenced & Database Verified (${item.distance_to_store_meters ? Math.round(item.distance_to_store_meters) + 'm' : 'Secured'})`}>
                                    <span className="sec-dot verified"></span>
                                    <span>GPS Verified</span>
                                  </span>
                                ) : (
                                  <span className="security-tag-badge standard" title="Cloud Database Synchronized Record">
                                    <span className="sec-dot standard"></span>
                                    <span>Cloud DB</span>
                                  </span>
                                )}
                              </td>

                              <td>
                                <div className="action-icons-cell">
                                  {isInside && (
                                    <button
                                      className="btn-icon-check"
                                      title="Mark Checked Out"
                                      onClick={() => handleCheckOut(item.id, item.name)}
                                      disabled={actionLoadingId === item.id}
                                    >
                                      <IconCheck size={11} color="#10b981" />
                                    </button>
                                  )}
                                  <button
                                    className="btn-dots-menu"
                                    title="Options"
                                    onClick={async () => {
                                      if (!window.confirm('Delete this record?')) return
                                      await deleteCheckinInFirebase(item.id)
                                      fetchOverviewData()
                                    }}
                                  >
                                    <IconMoreVertical size={16} color="#64748b" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Pagination (Only one pager at bottom table) */}
                <div className="table-pagination-footer">
                  <div className="table-pagination-info">
                    {lang === 'kh' ? 'សរុប' : 'Total'}: {filteredRows.length} | {lang === 'kh' ? 'ទំព័រ' : 'Page'} {tablePage}/{totalTablePages}
                  </div>
                  <div className="table-pagination-controls">
                    <button
                      type="button"
                      className="pager-nav-btn"
                      disabled={tablePage <= 1}
                      onClick={() => setTablePage(1)}
                      title={lang === 'kh' ? 'ទំព័រដំបូង' : 'First Page'}
                    >
                      «
                    </button>
                    <button
                      type="button"
                      className="pager-nav-btn"
                      disabled={tablePage <= 1}
                      onClick={() => setTablePage(p => Math.max(1, p - 1))}
                      title={lang === 'kh' ? 'ទំព័រមុន' : 'Previous Page'}
                    >
                      ‹
                    </button>
                    {getPaginationItems(tablePage, totalTablePages).map((item, idx) => (
                      item === '...' ? (
                        <span key={`dots-${idx}`} className="pager-ellipsis">...</span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          className={`pager-num-btn ${tablePage === item ? 'active' : ''}`}
                          onClick={() => setTablePage(item)}
                        >
                          {item}
                        </button>
                      )
                    ))}
                    <button
                      type="button"
                      className="pager-nav-btn"
                      disabled={tablePage >= totalTablePages}
                      onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))}
                      title={lang === 'kh' ? 'ទំព័របន្ទាប់' : 'Next Page'}
                    >
                      ›
                    </button>
                    <button
                      type="button"
                      className="pager-nav-btn"
                      disabled={tablePage >= totalTablePages}
                      onClick={() => setTablePage(totalTablePages)}
                      title={lang === 'kh' ? 'ទំព័រចុងក្រោយ' : 'Last Page'}
                    >
                      »
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom 2 Widgets (My Performance & Goals) */}
              <div className="bottom-widgets-grid">
                {/* Bottom Left: MY PERFORMANCE */}
                <div className="content-panel">
                  <div className="panel-header-bar">
                    <div className="panel-heading-title">MY PERFORMANCE</div>
                    <button
                      className="panel-gear-btn"
                      onClick={() => setIsPerfModalOpen(true)}
                      title="Configure Performance Alerts (1/Week & 1/Month)"
                    >
                      <IconGear size={16} />
                    </button>
                  </div>
                  <div style={{ padding: '16px 24px' }}>
                    <div className="widget-row">
                      <span className="widget-label">NEXT REVIEW</span>
                      <div className="widget-value-group">
                        <span style={{ fontWeight: 700 }}>17 July 2026</span>
                        <span className="badge-status-pill blue">Not Yet Opened</span>
                      </div>
                    </div>

                    <div className="widget-row">
                      <span className="widget-label">LAST REVIEW</span>
                      <div className="widget-value-group">
                        <span style={{ fontWeight: 700 }}>17 July 2025</span>
                        <span className="badge-status-pill green">Completed</span>
                      </div>
                    </div>

                    <div className="widget-row">
                      <span className="widget-label">CURRENT SHIFT PUNCTUALITY</span>
                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                        {performanceData.total_shifts > 0
                          ? `${performanceData.overall_punctuality}% Good Standing`
                          : '0% (No shifts logged)'}
                      </strong>
                    </div>

                    <div className="widget-row">
                      <span className="widget-label">ACTION PLANS / LATE SHIFTS</span>
                      <strong
                        style={{
                          color: (performanceData.total_late_arrivals ?? 0) > 0 ? '#ea580c' : '#10b981',
                          fontSize: '13px',
                        }}
                      >
                        {performanceData.total_late_arrivals ?? 0} Late Shifts Flagged
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Bottom Right: GOALS & SEATING CAPACITY */}
                <div className="content-panel">
                  <div className="panel-header-bar">
                    <div className="panel-heading-title">SEATING CAPACITY & GOALS</div>
                    <button
                      className="panel-gear-btn"
                      onClick={() => setIsGoalsModalOpen(true)}
                      title="Configure Seating Capacity & Targets"
                    >
                      <IconGear size={16} />
                    </button>
                  </div>
                  <div style={{ padding: '16px 24px' }}>
                    <div className="widget-row" style={{ paddingBottom: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#64748b' }}>Goal / Station</span>
                      <span style={{ fontWeight: 700, color: '#64748b' }}>Progress</span>
                    </div>

                    <div className="widget-row">
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        Main Dining ({currentActive} / {seatingCap})
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="progress-bar-container">
                          <div className="progress-bar-inner teal" style={{ width: `${occupancyPct}%` }}></div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, width: '32px' }}>{occupancyPct}%</span>
                      </div>
                    </div>

                    <div className="widget-row">
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        Garden Patio Seating (0 / {patioCap})
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="progress-bar-container">
                          <div className="progress-bar-inner" style={{ width: `${patioOccupancyPct}%` }}></div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, width: '32px' }}>{patioOccupancyPct}%</span>
                      </div>
                    </div>

                    <div className="widget-row">
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        Barista Shift Coverage ({staffOnShiftCount} / {baristaTarget})
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="progress-bar-container">
                          <div className="progress-bar-inner" style={{ width: `${staffCoveragePct}%`, backgroundColor: '#f97316' }}></div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, width: '32px' }}>{staffCoveragePct}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: PERFORMANCE (Good staff performance, check in late or good) */}
          {/* ============================================================== */}
          {/* ============================================================== */}
          {/* TAB 2: PERFORMANCE (Weekly & Monthly Tardiness & Clean Record Audit) */}
          {/* ============================================================== */}
          {navTab === 'performance' && (
            <div>
              <div className="audit-panel-card">
                {/* Header Row matching screenshot */}
                <div className="audit-header-row">
                  <div className="audit-title-block">
                    <span className="audit-title-icon">👥</span>
                    <div>
                      <h3 className="audit-title-main">
                        Weekly & Monthly Tardiness & Clean Record Audit
                      </h3>
                      <p className="audit-title-subtitle">
                        Filter and inspect who has 0 late records vs how many times each staff member arrived late
                      </p>
                    </div>
                  </div>

                  <div className="audit-controls-row">
                    {/* Weekly / Monthly Toggle */}
                    <div className="audit-toggle-pill">
                      <button
                        type="button"
                        className={`audit-toggle-btn ${auditPeriod === 'weekly' ? 'active' : ''}`}
                        onClick={() => setAuditPeriod('weekly')}
                      >
                        Weekly
                      </button>
                      <button
                        type="button"
                        className={`audit-toggle-btn ${auditPeriod === 'monthly' ? 'active' : ''}`}
                        onClick={() => setAuditPeriod('monthly')}
                      >
                        Monthly
                      </button>
                    </div>

                    {/* Filter Dropdown */}
                    <select
                      className="audit-filter-select"
                      value={auditStaffFilter}
                      onChange={(e) => setAuditStaffFilter(e.target.value)}
                    >
                      <option value="all">All Staff Members</option>
                      <option value="clean">Never Late (0) Only</option>
                      <option value="late">Tardy Records Only</option>
                      {(staffList || []).map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Audit Table */}
                <div className="audit-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Barista / Staff</th>
                        <th>Branch</th>
                        <th>Total Shifts ({auditPeriod === 'weekly' ? 'Weekly' : 'Monthly'})</th>
                        <th>On-Time Count</th>
                        <th>Late Count</th>
                        <th>Status Classification</th>
                        <th style={{ textAlign: 'right' }}>Punctuality Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                            {(staffList || []).length === 0 
                              ? 'No staff members registered yet. Add staff to begin tracking attendance.' 
                              : 'No staff records match the selected filter.'}
                          </td>
                        </tr>
                      ) : (
                        auditRows.map((staff) => {
                          const isNeverLate = staff.lateCount === 0
                          const initials = (staff.name || 'ST').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()

                          return (
                            <tr key={staff.id}>
                              <td>
                                <div className="audit-staff-cell">
                                  {staff.avatar ? (
                                    <img
                                      src={staff.avatar}
                                      alt={staff.name}
                                      className="audit-staff-avatar"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                        if (e.currentTarget.nextElementSibling) {
                                          e.currentTarget.nextElementSibling.style.display = 'flex'
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className="audit-staff-avatar"
                                    style={{ display: staff.avatar ? 'none' : 'flex' }}
                                  >
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="audit-staff-name">{staff.name}</div>
                                    <div className="audit-staff-role">{staff.role}</div>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <span className="audit-branch-text">{staff.branch}</span>
                              </td>

                              <td>
                                <span className="audit-shifts-text">{staff.totalShifts} Shifts</span>
                              </td>

                              <td>
                                <span className="audit-ontime-text">{staff.onTimeCount} Shifts</span>
                              </td>

                              <td>
                                {isNeverLate ? (
                                  <span className="audit-late-zero">0 Times</span>
                                ) : (
                                  <span className="audit-late-flagged">{staff.lateCount} Times</span>
                                )}
                              </td>

                              <td>
                                {isNeverLate ? (
                                  <span className="audit-badge-clean">Never Late (0)</span>
                                ) : (
                                  <span className="audit-badge-late">⚠️ {staff.lateCount} Late Record(s)</span>
                                )}
                              </td>

                              <td>
                                <span className={`audit-grade-text ${
                                  staff.grade === 100 ? 'audit-grade-100' :
                                  staff.grade >= 95 ? 'audit-grade-95' :
                                  staff.grade >= 90 ? 'audit-grade-90' :
                                  'audit-grade-sub90'
                                }`}>
                                  {staff.grade}%
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: STAFF (View list staff, assign role, time, create staff) */}
          {/* ============================================================== */}
          {navTab === 'staff' && (
            <div>
              <div className="content-panel">
                <div className="panel-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div className="panel-heading-title">CHAFÉ STAFF ROSTER & ROLE ASSIGNMENT</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Branch (សាខា):</span>
                      <select
                        value={selectedBranchFilter}
                        onChange={(e) => setSelectedBranchFilter(e.target.value)}
                        style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
                      >
                        <option value="all">🏢 All Branches (សាខាទាំងអស់)</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn-primary"
                      style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setIsCreateStaffModalOpen(true)}
                    >
                      <IconPlus size={13} color="#ffffff" />
                      <span>Create Staff</span>
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Staff Name</th>
                        <th>Login ID (Username)</th>
                        <th>Branch (សាខា)</th>
                        <th>Assigned Role</th>
                        <th>Shift Schedule Time</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="7" style={{ padding: 0 }}>
                            <SkeletonTable rows={6} columns={7} />
                          </td>
                        </tr>
                      ) : filteredStaffList.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            No staff members found for the selected branch. Click "+ Create Staff" to add team members.
                          </td>
                        </tr>
                      ) : (
                        filteredStaffList.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="table-staff-avatar-wrap">
                                  {s.photo_url ? (
                                    <img
                                      src={s.photo_url}
                                      alt={s.name}
                                      className="table-staff-avatar-img"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                        const fb = e.currentTarget.nextElementSibling
                                        if (fb) fb.style.display = 'flex'
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className="table-staff-avatar-initials"
                                    style={{ display: s.photo_url ? 'none' : 'flex' }}
                                  >
                                    {(s.name || 'ST').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                  </div>
                                </div>
                                <div>
                                  <div className="task-name-text">{s.name}</div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.email}</div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span
                                className="badge-tag-pill"
                                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0284c7', fontWeight: 700 }}
                              >
                                @{s.username || 'staff'}
                              </span>
                            </td>

                            <td>
                              <span
                                className="branch-badge"
                                style={{ fontSize: '11px' }}
                              >
                                📍 {branches.find(b => b.id === s.branch_id)?.name || s.branch_name || branches[0]?.name || 'Store'}
                              </span>
                            </td>

                            <td>
                              <span className="badge-tag-pill">{s.role}</span>
                            </td>

                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <IconClock size={13} color="#64748b" />
                                <strong>{formatTime(s.shift_start)} - {formatTime(s.shift_end)}</strong>
                              </div>
                            </td>

                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                <span className={`badge-status-pill ${s.is_on_shift ? 'green' : 'blue'}`}>
                                  {s.is_on_shift ? 'On Shift' : 'Off Duty'}
                                </span>
                                {s.has_dayoff_today && (
                                  <span className="badge-status-pill amber" style={{ fontSize: '10px' }}>
                                    🌴 Day Off Today
                                  </span>
                                )}
                              </div>
                            </td>

                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px', marginRight: '6px', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => setNavTab('dayoffs')}
                                title="Assign Day Off in Calendar"
                              >
                                <IconCalendar size={12} />
                                <span>Day Off</span>
                              </button>
                              <button
                                className="btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px', marginRight: '6px' }}
                                onClick={() => setEditingStaff({ ...s, new_password: '' })}
                              >
                                Edit / Login
                              </button>
                              <button
                                className="btn-dots-menu"
                                title="Delete staff"
                                onClick={async () => {
                                  if (!window.confirm(`Delete ${s.name}?`)) return
                                  await deleteStaffInFirebase(s.id)
                                  fetchStaffData()
                                }}
                              >
                                <IconTrash size={14} color="#ef4444" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3.5: DAY OFF & SCHEDULE CALENDAR */}
          {/* ============================================================== */}
          {navTab === 'dayoffs' && (
            <DayoffCalendar
              apiBase={API_BASE}
              staffList={staffList}
              showToast={showToast}
            />
          )}

          {/* ============================================================== */}
          {/* TAB 4: CONTROL (Create QR check in/out, short only today) */}
          {/* ============================================================== */}
          {navTab === 'control' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
                {/* QR Code Generator Box */}
                <div className="content-panel" style={{ textAlign: 'center', padding: '24px' }}>
                  <div className="panel-heading-title" style={{ justifyContent: 'center', marginBottom: '8px' }}>
                    STORE QR CHECK-IN & CHECK-OUT
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                    Universal QR code for all attendance. Staff & Guests scan this code to Check In or Check Out.
                  </p>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', color: '#0f172a', marginBottom: '16px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
                    <span>All-In-One Terminal QR Code</span>
                  </div>

                  <div style={{ background: '#ffffff', padding: '12px', border: '1px solid #e2e8f0', display: 'inline-block', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrConfig?.target_url || `${window.location.origin}/#user`)}`}
                      alt="Chafé Store QR"
                      style={{ width: '180px', height: '180px', display: 'block' }}
                    />
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <button
                      className="btn-primary"
                      onClick={() => window.print()}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <IconPrinter size={15} color="#ffffff" />
                      <span>Print QR Poster</span>
                    </button>
                  </div>
                </div>

                {/* Short Today-Only Activity Table */}
                <div className="content-panel">
                  <div className="panel-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="panel-heading-title">TODAY'S SHORT LOGS (TODAY ONLY)</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                        LIVE SYNC
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Inside: <strong>{todayData.summary?.active_now ?? 0}</strong> | Departed: <strong>{todayData.summary?.checked_out_today ?? 0}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleManualRefresh}
                        disabled={refreshing}
                        title="Reload latest data from Firebase"
                        style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <IconRefresh size={12} className={refreshing ? 'spin-anim' : ''} />
                        <span>{refreshing ? 'Reloading...' : 'Reload Data'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Location</th>
                          <th>Check-In</th>
                          <th>Check-Out</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(todayData.data || []).length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                              No check-in or check-out records recorded yet today.
                            </td>
                          </tr>
                        ) : (
                          (todayData.data || []).map((row) => {
                            const isInside = row.status === 'checked_in'
                            const matchedStaff = staffList.find(s => s.id === row.staff_id || s.name === row.name)
                            const photo = row.photo_url || matchedStaff?.photo_url || ''
                            return (
                              <tr key={row.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className="table-staff-avatar-wrap" style={{ width: '32px', height: '32px' }}>
                                      {photo ? (
                                        <img
                                          src={photo}
                                          alt={row.name}
                                          className="table-staff-avatar-img"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none'
                                            const fb = e.currentTarget.nextElementSibling
                                            if (fb) fb.style.display = 'flex'
                                          }}
                                        />
                                      ) : null}
                                      <div
                                        className="table-staff-avatar-initials"
                                        style={{ display: photo ? 'none' : 'flex', fontSize: '11px' }}
                                      >
                                        {(row.name || 'G').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                      </div>
                                    </div>
                                    <strong>{row.name}</strong>
                                  </div>
                                </td>
                                <td>{row.location || 'Table'}</td>
                                <td>{formatTime(row.check_in_at)}</td>
                                <td>{isInside ? '-' : formatTime(row.check_out_at)}</td>
                                <td>
                                  <span className={`badge-tag-pill ${isInside ? '' : 'completed'}`}>
                                    {isInside ? 'Inside' : 'Out'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {isInside && (
                                    <button
                                      className="btn-secondary"
                                      style={{ fontSize: '11px', padding: '4px 8px' }}
                                      onClick={() => handleCheckOut(row.id, row.name)}
                                    >
                                      Check Out
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: SETTINGS */}
          {/* ============================================================== */}
          {navTab === 'settings' && (
            <div className="content-panel" style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
              <div className="panel-heading-title" style={{ marginBottom: '16px' }}>CHAFÉ SYSTEM SETTINGS</div>

              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label className="form-label">Café Brand Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={cafeSettings.cafe_name}
                    onChange={(e) => setCafeSettings({ ...cafeSettings, cafe_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Operating Hours</label>
                  <input
                    type="text"
                    className="form-input"
                    value={cafeSettings.operating_hours}
                    onChange={(e) => setCafeSettings({ ...cafeSettings, operating_hours: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Late Check-in Grace Period (Minutes)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={cafeSettings.late_grace_period_mins}
                    onChange={(e) => setCafeSettings({ ...cafeSettings, late_grace_period_mins: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Seating Capacity</label>
                  <input
                    type="number"
                    className="form-input"
                    value={cafeSettings.seating_capacity}
                    onChange={(e) => setCafeSettings({ ...cafeSettings, seating_capacity: parseInt(e.target.value) || 48 })}
                  />
                </div>

                <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🏢</span> Store Branches & Geofence Rules (ការកំណត់សាខា & គម្លាតស្កេន)
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                        Configure store GPS coordinates and allowed scan radius per branch. Staff far from their branch cannot scan.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ fontSize: '11px', padding: '6px 14px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        disabled={isBranchesSaving}
                        onClick={() => handleSaveBranches(branches)}
                      >
                        <span>💾 {isBranchesSaving ? 'Saving...' : 'Save Branches (រក្សាទុកសាខា)'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => {
                          const newId = `branch_${Date.now()}`
                          const newBranch = {
                            id: newId,
                            code: `B${branches.length + 1}`,
                            name: `Chafé • Branch #${branches.length + 1}`,
                            address: 'Siem Reap, Cambodia',
                            lat: 13.3545705,
                            lng: 103.8589937,
                            radiusMeters: 50,
                            isActive: true,
                          }
                          setBranches(prev => [...prev, newBranch])
                          showToast(`Added Branch #${branches.length + 1}. Remember to click Save Branches!`, 'info')
                        }}
                      >
                        <IconPlus size={12} color="#0f172a" />
                        <span>+ Add Branch (បន្ថែមសាខា)</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {branches.map((b, idx) => (
                      <div
                        key={b.id}
                        className="branch-management-card"
                      >
                        <div className="branch-card-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="branch-badge">
                              សាខាទី {idx + 1}
                            </span>
                            <strong style={{ fontSize: '14px', color: '#0f172a' }}>{b.name}</strong>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="branch-radius-chip">
                              🎯 Allowed: {b.radiusMeters || 200}m
                            </span>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                              onClick={() => {
                                if (navigator.geolocation) {
                                  navigator.geolocation.getCurrentPosition(
                                    (pos) => {
                                      const updatedLat = parseFloat(pos.coords.latitude.toFixed(6))
                                      const updatedLng = parseFloat(pos.coords.longitude.toFixed(6))
                                      setBranches(prev => prev.map(item => item.id === b.id ? { ...item, lat: updatedLat, lng: updatedLng } : item))
                                      showToast(`GPS captured for ${b.name}: ${updatedLat}, ${updatedLng}`, 'success')
                                    },
                                    (err) => {
                                      showToast(`Location error: ${err.message}`, 'error')
                                    }
                                  )
                                } else {
                                  showToast('Geolocation not supported by browser', 'error')
                                }
                              }}
                            >
                              📍 Capture Current GPS
                            </button>
                            {branches.length > 1 && (
                              <button
                                type="button"
                                style={{ background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                                onClick={() => {
                                  if (confirm(`Delete ${b.name}?`)) {
                                    setBranches(prev => prev.filter(item => item.id !== b.id))
                                  }
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: '10px', marginBottom: '10px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Branch Name (ឈ្មោះសាខា)</label>
                            <input
                              type="text"
                              className="form-input"
                              value={b.name || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, name: val } : item))
                              }}
                              placeholder="e.g. Chafé • Kohke"
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Address / Location</label>
                            <input
                              type="text"
                              className="form-input"
                              value={b.address || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, address: val } : item))
                              }}
                              placeholder="e.g. Siem Reap, Cambodia"
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Branch Code (កូដ)</label>
                            <input
                              type="text"
                              className="form-input"
                              value={b.code || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, code: val } : item))
                              }}
                              placeholder="e.g. TK"
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '10px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Latitude (រយៈទទឹង)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="form-input"
                              value={b.lat ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, lat: val } : item))
                              }}
                              placeholder="13.3632967"
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Longitude (រយៈបណ្តោយ)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="form-input"
                              value={b.lng ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, lng: val } : item))
                              }}
                              placeholder="103.8623305"
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px', color: '#b45309', fontWeight: 800 }}>
                              Allowed Distance (គម្លាតអនុញ្ញាត - Meters)
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              style={{ borderColor: '#f59e0b', fontWeight: 700 }}
                              value={b.radiusMeters ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, radiusMeters: val } : item))
                              }}
                              placeholder="50"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Custom Staff Roles (Admin Created & Managed) */}
                <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>👤</span> Custom Roles & Role Assignment (តួនាទីបុគ្គលិក)
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Admin can create custom roles and assign them to staff members. Changes save live to the system.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                    {customRoles.map(r => (
                      <div
                        key={r}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: '#1e293b'
                        }}
                      >
                        <span>{r}</span>
                        {customRoles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomRole(r)}
                            title="Delete this role"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              fontWeight: 800,
                              fontSize: '12px',
                              padding: '0 2px'
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', maxWidth: '400px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Lead Barista, Cashier..."
                      value={newRoleInput}
                      onChange={(e) => setNewRoleInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ whiteSpace: 'nowrap', padding: '6px 14px' }}
                      onClick={async () => {
                        if (newRoleInput.trim()) {
                          await handleCreateCustomRole(newRoleInput.trim())
                          setNewRoleInput('')
                        }
                      }}
                    >
                      + Add Role
                    </button>
                  </div>
                </div>

                {/* Section: Store Alerts & Notices (Admin Managed, Real-time to Staff) */}
                <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📢</span> Store Alerts & Notices (ការជូនដំណឹង & សេចក្តីប្រកាសហាង)
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Dynamic announcements broadcast live to the staff workspace hub. Staff see these instantly.
                    </p>
                  </div>

                  {/* List of current notices */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {storeAlertsList.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>No store alerts published yet.</p>
                    ) : (
                      storeAlertsList.map(alert => (
                        <div
                          key={alert.id}
                          style={{
                            background: alert.priority === 'high' ? '#eff6ff' : '#f8fafc',
                            border: `1px solid ${alert.priority === 'high' ? '#bfdbfe' : '#e2e8f0'}`,
                            borderRadius: '10px',
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '12px'
                          }}
                        >
                          {editingAlertId === alert.id ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <input
                                type="text"
                                className="form-input"
                                value={editAlertForm.title}
                                onChange={(e) => setEditAlertForm({ ...editAlertForm, title: e.target.value })}
                                placeholder="Alert Title"
                              />
                              <textarea
                                className="form-input"
                                rows={2}
                                value={editAlertForm.message}
                                onChange={(e) => setEditAlertForm({ ...editAlertForm, message: e.target.value })}
                                placeholder="Alert Message"
                              />
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <select
                                  className="form-select"
                                  value={editAlertForm.priority}
                                  onChange={(e) => setEditAlertForm({ ...editAlertForm, priority: e.target.value })}
                                  style={{ width: '130px' }}
                                >
                                  <option value="normal">Normal</option>
                                  <option value="high">High Priority</option>
                                </select>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{ padding: '4px 10px', fontSize: '12px' }}
                                  onClick={() => handleUpdateStoreAlert(alert.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '12px' }}
                                  onClick={() => setEditingAlertId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>{alert.title}</strong>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: alert.priority === 'high' ? '#dbeafe' : '#e2e8f0',
                                      color: alert.priority === 'high' ? '#1d4ed8' : '#475569'
                                    }}
                                  >
                                    {alert.priority === 'high' ? 'High Priority' : 'Normal'}
                                  </span>
                                </div>
                                <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.4 }}>
                                  {alert.message}
                                </p>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  onClick={() => {
                                    setEditingAlertId(alert.id)
                                    setEditAlertForm({ title: alert.title, message: alert.message, priority: alert.priority || 'normal' })
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  style={{ background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                                  onClick={() => handleDeleteStoreAlert(alert.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add New Notice Form */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <h5 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>
                      + Publish New Store Notice
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Notice Title (e.g. Health Inspection Scheduled, New Espresso Beans)"
                        value={newAlertForm.title}
                        onChange={(e) => setNewAlertForm({ ...newAlertForm, title: e.target.value })}
                      />
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="Notice description & details for staff..."
                        value={newAlertForm.message}
                        onChange={(e) => setNewAlertForm({ ...newAlertForm, message: e.target.value })}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <select
                          className="form-select"
                          value={newAlertForm.priority}
                          onChange={(e) => setNewAlertForm({ ...newAlertForm, priority: e.target.value })}
                          style={{ width: '140px', fontSize: '12px' }}
                        >
                          <option value="normal">Normal Priority</option>
                          <option value="high">High Priority</option>
                        </select>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ fontSize: '12px', padding: '6px 14px' }}
                          onClick={handleSaveStoreAlert}
                        >
                          Publish Notice
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="submit" className="btn-primary" disabled={settingsSaving}>
                    {settingsSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ============================================================== */}
      {/* MODAL: NEW CHECK-IN */}
      {/* ============================================================== */}
      {isCheckinModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Quick Check-In • Chafé</h2>
              <button className="btn-close" onClick={() => setIsCheckinModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCheckinSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Guest / Staff Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Full Name"
                    value={checkinForm.name}
                    onChange={(e) => setCheckinForm({ ...checkinForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="email@example.com"
                    value={checkinForm.email}
                    onChange={(e) => setCheckinForm({ ...checkinForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role / Type</label>
                  <select
                    className="form-select"
                    value={checkinForm.type}
                    onChange={(e) => setCheckinForm({ ...checkinForm, type: e.target.value })}
                  >
                    <option value="guest">Dine-In Guest</option>
                    <option value="employee">Staff / Barista</option>
                    <option value="visitor">Workspace Member</option>
                    <option value="contractor">Supplier</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Branch (សាខា)</label>
                  <select
                    className="form-select"
                    value={checkinForm.branch_id || (selectedBranchFilter !== 'all' ? selectedBranchFilter : (branches[0]?.id || 'branch_2'))}
                    onChange={(e) => {
                      const sel = branches.find(b => b.id === e.target.value)
                      setCheckinForm({
                        ...checkinForm,
                        branch_id: e.target.value,
                        branch_name: sel ? sel.name : (branches[0]?.name || 'Chafé • Kohke')
                      })
                    }}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Table / Location</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Table 1, Counter"
                    value={checkinForm.location}
                    onChange={(e) => setCheckinForm({ ...checkinForm, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsCheckinModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={checkinSubmitting}>
                  {checkinSubmitting ? 'Checking In...' : 'Confirm Check-In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE STAFF */}
      {/* ============================================================== */}
      {isCreateStaffModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Create Staff Member</h2>
              <button className="btn-close" onClick={() => setIsCreateStaffModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateStaffSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Staff Full Name"
                    value={staffForm.name}
                    onChange={(e) => {
                      const newName = e.target.value
                      setStaffForm(prev => {
                        const prevAuto = (prev.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                        const shouldUpdateUser = !prev.username || prev.username === prevAuto
                        return {
                          ...prev,
                          name: newName,
                          username: shouldUpdateUser ? newName.toLowerCase().replace(/[^a-z0-9]/g, '') : prev.username,
                        }
                      })
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Staff Email (Optional - defaults to username@chafe.com)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="staff@example.com (or leave empty to auto-generate)"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Username (Staff Login)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. username"
                      value={staffForm.username}
                      onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Default: 123456"
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Branch (សាខាដែលបានចាត់តាំង) *</label>
                  <select
                    className="form-select"
                    value={staffForm.branch_id || branches[0]?.id || 'branch_2'}
                    onChange={(e) => {
                      const sel = branches.find(b => b.id === e.target.value)
                      const bName = sel ? sel.name : (e.target.value === 'all' ? 'All Branches (Floating)' : (branches[0]?.name || 'Chafé • Kohke'))
                      setStaffForm({
                        ...staffForm,
                        branch_id: e.target.value,
                        branch_name: bName,
                        location: bName, // Auto update location to branch
                        branch_address: sel?.address || 'Siem Reap, Cambodia'
                      })
                    }}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.radiusMeters}m allowed scan radius)
                      </option>
                    ))}
                    <option value="all">🌐 All Branches (សាខាទាំងអស់ - Floating Staff)</option>
                  </select>
                  <span style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    🔒 Location automatically matches this branch and is locked for staff.
                  </span>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Assign Role (កំណត់តួនាទី) *</label>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => setIsAddingRoleInline(!isAddingRoleInline)}
                    >
                      {isAddingRoleInline ? 'Cancel' : '+ Create Role'}
                    </button>
                  </div>

                  {isAddingRoleInline && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter new custom role title..."
                        value={newRoleInput}
                        onChange={(e) => setNewRoleInput(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={async () => {
                          const created = await handleCreateCustomRole(newRoleInput)
                          if (created) {
                            setStaffForm(prev => ({ ...prev, role: created }))
                            setNewRoleInput('')
                            setIsAddingRoleInline(false)
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>
                  )}

                  <select
                    className="form-select"
                    value={staffForm.role}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingRoleInline(true)
                      } else {
                        setStaffForm({ ...staffForm, role: e.target.value })
                      }
                    }}
                  >
                    {customRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="__add_new__">+ Create New Role (Admin)...</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Shift Start (12-Hour Select Only) *</label>
                    <TimePicker12Hour
                      value={staffForm.shift_start}
                      onChange={(val) => setStaffForm({ ...staffForm, shift_start: val })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shift End (12-Hour Select Only) *</label>
                    <TimePicker12Hour
                      value={staffForm.shift_end}
                      onChange={(val) => setStaffForm({ ...staffForm, shift_end: val })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Staff Profile Photo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = () => {
                          const img = new Image()
                          img.onload = () => {
                            const canvas = document.createElement('canvas')
                            const maxDim = 256
                            let w = img.width
                            let h = img.height
                            if (w > h) {
                              if (w > maxDim) {
                                h = Math.round((h * maxDim) / w)
                                w = maxDim
                              }
                            } else {
                              if (h > maxDim) {
                                w = Math.round((w * maxDim) / h)
                                h = maxDim
                              }
                            }
                            canvas.width = w
                            canvas.height = h
                            const ctx = canvas.getContext('2d')
                            ctx.drawImage(img, 0, 0, w, h)
                            const thumb = canvas.toDataURL('image/jpeg', 0.82)
                            setStaffForm(prev => ({ ...prev, photo_url: thumb }))
                          }
                          img.src = reader.result
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsCreateStaffModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={staffSubmitting}>
                  {staffSubmitting ? 'Saving...' : 'Add to Staff Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT STAFF ROLE, CREDENTIALS & SHIFT */}
      {/* ============================================================== */}
      {editingStaff && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Edit Staff Profile & Credentials • {editingStaff.name}</h2>
              <button className="btn-close" onClick={() => setEditingStaff(null)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              const chosenBranch = branches.find(b => b.id === editingStaff.branch_id) || branches[0]
              const branchName = editingStaff.branch_id === 'all' ? 'All Branches (Floating)' : (chosenBranch?.name || editingStaff.branch_name || 'Chafé • Kohke')
              const payload = {
                name: (editingStaff.name || '').trim(),
                role: editingStaff.role || 'Barista',
                branch_id: editingStaff.branch_id || chosenBranch?.id || 'branch_2',
                branch_name: branchName,
                location: branchName, // Automatically changed to branch location
                branch_address: chosenBranch?.address || 'Siem Reap, Cambodia',
                shift_start: editingStaff.shift_start || '07:30',
                shift_end: editingStaff.shift_end || '16:00',
                username: (editingStaff.username || '').trim(),
              }
              if (editingStaff.new_password && editingStaff.new_password.trim()) {
                payload.password = editingStaff.new_password.trim()
              }
              if (editingStaff.photo_url) {
                payload.photo_url = editingStaff.photo_url
              }
              await handleUpdateStaff(editingStaff.id, payload)
            }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Staff Profile Photo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="table-staff-avatar-wrap" style={{ width: '48px', height: '48px' }}>
                      {editingStaff.photo_url ? (
                        <img
                          src={editingStaff.photo_url}
                          alt={editingStaff.name}
                          className="table-staff-avatar-img"
                        />
                      ) : (
                        <div className="table-staff-avatar-initials">
                          {(editingStaff.name || 'ST').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-input"
                      style={{ flex: 1 }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = () => {
                            setEditingStaff(prev => ({ ...prev, photo_url: reader.result }))
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingStaff.name || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Branch (សាខាដែលបានចាត់តាំង)</label>
                  <select
                    className="form-select"
                    value={editingStaff.branch_id || branches[0]?.id || 'branch_2'}
                    onChange={(e) => {
                      const sel = branches.find(b => b.id === e.target.value)
                      const bName = sel ? sel.name : (e.target.value === 'all' ? 'All Branches (Floating)' : (branches[0]?.name || 'Chafé • Kohke'))
                      setEditingStaff({
                        ...editingStaff,
                        branch_id: e.target.value,
                        branch_name: bName,
                        location: bName, // Auto update location
                        branch_address: sel?.address || 'Siem Reap, Cambodia'
                      })
                    }}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.radiusMeters}m allowed scan radius)
                      </option>
                    ))}
                    <option value="all">🌐 All Branches (សាខាទាំងអស់ - Floating Staff)</option>
                  </select>
                  <span style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    🔒 Location automatically updates to this branch and is locked for staff.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Username (Staff Login ID)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingStaff.username || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reset Password (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Leave blank to keep unchanged"
                      value={editingStaff.new_password || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, new_password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Assign Role (កំណត់តួនាទី) *</label>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => setIsAddingRoleInline(!isAddingRoleInline)}
                    >
                      {isAddingRoleInline ? 'Cancel' : '+ Create Role'}
                    </button>
                  </div>

                  {isAddingRoleInline && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter new custom role title..."
                        value={newRoleInput}
                        onChange={(e) => setNewRoleInput(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={async () => {
                          const created = await handleCreateCustomRole(newRoleInput)
                          if (created) {
                            setEditingStaff(prev => ({ ...prev, role: created }))
                            setNewRoleInput('')
                            setIsAddingRoleInline(false)
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>
                  )}

                  <select
                    className="form-select"
                    value={editingStaff.role || customRoles[0] || 'Barista'}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingRoleInline(true)
                      } else {
                        setEditingStaff({ ...editingStaff, role: e.target.value })
                      }
                    }}
                  >
                    {customRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="__add_new__">+ Create New Role (Admin)...</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Shift Start (12-Hour Select Only) *</label>
                    <TimePicker12Hour
                      value={editingStaff.shift_start || '07:30 AM'}
                      onChange={(val) => setEditingStaff({ ...editingStaff, shift_start: val })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shift End (12-Hour Select Only) *</label>
                    <TimePicker12Hour
                      value={editingStaff.shift_end || '04:00 PM'}
                      onChange={(val) => setEditingStaff({ ...editingStaff, shift_end: val })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingStaff(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: LIVE MESSAGES & SYSTEM ALERTS CENTER */}
      {/* ============================================================== */}
      {isMessagesOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsMessagesOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '640px', width: '100%', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconEnvelope size={18} color="#f97316" />
                <h2 className="modal-title">Live System Messages & Alerts</h2>
                {unreadAlertsCount > 0 && (
                  <span className="badge-count" style={{ marginLeft: '4px' }}>
                    {unreadAlertsCount} unread
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {unreadAlertsCount > 0 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={handleMarkAllAlertsRead}
                  >
                    Mark All Read
                  </button>
                )}
                <button className="btn-close" onClick={() => setIsMessagesOpen(false)}>✕</button>
              </div>
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: '6px', padding: '12px 20px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', overflowX: 'auto' }}>
              <button
                className={`pill-filter-btn ${messagesTab === 'all' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => setMessagesTab('all')}
              >
                All Alerts ({allAlerts.length})
              </button>
              <button
                className={`pill-filter-btn ${messagesTab === 'checkin_out' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => setMessagesTab('checkin_out')}
              >
                🟢 Check-In / Out ({allAlerts.filter(a => a.category === 'checkin_out').length})
              </button>
              <button
                className={`pill-filter-btn ${messagesTab === 'late' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => setMessagesTab('late')}
              >
                ⚠️ Late Alerts ({allAlerts.filter(a => a.category === 'late').length})
              </button>
              <button
                className={`pill-filter-btn ${messagesTab === 'performance' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => setMessagesTab('performance')}
              >
                📊 Performance (1/Wk & 1/Mo) ({allAlerts.filter(a => a.category === 'performance').length})
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto', padding: '16px 20px' }}>
              {allAlerts.filter(a => messagesTab === 'all' || a.category === messagesTab).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                  <IconCheck size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No alerts in this category.</p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>Everything is running on schedule.</p>
                </div>
              ) : (
                allAlerts
                  .filter(a => messagesTab === 'all' || a.category === messagesTab)
                  .map((alert) => {
                    const isUnread = !readAlertIds.includes(alert.id)
                    return (
                      <div
                        key={alert.id}
                        className={`alert-card-item ${isUnread ? 'unread' : ''}`}
                      >
                        <div style={{ fontSize: '20px', lineHeight: 1, marginTop: '2px' }}>
                          {alert.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className={`alert-badge-tag ${alert.category}`}>
                                {alert.badge}
                              </span>
                              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{alert.title}</strong>
                            </div>
                            <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {alert.timestamp}
                            </span>
                          </div>
                          <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 8px 0', lineHeight: 1.45 }}>
                            {alert.message}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '11px', padding: '3px 8px', color: '#0284c7' }}
                              onClick={() => {
                                setIsMessagesOpen(false)
                                if (alert.targetTab) setNavTab(alert.targetTab)
                              }}
                            >
                              {alert.targetTab === 'performance' ? 'View Performance Roster →' : 'View in Table →'}
                            </button>
                            <button
                              type="button"
                              style={{ background: 'transparent', border: 'none', fontSize: '11px', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => handleToggleAlertRead(alert.id)}
                            >
                              {isUnread ? 'Mark as read' : 'Mark unread'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Auto-syncs check-ins, late alerts & weekly/monthly reports
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsMessagesOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PERFORMANCE ALERTS & REVIEW CONFIGURATION */}
      {/* ============================================================== */}
      {isPerfModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsPerfModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '520px', width: '100%', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconTrophy size={18} color="#f97316" />
                <h2 className="modal-title">Performance Review & Alert Schedule</h2>
              </div>
              <button className="btn-close" onClick={() => setIsPerfModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSavePerfSettings}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1/Week Performance Alert */}
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={cafeSettings.weekly_perf_alert !== false}
                      onChange={(e) => setCafeSettings({ ...cafeSettings, weekly_perf_alert: e.target.checked })}
                    />
                    <span>Weekly Performance Alert (1/Week)</span>
                  </label>
                  <p style={{ margin: '6px 0 8px 24px', fontSize: '12px', color: '#64748b' }}>
                    Sends a weekly digest alert highlighting overall punctuality rate and flagged late shifts across all roster staff.
                  </p>
                  <div style={{ marginLeft: '24px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={handleTriggerWeeklyAlert}
                    >
                      ⚡ Trigger 1/Week Alert Now
                    </button>
                  </div>
                </div>

                {/* 1/Month Performance Review */}
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={cafeSettings.monthly_perf_alert !== false}
                      onChange={(e) => setCafeSettings({ ...cafeSettings, monthly_perf_alert: e.target.checked })}
                    />
                    <span>Monthly Performance Review Milestone (1/Month)</span>
                  </label>
                  <p style={{ margin: '6px 0 8px 24px', fontSize: '12px', color: '#64748b' }}>
                    Consolidates monthly attendance, opens scheduled review windows, and flags action plans for late shifts.
                  </p>
                  <div style={{ marginLeft: '24px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={handleTriggerMonthlyAlert}
                    >
                      ⚡ Trigger 1/Month Review Now
                    </button>
                  </div>
                </div>

                {/* Late Shift Grace Period */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Late Shift Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    className="form-input"
                    value={cafeSettings.late_grace_period_mins || 10}
                    onChange={(e) => setCafeSettings({ ...cafeSettings, late_grace_period_mins: parseInt(e.target.value) || 0 })}
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    Staff checking in after this grace period will trigger a Late Check-In Alert.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setIsPerfModalOpen(false); setNavTab('performance') }}
                >
                  Go to Performance Page →
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'Saving...' : 'Save Schedule Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SEATING CAPACITY & GOALS CONFIGURATION */}
      {/* ============================================================== */}
      {isGoalsModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsGoalsModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '480px', width: '100%', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconGear size={18} color="#f97316" />
                <h2 className="modal-title">Configure Seating Capacity & Goals</h2>
              </div>
              <button className="btn-close" onClick={() => setIsGoalsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveGoals}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Main Dining Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={cafeSettings.seating_capacity || 48}
                    onChange={(e) => setCafeSettings({ ...cafeSettings, seating_capacity: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Garden Patio Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={cafeSettings.patio_capacity || 16}
                    onChange={(e) => setCafeSettings({ ...cafeSettings, patio_capacity: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Barista Shift Coverage Target</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={cafeSettings.barista_target || 2}
                    onChange={(e) => setCafeSettings({ ...cafeSettings, barista_target: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsGoalsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'Saving...' : 'Save Goals & Capacity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADMINISTRATOR PROFILE & STATUS */}
      {/* ============================================================== */}
      {isProfileModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsProfileModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '420px', width: '100%', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconUserCircle size={20} color="#f97316" />
                <h2 className="modal-title">Administrator Profile</h2>
              </div>
              <button className="btn-close" onClick={() => setIsProfileModalOpen(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ffedd5', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <IconUserCircle size={40} color="#ea580c" />
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '17px', color: '#0f172a' }}>System Administrator</h3>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>admin@chafe.internal</p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', color: '#059669', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 700 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                Full Enterprise Access Active
              </div>

              <div style={{ marginTop: '20px', textAlign: 'left', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>Role:</span>
                  <strong>Root Admin / Manager</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>Version:</span>
                  <span>v2.4.0 Live Enterprise</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>Active Alerts:</span>
                  <strong style={{ color: '#ea580c' }}>{allAlerts.length} Messages</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ color: '#ef4444' }}
                onClick={() => { setIsProfileModalOpen(false); handleLogout() }}
              >
                Sign Out
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsProfileModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}
