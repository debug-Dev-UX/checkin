import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore'
import { db } from '../firebase'

// Local storage backup keys for offline resilience
const STORAGE_PREFIX = 'chafe_live_'

const DEMO_STAFF_IDS = [
  'stf_maya',
  'stf_liam',
  'stf_chloe',
  'stf_julien',
  'stf_sophie',
  'stf_leo',
  'stf_noah',
  'stf_emma'
]
const DEMO_CHECKIN_IDS = ['chk_1', 'chk_2', 'chk_3']

const DEFAULT_SETTINGS = {
  cafe_name: 'Chafé',
  operating_hours: '07:00 AM - 10:00 PM',
  late_grace_period_mins: 10,
  seating_capacity: 48,
  wifi_ssid: 'Chafe_Specialty_Guest',
  qr_target_url: 'https://group-one-usea.firebaseapp.com/#user'
}

function getLocal(key, fallback = []) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function setLocal(key, val) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val))
  } catch {
    // quiet
  }
}

let isInitialized = false

/**
 * Initialize Database Collections & Remove any legacy demo data
 */
export async function initFirebaseDatabase() {
  if (isInitialized) return
  isInitialized = true

  // Clear legacy demo keys from local browser storage
  try {
    const legacyKeys = [
      'chafe_fb_staff',
      'chafe_fb_checkins',
      'chafe_fb_dayoffs',
      'chafe_fb_settings',
      'chafe_staff_list',
      'chafe_checkins',
      'chafe_dayoffs'
    ]
    legacyKeys.forEach(k => localStorage.removeItem(k))
  } catch {
    // quiet
  }

  try {
    // 1. Purge legacy demo staff in Firestore
    for (const dId of DEMO_STAFF_IDS) {
      try {
        await deleteDoc(doc(db, 'staff', dId))
      } catch {
        // quiet
      }
    }

    // 2. Purge legacy demo checkins in Firestore
    for (const cId of DEMO_CHECKIN_IDS) {
      try {
        await deleteDoc(doc(db, 'checkins', cId))
      } catch {
        // quiet
      }
    }

    // 3. Purge legacy demo dayoffs in Firestore
    try {
      const qDay = query(collection(db, 'dayoffs'), where('staff_id', '==', 'stf_chloe'))
      const snap = await getDocs(qDay)
      snap.forEach(d => {
        deleteDoc(d.ref).catch(() => {})
      })
    } catch {
      // quiet
    }

    // 4. Ensure settings document exists
    const settingsRef = doc(db, 'settings', 'general')
    const settingsSnap = await getDoc(settingsRef)
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, DEFAULT_SETTINGS)
      setLocal('settings', DEFAULT_SETTINGS)
    }
  } catch (err) {
    console.warn('Firebase initialized in clean production mode:', err.message)
    if (!getLocal('settings', null)) {
      setLocal('settings', DEFAULT_SETTINGS)
    }
  }
}

/**
 * Unified Login (Admin or Staff)
 */
export async function loginWithFirebase(username, password) {
  const trimmedUser = (username || '').trim().toLowerCase()
  const trimmedPass = (password || '').trim()

  // 1. Check Admin
  if (trimmedUser === 'admin' && trimmedPass === '123456') {
    return {
      status: 'success',
      role: 'admin',
      token: 'admin_token_' + Date.now(),
      user: {
        id: 'admin',
        name: 'Administrator',
        username: 'admin',
        role: 'admin',
        display_title: 'System Administrator'
      }
    }
  }

  // 2. Check Staff in Firestore
  let staffList = []
  try {
    const snap = await getDocs(collection(db, 'staff'))
    staffList = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => !DEMO_STAFF_IDS.includes(s.id))
  } catch {
    staffList = getLocal('staff', [])
  }

  if (!staffList || staffList.length === 0) {
    staffList = getLocal('staff', [])
  }

  const staff = staffList.find(s =>
    (s.username && s.username.toLowerCase() === trimmedUser) ||
    (s.email && s.email.toLowerCase() === trimmedUser) ||
    (s.name && s.name.toLowerCase() === trimmedUser)
  )

  if (!staff) {
    throw new Error('Invalid username or password. Please try again.')
  }

  const validPassword = staff.password
    ? staff.password === trimmedPass
    : trimmedPass === '123456'

  if (!validPassword) {
    throw new Error('Invalid username or password. Please try again.')
  }

  // Check today's day off & checkin status
  const todayStr = new Date().toISOString().split('T')[0]
  const dayoffs = await getDayoffsFromFirebase()
  const hasDayoff = dayoffs.some(d => String(d.staff_id) === String(staff.id) && String(d.date).startsWith(todayStr))

  const checkins = await getCheckinsFromFirebase()
  const userCheckin = checkins.find(c => (c.staff_id === staff.id || c.email === staff.email) && c.status === 'checked_in')

  return {
    status: 'success',
    role: 'staff',
    token: 'staff_token_' + Date.now(),
    staff: {
      ...staff,
      is_on_shift: !!userCheckin,
      has_dayoff_today: hasDayoff,
      latest_checkin: userCheckin || null
    }
  }
}

/**
 * Get Staff Members with Attendance Metadata (No demo data)
 */
export async function getStaffFromFirebase() {
  let list = []
  try {
    const snap = await getDocs(collection(db, 'staff'))
    if (!snap.empty) {
      list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => !DEMO_STAFF_IDS.includes(s.id))
      setLocal('staff', list)
    } else {
      list = getLocal('staff', [])
    }
  } catch {
    list = getLocal('staff', [])
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const dayoffs = await getDayoffsFromFirebase()
  const checkins = await getCheckinsFromFirebase()

  return list.map(stf => {
    const hasDayoff = dayoffs.some(d => String(d.staff_id) === String(stf.id) && String(d.date).startsWith(todayStr))
    const onShift = checkins.some(c => (String(c.staff_id) === String(stf.id) || c.email === stf.email) && c.status === 'checked_in')
    return {
      ...stf,
      has_dayoff_today: hasDayoff,
      is_on_shift: onShift
    }
  })
}

/**
 * Create Staff Member
 */
export async function createStaffInFirebase(data) {
  const newStaff = {
    ...data,
    hourly_rate: parseFloat(data.hourly_rate) || 20.0,
    status: 'active',
    created_at: new Date().toISOString()
  }

  try {
    const docRef = await addDoc(collection(db, 'staff'), newStaff)
    newStaff.id = docRef.id
  } catch {
    newStaff.id = 'stf_' + Date.now()
  }

  const current = getLocal('staff', [])
  setLocal('staff', [newStaff, ...current])
  return newStaff
}

/**
 * Update Staff Member
 */
export async function updateStaffInFirebase(id, data) {
  try {
    const docRef = doc(db, 'staff', id)
    await updateDoc(docRef, data)
  } catch {
    // local fallback
  }

  const current = getLocal('staff', [])
  const updated = current.map(s => (s.id === id ? { ...s, ...data } : s))
  setLocal('staff', updated)
}

/**
 * Delete Staff Member
 */
export async function deleteStaffInFirebase(id) {
  try {
    await deleteDoc(doc(db, 'staff', id))
  } catch {
    // local fallback
  }

  const current = getLocal('staff', [])
  const filtered = current.filter(s => s.id !== id)
  setLocal('staff', filtered)
}

/**
 * Get Check-ins List (No demo data)
 */
export async function getCheckinsFromFirebase() {
  try {
    const q = query(collection(db, 'checkins'), orderBy('created_at', 'desc'))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => !DEMO_CHECKIN_IDS.includes(c.id))
      setLocal('checkins', list)
      return list
    }
  } catch {
    // fallback
  }

  return getLocal('checkins', [])
}

/**
 * Create Check-in (Guest or Staff)
 */
export async function createCheckinInFirebase(data) {
  const now = new Date()
  let punctuality_status = 'on_time'
  let late_minutes = 0

  if (data.type === 'employee' && data.staff_id) {
    const staffList = await getStaffFromFirebase()
    const stf = staffList.find(s => s.id === data.staff_id)
    if (stf && stf.shift_start) {
      const [sh, sm] = stf.shift_start.split(':').map(Number)
      const shiftDate = new Date(now)
      shiftDate.setHours(sh, sm, 0, 0)
      if (now > shiftDate) {
        const diffMins = Math.round((now - shiftDate) / 60000)
        if (diffMins > 10) {
          punctuality_status = 'late'
          late_minutes = diffMins
        }
      }
    }
  }

  const record = {
    ...data,
    status: 'checked_in',
    punctuality_status,
    late_minutes,
    check_in_at: now.toISOString(),
    created_at: now.toISOString()
  }

  try {
    const docRef = await addDoc(collection(db, 'checkins'), record)
    record.id = docRef.id
  } catch {
    record.id = 'chk_' + Date.now()
  }

  const current = getLocal('checkins', [])
  setLocal('checkins', [record, ...current])
  return record
}

/**
 * Check-out action
 */
export async function checkoutInFirebase(id) {
  const checkOutAt = new Date().toISOString()

  try {
    const docRef = doc(db, 'checkins', id)
    await updateDoc(docRef, {
      status: 'checked_out',
      check_out_at: checkOutAt
    })
  } catch {
    // fallback
  }

  const current = getLocal('checkins', [])
  const updated = current.map(c => (c.id === id ? { ...c, status: 'checked_out', check_out_at: checkOutAt } : c))
  setLocal('checkins', updated)
}

/**
 * Delete check-in record
 */
export async function deleteCheckinInFirebase(id) {
  try {
    await deleteDoc(doc(db, 'checkins', id))
  } catch {
    // fallback
  }

  const current = getLocal('checkins', [])
  const updated = current.filter(c => c.id !== id)
  setLocal('checkins', updated)
}

/**
 * Get Today's Control Room Data
 */
export async function getTodayControlFromFirebase() {
  const checkins = await getCheckinsFromFirebase()
  const todayStr = new Date().toISOString().split('T')[0]
  const todayList = checkins.filter(c => String(c.created_at || c.check_in_at).startsWith(todayStr))
  const activeNow = todayList.filter(c => c.status === 'checked_in').length
  const checkedOut = todayList.filter(c => c.status === 'checked_out').length
  return {
    summary: {
      active_now: activeNow,
      checked_out_today: checkedOut,
      total_today: todayList.length
    },
    data: todayList
  }
}

/**
 * Get Specific Staff Member's Dayoffs
 */
export async function getStaffDayoffsFromFirebase(staffId) {
  const allDayoffs = await getDayoffsFromFirebase()
  return allDayoffs.filter(d => String(d.staff_id) === String(staffId))
}

/**
 * Get Scheduled Day Offs (No demo data)
 */
export async function getDayoffsFromFirebase(monthStr = null) {
  let list = []
  try {
    const snap = await getDocs(collection(db, 'dayoffs'))
    if (!snap.empty) {
      list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.staff_id !== 'stf_chloe')
      setLocal('dayoffs', list)
    } else {
      list = getLocal('dayoffs', [])
    }
  } catch {
    list = getLocal('dayoffs', [])
  }

  // Attach staff details
  const staffList = getLocal('staff', [])
  const populated = list.map(item => {
    const stf = staffList.find(s => String(s.id) === String(item.staff_id))
    return {
      ...item,
      staff: stf || { name: 'Staff Member', role: 'Team Member', avatar_color: 'amber' }
    }
  })

  if (monthStr) {
    return populated.filter(d => String(d.date).startsWith(monthStr))
  }
  return populated
}

/**
 * Create Day Off (Single or Range)
 */
export async function createDayoffInFirebase(data) {
  const recordsToInsert = []

  if (data.date_start && data.date_end) {
    const cur = new Date(data.date_start + 'T00:00:00')
    const end = new Date(data.date_end + 'T00:00:00')
    while (cur <= end) {
      recordsToInsert.push({
        staff_id: data.staff_id,
        date: cur.toISOString().split('T')[0],
        type: data.type || 'day_off',
        reason: data.reason || 'Scheduled Leave',
        status: 'approved',
        created_at: new Date().toISOString()
      })
      cur.setDate(cur.getDate() + 1)
    }
  } else {
    recordsToInsert.push({
      staff_id: data.staff_id,
      date: data.date,
      type: data.type || 'day_off',
      reason: data.reason || 'Scheduled Leave',
      status: 'approved',
      created_at: new Date().toISOString()
    })
  }

  for (const rec of recordsToInsert) {
    try {
      const docRef = await addDoc(collection(db, 'dayoffs'), rec)
      rec.id = docRef.id
    } catch {
      rec.id = 'dof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
    }
  }

  const current = getLocal('dayoffs', [])
  setLocal('dayoffs', [...recordsToInsert, ...current])
  return recordsToInsert
}

/**
 * Delete Day Off
 */
export async function deleteDayoffInFirebase(id) {
  try {
    await deleteDoc(doc(db, 'dayoffs', id))
  } catch {
    // fallback
  }

  const current = getLocal('dayoffs', [])
  setLocal('dayoffs', current.filter(d => d.id !== id))
}

/**
 * Get Overall Dashboard Stats (Accurate live counts, 0 when empty)
 */
export async function getStatsFromFirebase() {
  const staff = await getStaffFromFirebase()
  const checkins = await getCheckinsFromFirebase()
  const dayoffs = await getDayoffsFromFirebase()

  const todayStr = new Date().toISOString().split('T')[0]

  // Staff checked in today
  const staffCheckedInToday = checkins.filter(c =>
    c.type === 'employee' &&
    c.status === 'checked_in' &&
    String(c.check_in_at || c.created_at).startsWith(todayStr)
  ).length

  // Staff checked out today
  const staffCheckedOutToday = checkins.filter(c =>
    c.type === 'employee' &&
    c.status === 'checked_out' &&
    String(c.check_out_at || c.created_at).startsWith(todayStr)
  ).length

  // Staff on day off today
  const staffDayoffToday = dayoffs.filter(d => String(d.date).startsWith(todayStr)).length

  // Total active guests + staff
  const activeNow = checkins.filter(c => c.status === 'checked_in').length
  const checkedOutToday = checkins.filter(c => c.status === 'checked_out' && String(c.check_out_at || c.created_at).startsWith(todayStr)).length
  const totalToday = checkins.filter(c => String(c.created_at).startsWith(todayStr)).length

  return {
    total_staff: staff.length,
    staff_checked_in_today: staffCheckedInToday,
    staff_checked_out_today: staffCheckedOutToday,
    dayoff_today: staffDayoffToday,
    total_all: checkins.length,
    active_now: activeNow,
    checked_out_today: checkedOutToday,
    total_today: totalToday
  }
}

/**
 * Get Cafe Settings
 */
export async function getSettingsFromFirebase() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'))
    if (snap.exists()) {
      return snap.data()
    }
  } catch {
    // fallback
  }
  return getLocal('settings', DEFAULT_SETTINGS)
}

/**
 * Save Cafe Settings
 */
export async function saveSettingsInFirebase(data) {
  try {
    await setDoc(doc(db, 'settings', 'general'), data, { merge: true })
  } catch {
    // fallback
  }
  setLocal('settings', data)
}

/**
 * Get Performance Metrics
 */
export async function getPerformanceFromFirebase() {
  const checkins = await getCheckinsFromFirebase()
  const staff = await getStaffFromFirebase()

  const staffCheckins = checkins.filter(c => c.type === 'employee')
  const totalShifts = staffCheckins.length
  const lateShifts = staffCheckins.filter(c => c.punctuality_status === 'late').length
  const onTimeShifts = totalShifts - lateShifts
  const overallPunctuality = totalShifts > 0 ? Math.round((onTimeShifts / totalShifts) * 100) : 100

  return {
    overall_punctuality: overallPunctuality,
    total_shifts: totalShifts,
    total_late_arrivals: lateShifts,
    staff_performance: staff.map(s => {
      const userShifts = staffCheckins.filter(c => c.staff_id === s.id || c.email === s.email)
      const userLate = userShifts.filter(c => c.punctuality_status === 'late').length
      const userRate = userShifts.length > 0 ? Math.round(((userShifts.length - userLate) / userShifts.length) * 100) : 100
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        avatar_color: s.avatar_color,
        total_shifts: userShifts.length,
        punctuality_rate: userRate,
        late_count: userLate
      }
    })
  }
}
