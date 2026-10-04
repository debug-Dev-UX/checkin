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
  subscribeToBranches
} from './services/firebaseService'
import {
  getStoreLocation,
  setStoreLocation,
  getBranches,
  saveBranches,
  DEFAULT_BRANCHES
} from './services/locationService'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export default function App() {
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
  const [advancedFilter, setAdvancedFilter] = useState('all') // 'all' | 'late' | 'on_time' | 'staff' | 'guest'

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
      shift_start: '07:30',
      shift_end: '16:00',
      hourly_rate: 20.00,
    }
  })
  const [staffSubmitting, setStaffSubmitting] = useState(false)

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
      if (list && list.length > 0) {
        setBranches(list)
      }
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [fetchBranches])

  // Save Branch Settings
  const handleSaveBranches = async (updatedBranches) => {
    setIsBranchesSaving(true)
    try {
      await saveBranchesToFirebase(updatedBranches)
      setBranches(updatedBranches)
      saveBranches(updatedBranches)
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
    if (!staffForm.name.trim() || !staffForm.email.trim()) {
      showToast('Name and email are required.', 'error')
      return
    }

    setStaffSubmitting(true)
    try {
      const targetBranch = branches.find(b => b.id === staffForm.branch_id) || branches[0]
      const payload = {
        ...staffForm,
        branch_id: staffForm.branch_id || targetBranch?.id || (branches[0] ? branches[0].id : 'branch_2'),
        branch_name: staffForm.branch_id === 'all' ? 'All Branches (Floating)' : (targetBranch?.name || branches[0]?.name || 'Chafé • Kohke'),
      }
      await createStaffInFirebase(payload)
      showToast(`Staff member ${staffForm.name} created for ${payload.branch_name}!`)
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
      fetchStaffData()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setStaffSubmitting(false)
    }
  }

  // Update Staff Role, Shift, Branch or Credentials
  const handleUpdateStaff = async (staffId, updatedFields) => {
    try {
      await updateStaffInFirebase(staffId, updatedFields)
      showToast('Staff profile updated!')
      setEditingStaff(null)
      fetchStaffData()
    } catch (err) {
      showToast(err.message, 'error')
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

  // Filtered Table Items
  const filteredRows = useMemo(() => {
    return checkins.filter(item => {
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
        return matchName || matchTable || matchDept || matchLoc
      }

      return true
    })
  }, [checkins, activeTableFilter, advancedFilter, tableSearch, selectedBranchFilter, staffList, branches])

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

  const formatTime = (timeStr) => {
    if (!timeStr) return '-'
    const d = new Date(timeStr)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
                        onClick={() => setIsTableFilterMenuOpen(!isTableFilterMenuOpen)}
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
                        <th>Guest / Staff Name</th>
                        <th>Assigned Table</th>
                        <th>Due Date / Logged</th>
                        <th>Filter / Role</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="5" style={{ padding: 0 }}>
                            <SkeletonTable rows={5} columns={5} />
                          </td>
                        </tr>
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            No activity records found for today.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((item) => {
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
          {navTab === 'performance' && (
            <div>
              <div className="content-panel">
                <div className="panel-header-bar">
                  <div className="panel-heading-title">STAFF ATTENDANCE & PUNCTUALITY PERFORMANCE</div>
                  <button className="panel-gear-btn">
                    <IconGear size={16} />
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Role</th>
                        <th>Scheduled Shift</th>
                        <th>Punctuality Score</th>
                        <th>Status Check (Good vs Late)</th>
                        <th>Total Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(performanceData.staff_performance || []).length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            No staff attendance records logged. Shifts and punctuality tracking will appear as staff check in.
                          </td>
                        </tr>
                      ) : (
                        (performanceData.staff_performance || []).map((staff) => {
                          const isGood = staff.punctuality_score >= 90
                          const matchedStaff = staffList.find(s => s.id === staff.staff_id || s.name === staff.name)
                          const photo = staff.photo_url || matchedStaff?.photo_url || ''

                          return (
                            <tr key={staff.staff_id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div className="table-staff-avatar-wrap">
                                    {photo ? (
                                      <img
                                        src={photo}
                                        alt={staff.name}
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
                                      {(staff.name || 'ST').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="task-name-text">{staff.name}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{staff.email}</div>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <span className="badge-tag-pill blue">{staff.role}</span>
                              </td>

                              <td>
                                <strong>{staff.shift_start} - {staff.shift_end}</strong>
                              </td>

                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div className="progress-bar-container" style={{ width: '90px', height: '14px' }}>
                                    <div
                                      className="progress-bar-inner"
                                      style={{
                                        width: `${staff.punctuality_score}%`,
                                        backgroundColor: isGood ? '#10b981' : '#ef4444',
                                      }}
                                    ></div>
                                  </div>
                                  <span style={{ fontWeight: 700 }}>{staff.punctuality_score}%</span>
                                </div>
                              </td>

                              <td>
                                <span className={`badge-status-pill ${isGood ? 'green' : 'red'}`}>
                                  {isGood ? '✓ Punctual (Good Standing)' : `Late by ${staff.total_late_minutes || 0}m`}
                                </span>
                              </td>

                              <td>
                                <strong>{staff.hours_worked} hrs</strong>
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
                        <th>Hourly Pay</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="8" style={{ padding: 0 }}>
                            <SkeletonTable rows={6} columns={8} />
                          </td>
                        </tr>
                      ) : filteredStaffList.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
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
                                <strong>{s.shift_start} - {s.shift_end}</strong>
                              </div>
                            </td>

                            <td>
                              <strong>${parseFloat(s.hourly_rate || 20).toFixed(2)}/hr</strong>
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Branch Name (ឈ្មោះសាខា)</label>
                            <input
                              type="text"
                              className="form-input"
                              value={b.name}
                              onChange={(e) => {
                                const val = e.target.value
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, name: val } : item))
                              }}
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
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '10px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Latitude (រយៈទទឹង)</label>
                            <input
                              type="number"
                              step="any"
                              className="form-input"
                              value={b.lat}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, lat: val } : item))
                              }}
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Longitude (រយៈបណ្តោយ)</label>
                            <input
                              type="number"
                              step="any"
                              className="form-input"
                              value={b.lng}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, lng: val } : item))
                              }}
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
                              value={b.radiusMeters || 200}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 100
                                setBranches(prev => prev.map(item => item.id === b.id ? { ...item, radiusMeters: val } : item))
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
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
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Staff Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="staff@example.com"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Username (Staff Login) *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="username"
                      value={staffForm.username}
                      onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password *</label>
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
                      setStaffForm({
                        ...staffForm,
                        branch_id: e.target.value,
                        branch_name: sel ? sel.name : (e.target.value === 'all' ? 'All Branches (Floating)' : (branches[0]?.name || 'Chafé • Kohke'))
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
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Role</label>
                  <select
                    className="form-select"
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  >
                    <option value="Head Barista">Head Barista</option>
                    <option value="Senior Latte Artist">Senior Latte Artist</option>
                    <option value="Barista">Barista</option>
                    <option value="Artisan Pastry Chef">Artisan Pastry Chef</option>
                    <option value="Front Counter & Cashier">Front Counter & Cashier</option>
                    <option value="Shift Supervisor">Shift Supervisor</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Shift Start Time</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="07:00"
                      value={staffForm.shift_start}
                      onChange={(e) => setStaffForm({ ...staffForm, shift_start: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shift End Time</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="15:30"
                      value={staffForm.shift_end}
                      onChange={(e) => setStaffForm({ ...staffForm, shift_end: e.target.value })}
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
                          setStaffForm(prev => ({ ...prev, photo_url: reader.result }))
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

            <form onSubmit={(e) => {
              e.preventDefault()
              const chosenBranch = branches.find(b => b.id === editingStaff.branch_id) || branches[0]
              handleUpdateStaff(editingStaff.id, {
                name: editingStaff.name,
                role: editingStaff.role,
                branch_id: editingStaff.branch_id || chosenBranch?.id || 'branch_2',
                branch_name: editingStaff.branch_id === 'all' ? 'All Branches (Floating)' : (editingStaff.branch_name || chosenBranch?.name || 'Chafé • Kohke'),
                shift_start: editingStaff.shift_start,
                shift_end: editingStaff.shift_end,
                username: editingStaff.username,
                password: editingStaff.new_password || undefined,
                photo_url: editingStaff.photo_url || undefined,
              })
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
                      setEditingStaff({
                        ...editingStaff,
                        branch_id: e.target.value,
                        branch_name: sel ? sel.name : (e.target.value === 'all' ? 'All Branches (Floating)' : (branches[0]?.name || 'Chafé • Kohke'))
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
                  <label className="form-label">Assign Role</label>
                  <select
                    className="form-select"
                    value={editingStaff.role}
                    onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                  >
                    <option value="Head Barista">Head Barista</option>
                    <option value="Senior Latte Artist">Senior Latte Artist</option>
                    <option value="Barista">Barista</option>
                    <option value="Artisan Pastry Chef">Artisan Pastry Chef</option>
                    <option value="Front Counter & Cashier">Front Counter & Cashier</option>
                    <option value="Shift Supervisor">Shift Supervisor</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Shift Start</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingStaff.shift_start}
                      onChange={(e) => setEditingStaff({ ...editingStaff, shift_start: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shift End</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingStaff.shift_end}
                      onChange={(e) => setEditingStaff({ ...editingStaff, shift_end: e.target.value })}
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
