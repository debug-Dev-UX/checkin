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
  IconPrinter
} from './Icons'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export default function App() {
  // Navigation State with URL Hash Support (#staff, #performance, #overview, etc.)
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    const hash = window.location.hash.replace('#', '').toLowerCase()
    const target = tabParam || hash
    if (['overview', 'performance', 'staff', 'control', 'settings'].includes(target)) {
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
      if (['overview', 'performance', 'staff', 'control', 'settings'].includes(hash)) {
        setNavTabState(hash)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Real-time Overview Stats (0 Data default)
  const [stats, setStats] = useState({
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
    try {
      const res = await fetch(`${API_BASE}/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSystemStatus(data)
    } catch (err) {
      setSystemStatus({
        status: 'offline',
        framework: 'Laravel Backend',
        database: { connected: false, connection: 'mysql', database_name: 'checkin_db', error: err.message },
      })
    }
  }, [])

  // Fetch Overview Data
  const fetchOverviewData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/checkins`),
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.data || { total_all: 0, active_now: 0, checked_out_today: 0, total_today: 0 })
      }

      if (listRes.ok) {
        const listData = await listRes.json()
        setCheckins(listData.data || [])
      }
    } catch {
      showToast('Could not sync with backend API.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch Staff & Performance
  const fetchStaffData = useCallback(async () => {
    try {
      const [staffRes, perfRes] = await Promise.all([
        fetch(`${API_BASE}/staff`),
        fetch(`${API_BASE}/performance`),
      ])

      if (staffRes.ok) {
        const json = await staffRes.json()
        setStaffList(json.data || [])
      }

      if (perfRes.ok) {
        const json = await perfRes.json()
        setPerformanceData(json.data || {
          overall_punctuality: 0,
          total_shifts: 0,
          total_late_arrivals: 0,
          staff_performance: [],
        })
      }
    } catch {
      // quiet catch
    }
  }, [])

  // Fetch Control Room (Today & QR)
  const fetchControlData = useCallback(async () => {
    try {
      const [todayRes, qrRes] = await Promise.all([
        fetch(`${API_BASE}/control/today`),
        fetch(`${API_BASE}/control/qr?type=${qrMode}`),
      ])

      if (todayRes.ok) {
        const json = await todayRes.json()
        setTodayData(json || { summary: {}, data: [] })
      }

      if (qrRes.ok) {
        const json = await qrRes.json()
        setQrConfig(json.data)
      }
    } catch {
      // quiet catch
    }
  }, [qrMode])

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setCafeSettings(json.data)
        }
      }
    } catch {
      // quiet catch
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchOverviewData()
    fetchStaffData()
    fetchControlData()
    fetchSettings()
  }, [fetchStatus, fetchOverviewData, fetchStaffData, fetchControlData, fetchSettings])

  // Check out person action
  const handleCheckOut = async (id, name) => {
    setActionLoadingId(id)
    try {
      const res = await fetch(`${API_BASE}/checkins/${id}/checkout`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Checkout failed')
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
      const res = await fetch(`${API_BASE}/checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(checkinForm),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Check-in failed')

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
      const res = await fetch(`${API_BASE}/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(staffForm),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to create staff member')

      showToast(`Staff member ${staffForm.name} added!`)
      setIsCreateStaffModalOpen(false)
      setStaffForm({
        name: '',
        email: '',
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

  // Update Staff Role / Shift
  const handleUpdateStaffRole = async (staffId, newRole, newShiftStart, newShiftEnd) => {
    try {
      const res = await fetch(`${API_BASE}/staff/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          role: newRole,
          shift_start: newShiftStart,
          shift_end: newShiftEnd,
        }),
      })
      if (!res.ok) throw new Error('Failed to update staff role')
      showToast('Staff role and shift updated!')
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
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(cafeSettings),
      })
      if (!res.ok) throw new Error('Failed to save settings')
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
  const staffCoveragePct = staffList.length > 0 ? Math.round((staffOnShiftCount / staffList.length) * 100) : 0

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
              <span className="user-display-name">Developer Shr</span>
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
              title="Logout"
              onClick={() => showToast('Session active - Chafé Manager')}
            >
              <IconPower size={18} />
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
              <span className="user-thumbnail-name">Developer Shr</span>
              <IconChevronDown size={11} color="#64748b" />
            </div>
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
              {navTab === 'staff' && 'Staff Directory & Role Assignment'}
              {navTab === 'control' && 'Control Room & QR Terminal'}
              {navTab === 'settings' && 'System Settings'}
            </h1>
            <div className="page-breadcrumb">
              Home {navTab !== 'overview' && ` / ${navTab.charAt(0).toUpperCase() + navTab.slice(1)}`}
            </div>
          </div>

          {/* Subheading row: Arrow Pointer + Start */}
          <div className="section-subheading-row">
            <IconArrowPointer size={16} color="#1e293b" />
            <span>Start</span>
          </div>

          {/* ============================================================== */}
          {/* 4 COLOR BANNER KPI CARDS (SVG Icons & 0 Data Default) */}
          {/* ============================================================== */}
          <section className="kpi-cards-row" aria-label="Summary KPIs">
            {/* Card 1: Vivid Magenta (Rack Server Icon / CURRENTLY SEATED) */}
            <div className="kpi-banner-card magenta">
              <div className="kpi-banner-icon">
                <IconServerStack size={42} color="#ffffff" />
              </div>
              <div className="kpi-banner-content">
                <span className="kpi-banner-label">CURRENTLY SEATED</span>
                <span className="kpi-banner-value">{stats.active_now ?? 0}</span>
              </div>
            </div>

            {/* Card 2: Vivid Cyan (Peace Hand Icon / TODAY'S VISITS) */}
            <div className="kpi-banner-card cyan">
              <div className="kpi-banner-icon">
                <IconPeaceHand size={42} color="#ffffff" />
              </div>
              <div className="kpi-banner-content">
                <span className="kpi-banner-label">TODAY'S VISITS</span>
                <span className="kpi-banner-value">{stats.total_today ?? 0}</span>
              </div>
            </div>

            {/* Card 3: Vivid Green (Cocktail Glass Icon / CHECKED OUT) */}
            <div className="kpi-banner-card green">
              <div className="kpi-banner-icon">
                <IconCocktail size={42} color="#ffffff" />
              </div>
              <div className="kpi-banner-content">
                <span className="kpi-banner-label">CHECKED OUT</span>
                <span className="kpi-banner-value">{stats.checked_out_today ?? 0}</span>
              </div>
            </div>

            {/* Card 4: Vivid Amber/Orange (Heartbeat ECG Icon / PUNCTUALITY RATE) */}
            <div className="kpi-banner-card amber">
              <div className="kpi-banner-icon">
                <IconHeartbeat size={42} color="#ffffff" />
              </div>
              <div className="kpi-banner-content">
                <span className="kpi-banner-label">PUNCTUALITY RATE</span>
                <span className="kpi-banner-value">{performanceData.overall_punctuality ?? 0}%</span>
              </div>
            </div>
          </section>

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
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                            {loading ? 'Loading records...' : 'No activity records found for today.'}
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
                                      await fetch(`${API_BASE}/checkins/${item.id}`, { method: 'DELETE' })
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
                  <button
                    className="btn-primary"
                    style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setIsCreateStaffModalOpen(true)}
                  >
                    <IconPlus size={13} color="#ffffff" />
                    <span>Create Staff</span>
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Staff Name</th>
                        <th>Assigned Role</th>
                        <th>Shift Schedule Time</th>
                        <th>Hourly Pay</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
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
                              <span className={`badge-status-pill ${s.is_on_shift ? 'green' : 'blue'}`}>
                                {s.is_on_shift ? 'On Shift' : 'Off Duty'}
                              </span>
                            </td>

                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px', marginRight: '6px' }}
                                onClick={() => setEditingStaff(s)}
                              >
                                Edit Role/Time
                              </button>
                              <button
                                className="btn-dots-menu"
                                title="Delete staff"
                                onClick={async () => {
                                  if (!window.confirm(`Delete ${s.name}?`)) return
                                  await fetch(`${API_BASE}/staff/${s.id}`, { method: 'DELETE' })
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
                    placeholder="e.g. Camille Laurent"
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
                    placeholder="camille@example.com"
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
                    placeholder="e.g. Table 4, Patio Booth"
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
                    placeholder="e.g. Maya Lin"
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
                    placeholder="maya.lin@chafe.co"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    required
                  />
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
      {/* MODAL: EDIT STAFF ROLE & SHIFT */}
      {/* ============================================================== */}
      {editingStaff && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Edit Role & Shift • {editingStaff.name}</h2>
              <button className="btn-close" onClick={() => setEditingStaff(null)}>✕</button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault()
              handleUpdateStaffRole(editingStaff.id, editingStaff.role, editingStaff.shift_start, editingStaff.shift_end)
            }}>
              <div className="modal-body">
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
