import { useState, useEffect, useCallback, useMemo } from 'react'
import './App.css'
import {
  IconServerStack,
  IconPeaceHand,
  IconCocktail,
  IconHeartbeat,
  IconHome,
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
  IconCamera,
  IconCalendar,
  IconLock,
  IconKey,
  IconLogOut,
  IconEye,
  IconEyeOff
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
} from './services/firebaseService'

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
    wifi_ssid: 'Chafe_Specialty_Guest',
    wifi_password: 'coffee2026',
  })
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Filter & Search inside main table
  const [tableSearch, setTableSearch] = useState('')
  const [activeTableFilter, setActiveTableFilter] = useState('today') // 'today' | 'inside' | 'checked_out'

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
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'Barista',
    shift_start: '07:30',
    shift_end: '16:00',
    hourly_rate: 20.00,
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
      await createCheckinInFirebase(checkinForm)
      showToast(`${checkinForm.name} checked in!`)
      setIsCheckinModalOpen(false)
      setCheckinForm({
        name: '',
        email: '',
        type: 'guest',
        department: 'Main Dining',
        badge_no: 'TBL-01',
        location: 'Table 1',
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

  // Create Staff
  const handleCreateStaffSubmit = async (e) => {
    e.preventDefault()
    if (!staffForm.name.trim() || !staffForm.email.trim()) {
      showToast('Name and email are required.', 'error')
      return
    }

    setStaffSubmitting(true)
    try {
      const newStaff = await createStaffInFirebase(staffForm)
      showToast(`Staff member ${staffForm.name} created! (Username: @${newStaff?.username || staffForm.username})`)
      setIsCreateStaffModalOpen(false)
      setStaffForm({
        name: '',
        email: '',
        username: '',
        password: '',
        role: 'Barista',
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

  // Update Staff Role, Shift, or Credentials
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
      showToast('Settings saved successfully!')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSettingsSaving(false)
    }
  }

  // Filtered Table Items
  const filteredRows = useMemo(() => {
    return checkins.filter(item => {
      if (activeTableFilter === 'inside' && item.status !== 'checked_in') return false
      if (activeTableFilter === 'checked_out' && item.status !== 'checked_out') return false

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
  }, [checkins, activeTableFilter, tableSearch])

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

  // Seating capacity percentages (0 Data accurate)
  const seatingCap = cafeSettings.seating_capacity || 48
  const currentActive = stats.active_now ?? 0
  const occupancyPct = seatingCap > 0 ? Math.min(100, Math.round((currentActive / seatingCap) * 100)) : 0
  const staffOnShiftCount = staffList.filter(s => s.is_on_shift).length
  const staffCoveragePct = staffList.length > 0 ? Math.min(100, Math.round((staffOnShiftCount / staffList.length) * 100)) : 0
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
            <div className="nav-section-title">DASHBOARD</div>
            <button
              className={`sidebar-nav-item ${navTab === 'overview' ? 'active' : ''}`}
              onClick={() => setNavTab('overview')}
            >
              <span className="nav-item-icon">
                <IconHome size={16} />
              </span>
              <span>Home</span>
            </button>

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
              className="sidebar-nav-item"
              onClick={() => setNavTab('user')}
            >
              <span className="nav-item-icon">
                <IconCamera size={16} />
              </span>
              <span>User Dashboard (Scan)</span>
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
            <button
              className="btn-secondary"
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px' }}
              onClick={() => setNavTab('user')}
              title="Open Staff Camera Check-In Portal"
            >
              <IconCamera size={14} color="#ea580c" />
              <span>User Dashboard (Scan)</span>
            </button>

            <button className="admin-dropdown-btn">
              <IconGear size={14} color="#64748b" />
              <span>System Administrator</span>
              <IconChevronDown size={11} color="#94a3b8" />
            </button>

            <button className="icon-badge-btn" title="Messages">
              <IconEnvelope size={17} color="#64748b" />
              <span className="badge-count">0</span>
            </button>

            <div className="user-thumbnail-header">
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
              Home {navTab !== 'overview' && ` / ${navTab === 'staff-scan' ? 'Camera Scanner' : navTab.charAt(0).toUpperCase() + navTab.slice(1)}`}
            </div>
          </div>

          {/* Subheading row: Arrow Pointer + Start */}
          {navTab !== 'staff-scan' && (
            <div className="section-subheading-row">
              <IconArrowPointer size={16} color="#1e293b" />
              <span>Start</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* 4 COLOR BANNER KPI CARDS (With Shimmer Skeleton on Loading) */}
          {/* ============================================================== */}
          {navTab !== 'staff-scan' && (
            loading ? (
              <SkeletonBannerCards />
            ) : (
              <section className="kpi-cards-row" aria-label="Staff Attendance KPIs">
                {/* Card 1: Vivid Magenta (TOTAL STAFF) */}
                <div className="kpi-banner-card magenta">
                  <div className="kpi-banner-icon">
                    <IconUsers size={40} color="#ffffff" />
                  </div>
                  <div className="kpi-banner-content">
                    <span className="kpi-banner-label">TOTAL STAFF</span>
                    <span className="kpi-banner-value">{stats.total_staff || staffList.length}</span>
                  </div>
                </div>

                {/* Card 2: Vivid Cyan (CHECK IN TODAY) */}
                <div className="kpi-banner-card cyan">
                  <div className="kpi-banner-icon">
                    <IconPeaceHand size={42} color="#ffffff" />
                  </div>
                  <div className="kpi-banner-content">
                    <span className="kpi-banner-label">CHECK IN TODAY</span>
                    <span className="kpi-banner-value">{stats.staff_checked_in_today ?? staffList.filter(s => s.is_on_shift).length}</span>
                  </div>
                </div>

                {/* Card 3: Vivid Green (CHECK OUT TODAY) */}
                <div className="kpi-banner-card green">
                  <div className="kpi-banner-icon">
                    <IconCocktail size={42} color="#ffffff" />
                  </div>
                  <div className="kpi-banner-content">
                    <span className="kpi-banner-label">CHECK OUT TODAY</span>
                    <span className="kpi-banner-value">{stats.staff_checked_out_today ?? 0}</span>
                  </div>
                </div>

                {/* Card 4: Vivid Amber/Orange (DAYOFF TODAY) */}
                <div className="kpi-banner-card amber">
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
                  <button className="panel-gear-btn" title="Panel settings">
                    <IconGear size={16} />
                  </button>
                </div>

                {/* Sub Controls: Filter Pills & Quick Action */}
                <div className="panel-sub-controls">
                  <div className="pill-filter-group">
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
                    <button className="pill-filter-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>Filter</span>
                      <IconChevronDown size={10} />
                    </button>
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
                          return (
                            <tr key={item.id}>
                              <td>
                                <div className="task-name-text">{item.name}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  {item.note || item.email}
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
                    <button className="panel-gear-btn">
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
                    <button className="panel-gear-btn">
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
                        Garden Patio Seating (0 / 16)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="progress-bar-container">
                          <div className="progress-bar-inner" style={{ width: '0%' }}></div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, width: '32px' }}>0%</span>
                      </div>
                    </div>

                    <div className="widget-row">
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        Barista Shift Coverage ({staffOnShiftCount} / {staffList.length})
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

                          return (
                            <tr key={staff.staff_id}>
                              <td>
                                <div className="task-name-text">{staff.name}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{staff.email}</div>
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
                <div className="panel-header-bar">
                  <div className="panel-heading-title">CHAFÉ STAFF ROSTER & ROLE ASSIGNMENT</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setNavTab('user')}
                    >
                      <IconCamera size={14} color="#ea580c" />
                      <span>User Dashboard (Scan)</span>
                    </button>
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
                          <td colSpan="7" style={{ padding: 0 }}>
                            <SkeletonTable rows={6} columns={7} />
                          </td>
                        </tr>
                      ) : staffList.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            No staff members registered yet. Click "+ Create Staff" to add team members.
                          </td>
                        </tr>
                      ) : (
                        staffList.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <div className="task-name-text">{s.name}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.email}</div>
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
                  <div className="panel-heading-title" style={{ justifyContent: 'center', marginBottom: '12px' }}>
                    QR CHECK-IN & CHECK-OUT
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                    Scan QR code at table or counter to self check-in.
                  </p>

                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '16px' }}>
                    <button
                      className={`pill-filter-btn ${qrMode === 'guest' ? 'active' : ''}`}
                      onClick={() => setQrMode('guest')}
                    >
                      Guest QR
                    </button>
                    <button
                      className={`pill-filter-btn ${qrMode === 'staff' ? 'active' : ''}`}
                      onClick={() => setQrMode('staff')}
                    >
                      Staff QR
                    </button>
                  </div>

                  <div style={{ background: '#ffffff', padding: '12px', border: '1px solid #e2e8f0', display: 'inline-block', borderRadius: '4px' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrConfig?.target_url || 'http://127.0.0.1:8000/checkin')}`}
                      alt="Chafé QR"
                      style={{ width: '180px', height: '180px', display: 'block' }}
                    />
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      className="btn-primary"
                      onClick={() => window.print()}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <IconPrinter size={15} color="#ffffff" />
                      <span>Print QR Poster</span>
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setNavTab('user')}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <IconCamera size={15} color="#ea580c" />
                      <span>User Dashboard (Scan)</span>
                    </button>
                  </div>
                </div>

                {/* Short Today-Only Activity Table */}
                <div className="content-panel">
                  <div className="panel-header-bar">
                    <div className="panel-heading-title">TODAY'S SHORT LOGS (TODAY ONLY)</div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Inside: <strong>{todayData.summary?.active_now ?? 0}</strong> | Departed: <strong>{todayData.summary?.checked_out_today ?? 0}</strong>
                    </span>
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
                            return (
                              <tr key={row.id}>
                                <td><strong>{row.name}</strong></td>
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
              handleUpdateStaff(editingStaff.id, {
                name: editingStaff.name,
                role: editingStaff.role,
                shift_start: editingStaff.shift_start,
                shift_end: editingStaff.shift_end,
                username: editingStaff.username,
                password: editingStaff.new_password || undefined,
              })
            }}>
              <div className="modal-body">
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
