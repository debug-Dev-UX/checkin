import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  IconCalendar,
  IconPlus,
  IconTrash,
  IconFilter,
  IconRefresh,
  IconCheck,
  IconUsers,
  IconSearch,
  IconClock,
  IconGrid,
  IconList
} from '../Icons'
import {
  SkeletonCalendar,
  SkeletonTable,
  SkeletonCardGrid
} from './Skeleton'
import {
  getDayoffsFromFirebase,
  createDayoffInFirebase,
  deleteDayoffInFirebase,
  DEFAULT_LEAVE_TYPES,
  getLeaveTypesFromFirebase,
  saveLeaveTypesToFirebase,
} from '../services/firebaseService'

export const LEAVE_TYPES = DEFAULT_LEAVE_TYPES

export default function DayoffCalendar({ apiBase, staffList = [], showToast }) {
  // Dynamic Leave Types (Admin can create, edit, delete, and sort)
  const [leaveTypes, setLeaveTypes] = useState(DEFAULT_LEAVE_TYPES)
  const [isManageLeaveModalOpen, setIsManageLeaveModalOpen] = useState(false)
  const [editingLeaveType, setEditingLeaveType] = useState(null)
  const [newLeaveTypeForm, setNewLeaveTypeForm] = useState({ label: '', icon: '🌴', color: '#0284c7' })

  useEffect(() => {
    getLeaveTypesFromFirebase().then(types => {
      if (Array.isArray(types) && types.length > 0) {
        setLeaveTypes(types)
      }
    })
  }, [])

  // Calendar month state
  const [viewDate, setViewDate] = useState(() => new Date())
  const [dayoffs, setDayoffs] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('all')
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all')
  const [timeTabFilter, setTimeTabFilter] = useState('all') // 'all' | 'today' | 'upcoming' | 'past'
  const [viewLayout, setViewLayout] = useState('table') // 'table' | 'cards'
  const [pageDisplayMode, setPageDisplayMode] = useState('all') // 'all' | 'list_only' | 'calendar_only'

  // Assign Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [assignMode, setAssignMode] = useState('single') // 'single' | 'range'
  const [formStaffId, setFormStaffId] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formDateStart, setFormDateStart] = useState('')
  const [formDateEnd, setFormDateEnd] = useState('')
  const [formType, setFormType] = useState('day_off')
  const [formReason, setFormReason] = useState('')
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth() // 0-indexed
  const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const todayIso = new Date().toISOString().split('T')[0]

  // Fetch dayoffs for current month view
  const fetchDayoffs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDayoffsFromFirebase(currentMonthStr)
      setDayoffs(data || [])
    } catch {
      // quiet catch
    } finally {
      setLoading(false)
    }
  }, [currentMonthStr])

  useEffect(() => {
    fetchDayoffs()
  }, [fetchDayoffs])

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false)
      }
    }
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])

  // Navigation handlers
  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleToday = () => {
    setViewDate(new Date())
  }

  // Open modal pre-selected with a specific date
  const handleOpenAssign = (dateStr = null, staffId = null) => {
    const initialDate = dateStr || todayIso
    setFormDate(initialDate)
    setFormDateStart(initialDate)
    setFormDateEnd(initialDate)
    setFormStaffId(staffId || '')
    setFormType('day_off')
    setFormReason('')
    setAssignMode('single')
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Leave Types Management Handlers (Admin Create, Edit, Delete, Sort)
  const handleAddLeaveType = async (e) => {
    e?.preventDefault()
    if (!newLeaveTypeForm.label.trim()) {
      showToast?.('Leave type label is required.', 'error')
      return
    }
    const id = `leave_${Date.now()}`
    const created = {
      id,
      label: newLeaveTypeForm.label.trim(),
      icon: newLeaveTypeForm.icon.trim() || '🌴',
      color: newLeaveTypeForm.color || '#0284c7',
      bg: (newLeaveTypeForm.color || '#0284c7') + '15',
      border: (newLeaveTypeForm.color || '#0284c7') + '40',
    }
    const updated = [...leaveTypes, created]
    setLeaveTypes(updated)
    await saveLeaveTypesToFirebase(updated)
    setNewLeaveTypeForm({ label: '', icon: '🌴', color: '#0284c7' })
    showToast?.(`Created leave type: ${created.label}`, 'success')
  }

  const handleSaveEditLeaveType = async (e) => {
    e?.preventDefault()
    if (!editingLeaveType || !editingLeaveType.label.trim()) return
    const updated = leaveTypes.map(lt => lt.id === editingLeaveType.id ? {
      ...lt,
      label: editingLeaveType.label.trim(),
      icon: editingLeaveType.icon.trim() || '🌴',
      color: editingLeaveType.color || '#0284c7',
      bg: (editingLeaveType.color || '#0284c7') + '15',
      border: (editingLeaveType.color || '#0284c7') + '40',
    } : lt)
    setLeaveTypes(updated)
    await saveLeaveTypesToFirebase(updated)
    setEditingLeaveType(null)
    showToast?.('Leave type updated successfully!', 'success')
  }

  const handleDeleteLeaveType = async (typeId) => {
    if (leaveTypes.length <= 1) {
      showToast?.('At least one leave type must remain.', 'error')
      return
    }
    const target = leaveTypes.find(lt => lt.id === typeId)
    if (!window.confirm(`Delete leave type "${target?.label}"?`)) return
    const updated = leaveTypes.filter(lt => lt.id !== typeId)
    setLeaveTypes(updated)
    await saveLeaveTypesToFirebase(updated)
    showToast?.('Leave type deleted.', 'success')
  }

  const handleMoveLeaveType = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= leaveTypes.length) return
    const next = [...leaveTypes]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    setLeaveTypes(next)
    await saveLeaveTypesToFirebase(next)
    showToast?.('Leave types reordered / sorted.', 'info')
  }

  // Submit day off assignment with validation
  const handleAssignSubmit = async (e) => {
    e.preventDefault()

    const errs = {}
    if (!formStaffId) {
      errs.staff = 'Please select a staff member.'
    }
    if (assignMode === 'single') {
      if (!formDate) {
        errs.date = 'Please select a day off date.'
      }
    } else {
      if (!formDateStart) {
        errs.date_start = 'Start date is required.'
      }
      if (!formDateEnd) {
        errs.date_end = 'End date is required.'
      } else if (formDateStart && formDateEnd < formDateStart) {
        errs.date_end = 'End date must be on or after start date.'
      }
    }

    setFormErrors(errs)
    if (Object.keys(errs).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        staff_id: formStaffId,
        type: formType,
        reason: formReason.trim() || undefined,
      }

      if (assignMode === 'range') {
        payload.date_start = formDateStart
        payload.date_end = formDateEnd
      } else {
        payload.date = formDate
      }

      await createDayoffInFirebase(payload)

      if (showToast) showToast('Day off assigned successfully!', 'success')
      setIsModalOpen(false)
      fetchDayoffs()

    } catch (err) {
      if (showToast) showToast(err.message || 'Error assigning day off', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Cancel / Delete Day Off
  const handleDeleteDayoff = async (id, staffName, date) => {
    if (!window.confirm(`Cancel scheduled day off for ${staffName} on ${date}?`)) return
    setDeletingId(id)

    try {
      await deleteDayoffInFirebase(id)

      if (showToast) showToast('Day off cancelled successfully', 'success')
      fetchDayoffs()
    } catch (err) {
      if (showToast) showToast(err.message || 'Error cancelling day off', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  // Helper: Relative date badge calculations
  const getRelativeDateInfo = (dateStr) => {
    if (!dateStr) return { text: '', type: 'default' }
    const cleanDate = String(dateStr).substring(0, 10)
    if (cleanDate === todayIso) {
      return { text: 'TODAY', type: 'today' }
    }
    const target = new Date(cleanDate + 'T00:00:00')
    const current = new Date(todayIso + 'T00:00:00')
    const diffTime = target - current
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return { text: 'Tomorrow', type: 'tomorrow' }
    if (diffDays > 1 && diffDays <= 7) return { text: `In ${diffDays} days`, type: 'upcoming' }
    if (diffDays > 7) return { text: `In ${diffDays} days`, type: 'future' }
    if (diffDays === -1) return { text: 'Yesterday', type: 'past' }
    if (diffDays < -1) return { text: `${Math.abs(diffDays)}d ago`, type: 'past' }
    return { text: cleanDate, type: 'default' }
  }

  const formatFriendlyDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(String(dateStr).substring(0, 10) + 'T00:00:00')
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  // Calendar calculations
  const firstDayOfWeek = new Date(year, month, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  // Generate cells
  const calendarCells = []

  // Prev month padding
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i
    const d = new Date(year, month - 1, dayNum)
    calendarCells.push({
      date: d,
      dateStr: d.toISOString().split('T')[0],
      dayNum,
      isCurrentMonth: false,
    })
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    calendarCells.push({
      date: d,
      dateStr,
      dayNum: i,
      isCurrentMonth: true,
    })
  }

  // Next month padding to fill multiple of 7
  const remaining = 7 - (calendarCells.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      calendarCells.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        dayNum: i,
        isCurrentMonth: false,
      })
    }
  }

  // Filter dayoffs by selected staff and criteria
  const dayoffsByDate = useMemo(() => {
    const map = {}
    dayoffs.forEach(item => {
      if (selectedStaffFilter !== 'all' && String(item.staff_id) !== String(selectedStaffFilter)) {
        return
      }
      const dateOnly = String(item.date).substring(0, 10)
      if (!map[dateOnly]) map[dateOnly] = []
      map[dateOnly].push(item)
    })
    return map
  }, [dayoffs, selectedStaffFilter])

  // Filtered List for the Scheduled Days Off & Leave List section
  const filteredLeaveList = useMemo(() => {
    return dayoffs.filter((item) => {
      const staffName = item.staff?.name || ''
      const staffRole = item.staff?.role || ''
      const reason = item.reason || ''
      const dateOnly = String(item.date).substring(0, 10)

      // 1. Staff Filter
      if (selectedStaffFilter !== 'all' && String(item.staff_id) !== String(selectedStaffFilter)) {
        return false
      }

      // 2. Leave Type Filter
      if (selectedTypeFilter !== 'all' && item.type !== selectedTypeFilter) {
        return false
      }

      // 3. Time Filter
      if (timeTabFilter === 'today' && dateOnly !== todayIso) {
        return false
      }
      if (timeTabFilter === 'upcoming' && dateOnly <= todayIso) {
        return false
      }
      if (timeTabFilter === 'past' && dateOnly >= todayIso) {
        return false
      }

      // 4. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = staffName.toLowerCase().includes(q)
        const matchRole = staffRole.toLowerCase().includes(q)
        const matchReason = reason.toLowerCase().includes(q)
        const matchDate = dateOnly.includes(q)
        if (!matchName && !matchRole && !matchReason && !matchDate) {
          return false
        }
      }

      return true
    })
  }, [dayoffs, selectedStaffFilter, selectedTypeFilter, timeTabFilter, searchQuery, todayIso])

  // Summary Metrics
  const todayOnLeave = dayoffs.filter(d => String(d.date).substring(0, 10) === todayIso)
  const upcomingLeaves = dayoffs.filter(d => String(d.date).substring(0, 10) > todayIso)
  const vacationLeaves = dayoffs.filter(d => d.type === 'annual_leave')
  const sickLeaves = dayoffs.filter(d => d.type === 'sick_leave')

  return (
    <div className="dayoff-calendar-view">
      {/* ============================================================== */}
      {/* TOP HEADER ROW & VIEW SWITCHER */}
      {/* ============================================================== */}
      <div className="calendar-top-bar">
        <div>
          <h2 className="calendar-page-title">
            <IconCalendar size={22} color="#0f172a" />
            <span>Staff Day Off & Schedule Calendar</span>
          </h2>
          <p className="calendar-page-subtitle">
            Plan, assign, and manage staff scheduled days off, vacations, and shift leaves.
          </p>
        </div>

        <div className="calendar-top-actions">
          {/* Page Display Mode Segment */}
          <div className="view-mode-segmented">
            <button
              type="button"
              className={`mode-segment-btn ${pageDisplayMode === 'all' ? 'active' : ''}`}
              onClick={() => setPageDisplayMode('all')}
              title="Show both Calendar and Leave List"
            >
              All-In-One
            </button>
            <button
              type="button"
              className={`mode-segment-btn ${pageDisplayMode === 'list_only' ? 'active' : ''}`}
              onClick={() => setPageDisplayMode('list_only')}
              title="Show Leave List only"
            >
              Leave List
            </button>
            <button
              type="button"
              className={`mode-segment-btn ${pageDisplayMode === 'calendar_only' ? 'active' : ''}`}
              onClick={() => setPageDisplayMode('calendar_only')}
              title="Show Calendar only"
            >
              Calendar
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={fetchDayoffs}
            title="Refresh schedule"
          >
            <IconRefresh size={14} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => handleOpenAssign()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <IconPlus size={16} />
            <span>Assign Day Off</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TOP KPI CARDS */}
      {/* ============================================================== */}
      <div className="calendar-kpi-row">
        <div className="calendar-kpi-card blue">
          <div className="kpi-icon-box">🌴</div>
          <div className="kpi-text-box">
            <span className="kpi-stat-label">TOTAL SCHEDULED THIS MONTH</span>
            <span className="kpi-stat-value">{dayoffs.length} Days</span>
          </div>
        </div>

        <div className="calendar-kpi-card amber">
          <div className="kpi-icon-box">🏖️</div>
          <div className="kpi-text-box">
            <span className="kpi-stat-label">STAFF ON DAY OFF TODAY</span>
            <span className="kpi-stat-value">
              {todayOnLeave.length} Staff Member{todayOnLeave.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="calendar-kpi-card green">
          <div className="kpi-icon-box">☕</div>
          <div className="kpi-text-box">
            <span className="kpi-stat-label">AVAILABLE / ROSTER STAFF</span>
            <span className="kpi-stat-value">{Math.max(0, staffList.length - todayOnLeave.length)} of {staffList.length}</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CALENDAR SECTION (Visible if mode === 'all' or 'calendar_only') */}
      {/* ============================================================== */}
      {(pageDisplayMode === 'all' || pageDisplayMode === 'calendar_only') && (
        <div className="calendar-card-wrapper">
          {/* Calendar Controls & Month Selector */}
          <div className="calendar-nav-toolbar">
            <div className="calendar-month-controls">
              <button className="cal-nav-btn" onClick={handlePrevMonth} title="Previous month">
                &larr; Prev
              </button>
              <button className="cal-today-btn" onClick={handleToday}>
                Today
              </button>
              <button className="cal-nav-btn" onClick={handleNextMonth} title="Next month">
                Next &rarr;
              </button>
              <span className="cal-month-heading">
                {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            {/* Staff Filter Dropdown */}
            <div className="calendar-filter-group">
              <span className="filter-label">
                <IconFilter size={13} color="#64748b" />
                <span>Filter Staff:</span>
              </span>
              <select
                className="filter-select"
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
              >
                <option value="all">All Staff Members ({staffList.length})</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Calendar Grid */}
          {loading ? (
            <div style={{ padding: '16px' }}>
              <SkeletonCalendar />
            </div>
          ) : (
            <div className="calendar-grid-container">
            {/* Days of week header */}
            <div className="calendar-weekdays-header">
              <div>SUN</div>
              <div>MON</div>
              <div>TUE</div>
              <div>WED</div>
              <div>THU</div>
              <div>FRI</div>
              <div>SAT</div>
            </div>

            {/* Date cells grid */}
            <div className="calendar-cells-grid">
              {calendarCells.map((cell) => {
                const cellDayoffs = dayoffsByDate[cell.dateStr] || []
                const isToday = cell.dateStr === todayIso

                return (
                  <div
                    key={cell.dateStr}
                    className={`calendar-date-cell ${cell.isCurrentMonth ? 'current-month' : 'other-month'} ${isToday ? 'is-today' : ''}`}
                    onClick={() => cell.isCurrentMonth && handleOpenAssign(cell.dateStr)}
                  >
                    {/* Cell Header: Day Number */}
                    <div className="date-cell-header">
                      <span className={`date-number ${isToday ? 'today-pill' : ''}`}>
                        {cell.dayNum}
                      </span>
                      {isToday && <span className="today-text-tag">TODAY</span>}
                    </div>

                    {/* Day Off Chips */}
                    <div className="date-cell-events">
                      {cellDayoffs.map((item) => {
                        const leaveMeta = leaveTypes.find(l => l.id === item.type) || leaveTypes[0]
                        const staffName = item.staff?.name || 'Staff'

                        return (
                          <div
                            key={item.id}
                            className="dayoff-chip"
                            style={{
                              backgroundColor: leaveMeta.bg,
                              color: leaveMeta.color,
                              borderColor: leaveMeta.color + '40',
                            }}
                            title={`${staffName} - ${leaveMeta.label}: ${item.reason || 'Assigned Day Off'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="chip-icon">{leaveMeta.icon}</span>
                            <span className="chip-name">{staffName}</span>
                            <button
                              type="button"
                              className="chip-delete-btn"
                              title="Cancel day off"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteDayoff(item.id, staffName, cell.dateStr)
                              }}
                              disabled={deletingId === item.id}
                            >
                              &times;
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    {/* Quick Add Plus indicator on hover */}
                    {cell.isCurrentMonth && (
                      <button
                        type="button"
                        className="cell-quick-add-btn"
                        title={`Assign day off on ${cell.dateStr}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenAssign(cell.dateStr)
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )}

      {/* ============================================================== */}
      {/* REDESIGNED: SCHEDULED DAYS OFF & LEAVE LIST SECTION */}
      {/* ============================================================== */}
      {(pageDisplayMode === 'all' || pageDisplayMode === 'list_only') && (
        <section className="leave-list-section-card" aria-label="Scheduled Days Off & Leave List">
          {/* Section Main Header */}
          <div className="leave-section-header">
            <div className="leave-section-title-box">
              <div className="leave-section-badge">
                <IconCalendar size={16} color="#0284c7" />
                <span>HR SCHEDULE ROSTER</span>
              </div>
              <h3 className="leave-section-heading">
                SCHEDULED DAYS OFF & LEAVE LIST
                <span className="leave-counter-pill">
                  {filteredLeaveList.length} {filteredLeaveList.length === 1 ? 'Record' : 'Records'}
                </span>
              </h3>
              <p className="leave-section-sub">
                Comprehensive overview of all approved staff leaves, planned days off, and vacation schedules.
              </p>
            </div>

            <div className="leave-section-actions">
              {/* Layout Switcher (Table vs Cards) */}
              <div className="view-toggle-group">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewLayout === 'table' ? 'active' : ''}`}
                  onClick={() => setViewLayout('table')}
                  title="Table View"
                >
                  <IconList size={15} />
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewLayout === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewLayout('cards')}
                  title="Cards Grid View"
                >
                  <IconGrid size={15} />
                  <span>Cards</span>
                </button>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsManageLeaveModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
                title="Manage Leave Types (Admin)"
              >
                <span>⚙️</span>
                <span>Manage Leave Types</span>
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpenAssign()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
              >
                <IconPlus size={15} />
                <span>+ Assign Day Off</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Mini Badges */}
          <div className="leave-metrics-mini-row">
            <div className="mini-metric-pill total">
              <span className="metric-pill-dot blue"></span>
              <span className="metric-pill-label">Total Scheduled:</span>
              <span className="metric-pill-val">{dayoffs.length}</span>
            </div>
            <div className="mini-metric-pill today">
              <span className="metric-pill-dot green"></span>
              <span className="metric-pill-label">Off Today:</span>
              <span className="metric-pill-val">{todayOnLeave.length}</span>
            </div>
            <div className="mini-metric-pill upcoming">
              <span className="metric-pill-dot amber"></span>
              <span className="metric-pill-label">Upcoming:</span>
              <span className="metric-pill-val">{upcomingLeaves.length}</span>
            </div>
            <div className="mini-metric-pill vacation">
              <span className="metric-pill-dot purple"></span>
              <span className="metric-pill-label">Vacations:</span>
              <span className="metric-pill-val">{vacationLeaves.length}</span>
            </div>
            <div className="mini-metric-pill sick">
              <span className="metric-pill-dot red"></span>
              <span className="metric-pill-label">Medical:</span>
              <span className="metric-pill-val">{sickLeaves.length}</span>
            </div>
          </div>

          {/* Comprehensive Filter Bar */}
          <div className="leave-controls-bar">
            {/* Search Input */}
            <div className="leave-search-box">
              <span className="leave-search-icon">
                <IconSearch size={15} color="#94a3b8" />
              </span>
              <input
                type="text"
                className="leave-search-input"
                placeholder="Search staff name, role, reason or date (YYYY-MM-DD)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="leave-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Time Filter Pills */}
            <div className="leave-time-tabs">
              <button
                type="button"
                className={`time-tab-btn ${timeTabFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTimeTabFilter('all')}
              >
                All Records
              </button>
              <button
                type="button"
                className={`time-tab-btn ${timeTabFilter === 'today' ? 'active' : ''}`}
                onClick={() => setTimeTabFilter('today')}
              >
                🏖️ Off Today ({todayOnLeave.length})
              </button>
              <button
                type="button"
                className={`time-tab-btn ${timeTabFilter === 'upcoming' ? 'active' : ''}`}
                onClick={() => setTimeTabFilter('upcoming')}
              >
                Upcoming ({upcomingLeaves.length})
              </button>
              <button
                type="button"
                className={`time-tab-btn ${timeTabFilter === 'past' ? 'active' : ''}`}
                onClick={() => setTimeTabFilter('past')}
              >
                Past History
              </button>
            </div>
          </div>

          {/* Leave Type Filter Badges Row */}
          <div className="leave-type-filters-row">
            <span className="type-filter-label">Filter Leave Type:</span>
            <button
              type="button"
              className={`type-chip-btn ${selectedTypeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedTypeFilter('all')}
            >
              All Types ({dayoffs.length})
            </button>
            {leaveTypes.map((lt) => {
              const count = dayoffs.filter(d => d.type === lt.id).length
              return (
                <button
                  key={lt.id}
                  type="button"
                  className={`type-chip-btn ${selectedTypeFilter === lt.id ? 'active' : ''}`}
                  onClick={() => setSelectedTypeFilter(selectedTypeFilter === lt.id ? 'all' : lt.id)}
                >
                  <span>{lt.icon}</span>
                  <span>{lt.label}</span>
                  <span className="type-chip-count">{count}</span>
                </button>
              )
            })}
          </div>

          {/* ============================================================== */}
          {/* VIEW OPTION 1: MODERN ROSTER TABLE VIEW */}
          {/* ============================================================== */}
          {viewLayout === 'table' && (
            <div className="leave-table-container">
              <table className="modern-leave-table">
                <thead>
                  <tr>
                    <th style={{ width: '26%' }}>STAFF MEMBER</th>
                    <th style={{ width: '18%' }}>ROLE & SHIFT</th>
                    <th style={{ width: '20%' }}>SCHEDULED DATE</th>
                    <th style={{ width: '18%' }}>LEAVE TYPE</th>
                    <th style={{ width: '18%' }}>REASON / NOTES</th>
                    <th style={{ width: '8%', textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ padding: 0 }}>
                        <SkeletonTable rows={4} columns={6} />
                      </td>
                    </tr>
                  ) : filteredLeaveList.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <div className="leave-empty-state">
                          <div className="empty-state-icon">🗓️</div>
                          <h4 className="empty-state-title">No scheduled days off found</h4>
                          <p className="empty-state-desc">
                            {searchQuery || selectedTypeFilter !== 'all' || timeTabFilter !== 'all'
                              ? 'No records match your selected filter criteria. Try clearing search or filters.'
                              : 'No staff days off scheduled yet for this month. Click "+ Assign Day Off" to create one.'}
                          </p>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '14px' }}>
                            {(searchQuery || selectedTypeFilter !== 'all' || timeTabFilter !== 'all') && (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                  setSearchQuery('')
                                  setSelectedTypeFilter('all')
                                  setTimeTabFilter('all')
                                  setSelectedStaffFilter('all')
                                }}
                              >
                                Reset Filters
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleOpenAssign()}
                            >
                              + Assign Day Off
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLeaveList.map((item) => {
                      const leaveMeta = leaveTypes.find(l => l.id === item.type) || leaveTypes[0]
                      const staffName = item.staff?.name || 'Staff Member'
                      const staffRole = item.staff?.role || 'Team Member'
                      const staffEmail = item.staff?.email || ''
                      const shiftInfo = item.staff?.shift_start ? `${item.staff.shift_start} - ${item.staff.shift_end}` : 'Standard Shift'
                      const isCurrentDay = String(item.date).substring(0, 10) === todayIso
                      const relativeInfo = getRelativeDateInfo(item.date)

                      return (
                        <tr key={item.id} className={isCurrentDay ? 'row-today-active' : ''}>
                          {/* Staff Column */}
                          <td>
                            <div className="leave-staff-cell">
                              <div
                                className={`leave-staff-avatar ${item.staff?.avatar_color || 'amber'}`}
                                title={staffName}
                              >
                                {staffName.charAt(0)}
                              </div>
                              <div className="leave-staff-details">
                                <span className="leave-staff-name">{staffName}</span>
                                <span className="leave-staff-email">{staffEmail}</span>
                              </div>
                            </div>
                          </td>

                          {/* Role & Shift */}
                          <td>
                            <div className="leave-role-cell">
                              <span className="leave-role-badge">{staffRole}</span>
                              <span className="leave-shift-text">
                                <IconClock size={11} color="#94a3b8" />
                                <span>{shiftInfo}</span>
                              </span>
                            </div>
                          </td>

                          {/* Scheduled Date */}
                          <td>
                            <div className="leave-date-cell">
                              <span className="leave-formatted-date">
                                {formatFriendlyDate(item.date)}
                              </span>
                              <span className={`leave-relative-badge ${relativeInfo.type}`}>
                                {relativeInfo.type === 'today' && <span className="pulsing-live-dot"></span>}
                                {relativeInfo.text}
                              </span>
                            </div>
                          </td>

                          {/* Leave Type */}
                          <td>
                            <span
                              className="modern-leave-badge"
                              style={{
                                backgroundColor: leaveMeta.bg,
                                color: leaveMeta.color,
                                borderColor: leaveMeta.border,
                              }}
                            >
                              <span className="badge-emoji">{leaveMeta.icon}</span>
                              <span className="badge-text">{leaveMeta.label}</span>
                            </span>
                          </td>

                          {/* Reason / Note */}
                          <td>
                            <div className="leave-reason-text" title={item.reason || 'Assigned Day Off'}>
                              {item.reason ? (
                                <span>&ldquo;{item.reason}&rdquo;</span>
                              ) : (
                                <span className="leave-reason-placeholder">Regular schedule off</span>
                              )}
                            </div>
                          </td>

                          {/* Action */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="leave-action-btn cancel"
                              title={`Cancel day off for ${staffName} on ${item.date}`}
                              onClick={() => handleDeleteDayoff(item.id, staffName, item.date)}
                              disabled={deletingId === item.id}
                            >
                              <IconTrash size={13} />
                              <span>Cancel</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW OPTION 2: CARDS GRID VIEW */}
          {/* ============================================================== */}
          {viewLayout === 'cards' && (
            loading ? (
              <SkeletonCardGrid count={4} />
            ) : (
            <div className="leave-cards-grid">
              {filteredLeaveList.length === 0 ? (
                <div className="leave-empty-state" style={{ gridColumn: '1 / -1' }}>
                  <div className="empty-state-icon">🗓️</div>
                  <h4 className="empty-state-title">No scheduled days off found</h4>
                  <p className="empty-state-desc">
                    No records match the current filters.
                  </p>
                </div>
              ) : (
                filteredLeaveList.map((item) => {
                  const leaveMeta = leaveTypes.find(l => l.id === item.type) || leaveTypes[0]
                  const staffName = item.staff?.name || 'Staff Member'
                  const staffRole = item.staff?.role || 'Team Member'
                  const isCurrentDay = String(item.date).substring(0, 10) === todayIso
                  const relativeInfo = getRelativeDateInfo(item.date)

                  return (
                    <div
                      key={item.id}
                      className={`leave-record-card ${isCurrentDay ? 'is-today-card' : ''}`}
                      style={{ borderTopColor: leaveMeta.color }}
                    >
                      {/* Card Header */}
                      <div className="record-card-header">
                        <div className="record-card-user">
                          <div className={`leave-staff-avatar ${item.staff?.avatar_color || 'amber'}`}>
                            {staffName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="record-card-name">{staffName}</h4>
                            <span className="record-card-role">{staffRole}</span>
                          </div>
                        </div>

                        <span
                          className={`leave-relative-badge ${relativeInfo.type}`}
                        >
                          {relativeInfo.type === 'today' && <span className="pulsing-live-dot"></span>}
                          {relativeInfo.text}
                        </span>
                      </div>

                      {/* Card Date Row */}
                      <div className="record-card-date-box">
                        <div className="record-date-item">
                          <IconCalendar size={14} color="#64748b" />
                          <span className="record-date-text">{formatFriendlyDate(item.date)}</span>
                        </div>
                        <span
                          className="modern-leave-badge mini"
                          style={{
                            backgroundColor: leaveMeta.bg,
                            color: leaveMeta.color,
                            borderColor: leaveMeta.border,
                          }}
                        >
                          <span>{leaveMeta.icon}</span>
                          <span>{leaveMeta.label}</span>
                        </span>
                      </div>

                      {/* Card Reason */}
                      <div className="record-card-reason">
                        {item.reason ? (
                          <span>&ldquo;{item.reason}&rdquo;</span>
                        ) : (
                          <span className="reason-subtle">Assigned scheduled day off</span>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="record-card-footer">
                        <span className="record-card-id">ID: #{item.id}</span>
                        <button
                          type="button"
                          className="leave-action-btn cancel"
                          onClick={() => handleDeleteDayoff(item.id, staffName, item.date)}
                          disabled={deletingId === item.id}
                        >
                          <IconTrash size={12} />
                          <span>Cancel Day Off</span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            )
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* MODAL: ASSIGN DAY OFF / LEAVE (POPUP MODAL) */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="modal-content"
            style={{ maxWidth: '500px', width: '100%', borderRadius: '10px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconCalendar size={18} color="#f97316" />
                <h3 className="modal-title">Assign Day Off / Leave</h3>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setIsModalOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} autoComplete="off" noValidate>
              <div className="modal-body" style={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
                {/* Select Staff */}
                <div className="form-group">
                  <label className="form-label" htmlFor="assign-staff">
                    Select Staff Member <span className="form-required">*</span>
                  </label>
                  <select
                    id="assign-staff"
                    className={`form-input ${formErrors.staff ? 'input-error' : ''}`}
                    value={formStaffId}
                    onChange={(e) => {
                      setFormStaffId(e.target.value)
                      if (formErrors.staff) setFormErrors(prev => ({ ...prev, staff: null }))
                    }}
                  >
                    <option value="">-- Select a staff member --</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role}) - Shift: {s.shift_start} to {s.shift_end}
                      </option>
                    ))}
                  </select>
                  {formErrors.staff && (
                    <span className="form-error-msg">{formErrors.staff}</span>
                  )}
                </div>

                {/* Mode: Single Day vs Date Range */}
                <div className="form-group">
                  <label className="form-label">Duration Mode</label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: assignMode === 'single' ? '600' : '400' }}>
                      <input
                        type="radio"
                        name="assign_mode"
                        checked={assignMode === 'single'}
                        onChange={() => {
                          setAssignMode('single')
                          setFormErrors(prev => ({ ...prev, date: null, date_start: null, date_end: null }))
                        }}
                      />
                      <span>Single Day</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: assignMode === 'range' ? '600' : '400' }}>
                      <input
                        type="radio"
                        name="assign_mode"
                        checked={assignMode === 'range'}
                        onChange={() => {
                          setAssignMode('range')
                          setFormErrors(prev => ({ ...prev, date: null, date_start: null, date_end: null }))
                        }}
                      />
                      <span>Date Range (Multi-day)</span>
                    </label>
                  </div>
                </div>

                {/* Date Inputs */}
                {assignMode === 'single' ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="assign-date">
                      Day Off Date <span className="form-required">*</span>
                    </label>
                    <input
                      id="assign-date"
                      type="date"
                      className={`form-input ${formErrors.date ? 'input-error' : ''}`}
                      value={formDate}
                      onChange={(e) => {
                        setFormDate(e.target.value)
                        if (formErrors.date) setFormErrors(prev => ({ ...prev, date: null }))
                      }}
                    />
                    {formErrors.date && (
                      <span className="form-error-msg">{formErrors.date}</span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="assign-start">
                        Start Date <span className="form-required">*</span>
                      </label>
                      <input
                        id="assign-start"
                        type="date"
                        className={`form-input ${formErrors.date_start ? 'input-error' : ''}`}
                        value={formDateStart}
                        onChange={(e) => {
                          setFormDateStart(e.target.value)
                          if (formErrors.date_start) setFormErrors(prev => ({ ...prev, date_start: null }))
                        }}
                      />
                      {formErrors.date_start && (
                        <span className="form-error-msg">{formErrors.date_start}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="assign-end">
                        End Date <span className="form-required">*</span>
                      </label>
                      <input
                        id="assign-end"
                        type="date"
                        className={`form-input ${formErrors.date_end ? 'input-error' : ''}`}
                        value={formDateEnd}
                        min={formDateStart}
                        onChange={(e) => {
                          setFormDateEnd(e.target.value)
                          if (formErrors.date_end) setFormErrors(prev => ({ ...prev, date_end: null }))
                        }}
                      />
                      {formErrors.date_end && (
                        <span className="form-error-msg">{formErrors.date_end}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Leave Type */}
                <div className="form-group">
                  <label className="form-label" htmlFor="assign-type">
                    Leave / Day Off Type <span className="form-required">*</span>
                  </label>
                  <select
                    id="assign-type"
                    className="form-input"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                  >
                    {leaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.icon} {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason / Note */}
                <div className="form-group">
                  <label className="form-label" htmlFor="assign-reason">
                    Reason / Notes (Optional)
                  </label>
                  <input
                    id="assign-reason"
                    type="text"
                    className="form-input"
                    placeholder="Enter notes or reason"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Assigning...' : 'Confirm Day Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MANAGE LEAVE TYPES MODAL (ADMIN: CREATE, EDIT, DELETE, SORT)   */}
      {/* ============================================================== */}
      {isManageLeaveModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsManageLeaveModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">⚙️ Manage Leave / Day Off Types</h2>
              <button type="button" className="btn-close" onClick={() => setIsManageLeaveModalOpen(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                Create new leave categories, edit labels, adjust colors, and reorder (sort) them as they appear across the calendar and forms.
              </p>

              {/* Add New Leave Type Card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                  + Add New Leave Category
                </strong>
                <form onSubmit={handleAddLeaveType} style={{ display: 'grid', gridTemplateColumns: '60px 1.4fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="🌴"
                    value={newLeaveTypeForm.icon}
                    onChange={(e) => setNewLeaveTypeForm({ ...newLeaveTypeForm, icon: e.target.value })}
                    title="Icon or Emoji"
                    style={{ textAlign: 'center', fontSize: '16px' }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Leave Name"
                    value={newLeaveTypeForm.label}
                    onChange={(e) => setNewLeaveTypeForm({ ...newLeaveTypeForm, label: e.target.value })}
                    required
                  />
                  <select
                    className="form-select"
                    value={newLeaveTypeForm.color}
                    onChange={(e) => setNewLeaveTypeForm({ ...newLeaveTypeForm, color: e.target.value })}
                  >
                    <option value="#0284c7">🔵 Blue</option>
                    <option value="#059669">🟢 Emerald</option>
                    <option value="#dc2626">🔴 Red</option>
                    <option value="#7c3aed">🟣 Purple</option>
                    <option value="#d97706">🟡 Amber</option>
                    <option value="#db2777">🌸 Pink</option>
                    <option value="#0d9488">🌊 Teal</option>
                  </select>
                  <button type="submit" className="btn-primary" style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    Add
                  </button>
                </form>
              </div>

              {/* List of Existing Leave Types with Sort (Move Up/Down), Edit, Delete */}
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                  Current Leave Types & Sorting Order ({leaveTypes.length}):
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {leaveTypes.map((lt, idx) => (
                    <div
                      key={lt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    >
                      {editingLeaveType?.id === lt.id ? (
                        <form onSubmit={handleSaveEditLeaveType} style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
                          <input
                            type="text"
                            className="form-input"
                            value={editingLeaveType.icon}
                            onChange={(e) => setEditingLeaveType({ ...editingLeaveType, icon: e.target.value })}
                            style={{ width: '45px', textAlign: 'center' }}
                          />
                          <input
                            type="text"
                            className="form-input"
                            value={editingLeaveType.label}
                            onChange={(e) => setEditingLeaveType({ ...editingLeaveType, label: e.target.value })}
                            style={{ flex: 1 }}
                            required
                          />
                          <select
                            className="form-select"
                            value={editingLeaveType.color}
                            onChange={(e) => setEditingLeaveType({ ...editingLeaveType, color: e.target.value })}
                            style={{ width: '100px' }}
                          >
                            <option value="#0284c7">Blue</option>
                            <option value="#059669">Emerald</option>
                            <option value="#dc2626">Red</option>
                            <option value="#7c3aed">Purple</option>
                            <option value="#d97706">Amber</option>
                            <option value="#db2777">Pink</option>
                            <option value="#0d9488">Teal</option>
                          </select>
                          <button type="submit" className="btn-primary" style={{ padding: '6px 10px', fontSize: '11px' }}>Save</button>
                          <button type="button" className="btn-secondary" onClick={() => setEditingLeaveType(null)} style={{ padding: '6px 10px', fontSize: '11px' }}>✕</button>
                        </form>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px' }}>{lt.icon}</span>
                            <div>
                              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{lt.label}</strong>
                              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: lt.color, marginLeft: '8px' }} />
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {/* Sort: Move Up */}
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '12px' }}
                              disabled={idx === 0}
                              onClick={() => handleMoveLeaveType(idx, 'up')}
                              title="Move Up (Sort)"
                            >
                              ↑
                            </button>
                            {/* Sort: Move Down */}
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '12px' }}
                              disabled={idx === leaveTypes.length - 1}
                              onClick={() => handleMoveLeaveType(idx, 'down')}
                              title="Move Down (Sort)"
                            >
                              ↓
                            </button>
                            {/* Edit */}
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => setEditingLeaveType({ ...lt })}
                            >
                              Edit
                            </button>
                            {/* Delete */}
                            {leaveTypes.length > 1 && (
                              <button
                                type="button"
                                style={{ background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                                onClick={() => handleDeleteLeaveType(lt.id)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsManageLeaveModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
