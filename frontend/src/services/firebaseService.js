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
  orderBy,
  onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase.js'

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
  let firestoreErr = null
  try {
    const snap = await getDocs(collection(db, 'staff'))
    staffList = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => !DEMO_STAFF_IDS.includes(s.id))
  } catch (err) {
    firestoreErr = err
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
    if (firestoreErr && (firestoreErr.code === 'permission-denied' || String(firestoreErr.message).includes('permission'))) {
      throw new Error('Firestore Permission Denied: Rules are locked in Firebase Console. Please set rules to "allow read, write: if true;"')
    }
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
      // Merge with locally stored staff so newly created or offline staff are never wiped out
      const currentLocal = getLocal('staff', [])
      const localOnly = currentLocal.filter(l => !list.some(r => r.id === l.id || (r.email && r.email.toLowerCase() === l.email?.toLowerCase())))
      list = [...list, ...localOnly]
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
  const trimmedName = (data.name || '').trim()
  const fallbackUsername = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '') || `staff_${Date.now()}`
  const username = (data.username || '').trim().toLowerCase() || fallbackUsername
  const email = (data.email || '').trim().toLowerCase() || `${username}@chafe.com`

  const cleanStaff = {
    name: trimmedName,
    email: email,
    username: username,
    password: (data.password || '').trim() || '123456',
    role: data.role || 'Barista',
    branch_id: data.branch_id || 'branch_2',
    branch_name: data.branch_name || 'Chafé • Kohke',
    location: data.location || data.branch_name || 'Chafé • Kohke',
    branch_address: data.branch_address || 'Siem Reap, Cambodia',
    shift_start: data.shift_start || '07:30',
    shift_end: data.shift_end || '16:00',
    hourly_rate: parseFloat(data.hourly_rate) || 20.0,
    status: data.status || 'active',
    created_at: new Date().toISOString()
  }

  if (data.photo_url) {
    cleanStaff.photo_url = data.photo_url
  }

  // Remove any remaining undefined properties to guarantee Firestore never throws
  for (const [k, v] of Object.entries(cleanStaff)) {
    if (v === undefined) {
      delete cleanStaff[k]
    }
  }

  let createdId = null
  try {
    const docRef = await addDoc(collection(db, 'staff'), cleanStaff)
    createdId = docRef.id
  } catch (err) {
    console.warn('Failed to add staff document to Firestore, saving locally:', err)
    createdId = 'stf_' + Date.now()
  }

  cleanStaff.id = createdId

  const current = getLocal('staff', [])
  const filtered = current.filter(s => s.id !== cleanStaff.id && s.email !== cleanStaff.email)
  setLocal('staff', [cleanStaff, ...filtered])
  return cleanStaff
}

/**
 * Update Staff Member
 */
export async function updateStaffInFirebase(id, data) {
  if (!id) return
  // Sanitize data: remove any undefined or null/NaN values that cause Firestore to reject the update
  const cleanData = {}
  for (const [k, v] of Object.entries(data || {})) {
    if (v !== undefined) {
      cleanData[k] = v
    }
  }

  try {
    const docRef = doc(db, 'staff', String(id))
    await setDoc(docRef, cleanData, { merge: true })
  } catch (err) {
    console.warn('Failed to update staff document in Firestore:', err)
  }

  const current = getLocal('staff', [])
  const updated = current.map(s => (String(s.id) === String(id) ? { ...s, ...cleanData } : s))
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
 * Reliable timezone-safe check if a timestamp or date is today
 */
export function isTodayRecord(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

/**
 * Subscribe to real-time live check-ins from Firebase Firestore
 */
export function subscribeToLiveCheckins(callback) {
  try {
    // Listen directly to the checkins collection without requiring composite index
    const colRef = collection(db, 'checkins')
    const unsubscribe = onSnapshot(colRef, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => !DEMO_CHECKIN_IDS.includes(c.id))
        .sort((a, b) => {
          const tA = new Date(a.created_at || a.check_in_at || 0).getTime()
          const tB = new Date(b.created_at || b.check_in_at || 0).getTime()
          return tB - tA
        })
      setLocal('checkins', list)
      if (typeof callback === 'function') {
        callback(list)
      }
    }, (err) => {
      console.warn('Live checkins snapshot error:', err)
      if (typeof callback === 'function') {
        callback(getLocal('checkins', []))
      }
    })
    return unsubscribe
  } catch (err) {
    console.warn('Could not subscribe to live checkins:', err)
    if (typeof callback === 'function') {
      callback(getLocal('checkins', []))
    }
    return () => {}
  }
}

/**
 * Real-time listener for Staff roster updates
 */
export function subscribeToStaff(callback) {
  try {
    const colRef = collection(db, 'staff')
    const unsubscribe = onSnapshot(colRef, (snap) => {
      let list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => !DEMO_STAFF_IDS.includes(s.id))
      // Merge with locally stored staff so newly created staff are preserved
      const currentLocal = getLocal('staff', [])
      const localOnly = currentLocal.filter(l => !list.some(r => r.id === l.id || (r.email && r.email.toLowerCase() === l.email?.toLowerCase())))
      list = [...list, ...localOnly]
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setLocal('staff', list)
      if (typeof callback === 'function') {
        callback(list)
      }
    }, (err) => {
      console.warn('Live staff snapshot error:', err)
      if (typeof callback === 'function') {
        callback(getLocal('staff', []))
      }
    })
    return unsubscribe
  } catch (err) {
    console.warn('Could not subscribe to live staff:', err)
    if (typeof callback === 'function') {
      callback(getLocal('staff', []))
    }
    return () => {}
  }
}

/**
 * Automatically synchronize staff check-ins location when admin changes branch
 */
export async function syncStaffCheckinsBranchInFirebase(staffId, branchId, branchName, location) {
  if (!staffId) return
  try {
    const q = query(collection(db, 'checkins'), where('staff_id', '==', staffId))
    const snap = await getDocs(q)
    const updates = []
    snap.forEach(d => {
      updates.push(updateDoc(doc(db, 'checkins', d.id), {
        branch_id: branchId,
        branch_name: branchName,
        location: location || branchName
      }))
    })
    await Promise.allSettled(updates)

    // Also update local cache
    const current = getLocal('checkins', [])
    const updated = current.map(c => {
      if (c.staff_id === staffId) {
        return {
          ...c,
          branch_id: branchId,
          branch_name: branchName,
          location: location || branchName
        }
      }
      return c
    })
    setLocal('checkins', updated)
  } catch (err) {
    console.warn('Could not sync staff checkins branch:', err)
  }
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
    // Close any previous open checkin sessions for this staff member to prevent duplicate active states
    try {
      const q = query(
        collection(db, 'checkins'),
        where('staff_id', '==', data.staff_id),
        where('status', '==', 'checked_in')
      )
      const activeSnap = await getDocs(q)
      for (const d of activeSnap.docs) {
        await updateDoc(doc(db, 'checkins', d.id), {
          status: 'checked_out',
          check_out_at: now.toISOString()
        })
      }
    } catch {
      // quiet
    }

    const staffList = await getStaffFromFirebase()
    const stf = staffList.find(s => s.id === data.staff_id)
    if (stf && stf.shift_start) {
      let sh = 8, sm = 0
      const sStr = String(stf.shift_start).trim()
      const isPM = /pm/i.test(sStr)
      const isAM = /am/i.test(sStr)
      const numParts = sStr.replace(/[^0-9:]/g, '').split(':').map(Number)
      if (!isNaN(numParts[0])) sh = numParts[0]
      if (!isNaN(numParts[1])) sm = numParts[1]
      if (isPM && sh < 12) sh += 12
      if (isAM && sh === 12) sh = 0
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
  // Clean up any other active records for this employee in local storage too
  const cleaned = current.map(c => {
    if (data.type === 'employee' && data.staff_id && c.staff_id === data.staff_id && c.status === 'checked_in') {
      return { ...c, status: 'checked_out', check_out_at: now.toISOString() }
    }
    return c
  })
  setLocal('checkins', [record, ...cleaned])
  return record
}

/**
 * Check-out action
 */
export async function checkoutInFirebase(id, staffId = null) {
  const checkOutAt = new Date().toISOString()

  try {
    if (id) {
      const docRef = doc(db, 'checkins', id)
      await updateDoc(docRef, {
        status: 'checked_out',
        check_out_at: checkOutAt
      })
    }

    if (staffId) {
      const q = query(
        collection(db, 'checkins'),
        where('staff_id', '==', staffId),
        where('status', '==', 'checked_in')
      )
      const snap = await getDocs(q)
      for (const d of snap.docs) {
        if (d.id !== id) {
          await updateDoc(doc(db, 'checkins', d.id), {
            status: 'checked_out',
            check_out_at: checkOutAt
          })
        }
      }
    }
  } catch (err) {
    console.warn('Checkout error in firebase:', err)
  }

  const current = getLocal('checkins', [])
  const updated = current.map(c => {
    if (c.id === id || (staffId && c.staff_id === staffId && c.status === 'checked_in')) {
      return { ...c, status: 'checked_out', check_out_at: checkOutAt }
    }
    return c
  })
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
  const todayList = checkins.filter(c => isTodayRecord(c.created_at || c.check_in_at))
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

  // Staff checked in today
  const staffCheckedInToday = checkins.filter(c =>
    c.type === 'employee' &&
    c.status === 'checked_in' &&
    isTodayRecord(c.check_in_at || c.created_at)
  ).length

  // Staff checked out today
  const staffCheckedOutToday = checkins.filter(c =>
    c.type === 'employee' &&
    c.status === 'checked_out' &&
    isTodayRecord(c.check_out_at || c.created_at)
  ).length

  // Staff on day off today
  const staffDayoffToday = dayoffs.filter(d => isTodayRecord(d.date)).length

  // Total active guests + staff
  const activeNow = checkins.filter(c => c.status === 'checked_in').length
  const checkedOutToday = checkins.filter(c => c.status === 'checked_out' && isTodayRecord(c.check_out_at || c.created_at)).length
  const totalToday = checkins.filter(c => isTodayRecord(c.created_at || c.check_in_at)).length

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

/**
 * Multi-Branch (សាខា) Operations
 */
export async function getBranchesFromFirebase() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'branches'))
    if (snap.exists()) {
      const data = snap.data()
      if (Array.isArray(data.list) && data.list.length > 0) {
        setLocal('branches', data.list)
        try {
          localStorage.setItem('chafe_branches_config', JSON.stringify(data.list))
        } catch {}
        return data.list
      }
    }
  } catch {
    // quiet catch
  }
  const local = getLocal('branches', null)
  if (local && Array.isArray(local) && local.length > 0) {
    return local
  }
  try {
    const raw = localStorage.getItem('chafe_branches_config')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return [
    {
      id: 'branch_2',
      code: 'TK',
      name: 'Chafé • Kohke',
      address: 'Siem Reap, Cambodia',
      lat: 13.3632967,
      lng: 103.8623305,
      radiusMeters: 50,
      isActive: true,
    },
    {
      id: 'branch_1791018243906',
      code: 'B2',
      name: 'Chafé • Watbo',
      address: 'Siem Reap, Cambodia',
      lat: 13.3545705,
      lng: 103.8589937,
      radiusMeters: 50,
      isActive: true,
    },
    {
      id: 'branch_1791018323584',
      code: 'B3',
      name: 'Hotel',
      address: 'Siem Reap, Cambodia',
      lat: 13.351881,
      lng: 103.853068,
      radiusMeters: 50,
      isActive: true,
    },
  ]
}

/**
 * Real-time listener for multi-branch configurations
 */
export function subscribeToBranches(callback) {
  try {
    return onSnapshot(doc(db, 'settings', 'branches'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (Array.isArray(data.list) && data.list.length > 0) {
          setLocal('branches', data.list)
          try {
            localStorage.setItem('chafe_branches_config', JSON.stringify(data.list))
            localStorage.setItem('chafe_live_branches', JSON.stringify(data.list))
          } catch {}
          callback(data.list)
          return
        }
      }
      callback(getLocal('branches', []))
    }, () => {
      callback(getLocal('branches', []))
    })
  } catch {
    callback(getLocal('branches', []))
    return () => {}
  }
}

export async function saveBranchesToFirebase(branchesList) {
  try {
    await setDoc(doc(db, 'settings', 'branches'), { list: branchesList, updated_at: new Date().toISOString() }, { merge: true })
  } catch {
    // quiet catch
  }
  setLocal('branches', branchesList)
  try {
    localStorage.setItem('chafe_branches_config', JSON.stringify(branchesList))
    localStorage.setItem('chafe_live_branches', JSON.stringify(branchesList))
  } catch {}
  return branchesList
}

export const DEFAULT_STORE_ALERTS = [
  {
    id: 'alert_1',
    title: 'Single Origin Bean Refill',
    message: 'Please replenish Colombian hopper before midday peak.',
    priority: 'high',
    target_branch: 'all',
    isActive: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'alert_2',
    title: 'Weekly Roster Published',
    message: 'New schedule is available in your profile. Review your days off in Schedule.',
    priority: 'normal',
    target_branch: 'all',
    isActive: true,
    created_at: new Date().toISOString()
  }
]

export async function getStoreAlertsFromFirebase() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'store_alerts'))
    if (snap.exists()) {
      const data = snap.data()
      if (Array.isArray(data.list)) {
        setLocal('store_alerts', data.list)
        return data.list
      }
    }
  } catch {}
  const local = getLocal('store_alerts', null)
  if (local && Array.isArray(local)) return local
  try {
    const raw = localStorage.getItem('chafe_store_alerts')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return DEFAULT_STORE_ALERTS
}

export async function saveStoreAlertsToFirebase(alerts) {
  try {
    await setDoc(doc(db, 'settings', 'store_alerts'), { list: alerts, updated_at: new Date().toISOString() }, { merge: true })
  } catch {}
  setLocal('store_alerts', alerts)
  try {
    localStorage.setItem('chafe_store_alerts', JSON.stringify(alerts))
  } catch {}
  return alerts
}

export function subscribeToStoreAlerts(callback) {
  try {
    return onSnapshot(doc(db, 'settings', 'store_alerts'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (Array.isArray(data.list)) {
          setLocal('store_alerts', data.list)
          try {
            localStorage.setItem('chafe_store_alerts', JSON.stringify(data.list))
          } catch {}
          callback(data.list)
          return
        }
      }
      callback(getLocal('store_alerts', DEFAULT_STORE_ALERTS))
    }, () => {
      callback(getLocal('store_alerts', DEFAULT_STORE_ALERTS))
    })
  } catch {
    callback(getLocal('store_alerts', DEFAULT_STORE_ALERTS))
    return () => {}
  }
}

export const DEFAULT_ROLES = [
  'Head Barista',
  'Senior Latte Artist',
  'Barista',
  'Artisan Pastry Chef',
  'Front Counter & Cashier',
  'Shift Supervisor'
]

export async function getCustomRolesFromFirebase() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'roles'))
    if (snap.exists()) {
      const data = snap.data()
      if (Array.isArray(data.list) && data.list.length > 0) {
        setLocal('roles', data.list)
        return data.list
      }
    }
  } catch {}
  const local = getLocal('roles', null)
  if (local && Array.isArray(local) && local.length > 0) return local
  try {
    const raw = localStorage.getItem('chafe_custom_roles')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_ROLES
}

export async function saveCustomRolesToFirebase(roles) {
  try {
    await setDoc(doc(db, 'settings', 'roles'), { list: roles, updated_at: new Date().toISOString() }, { merge: true })
  } catch {}
  setLocal('roles', roles)
  try {
    localStorage.setItem('chafe_custom_roles', JSON.stringify(roles))
  } catch {}
  return roles
}

export const DEFAULT_LEAVE_TYPES = [
  { id: 'day_off', label: 'Regular Day Off', icon: '🌴', color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' },
  { id: 'annual_leave', label: 'Annual Leave / Vacation', icon: '🏖️', color: '#059669', bg: '#d1fae5', border: '#a7f3d0' },
  { id: 'sick_leave', label: 'Medical / Sick Leave', icon: '🏥', color: '#dc2626', bg: '#fee2e2', border: '#fecaca' },
  { id: 'personal', label: 'Personal Leave', icon: '📋', color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' },
  { id: 'holiday', label: 'Public Holiday Off', icon: '🌟', color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
]

export async function getLeaveTypesFromFirebase() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'leave_types'))
    if (snap.exists()) {
      const data = snap.data()
      if (Array.isArray(data.list) && data.list.length > 0) {
        setLocal('leave_types', data.list)
        return data.list
      }
    }
  } catch {}
  const local = getLocal('leave_types', null)
  if (local && Array.isArray(local) && local.length > 0) return local
  try {
    const raw = localStorage.getItem('chafe_leave_types')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_LEAVE_TYPES
}

export async function saveLeaveTypesToFirebase(leaveTypes) {
  try {
    await setDoc(doc(db, 'settings', 'leave_types'), { list: leaveTypes, updated_at: new Date().toISOString() }, { merge: true })
  } catch {}
  setLocal('leave_types', leaveTypes)
  try {
    localStorage.setItem('chafe_leave_types', JSON.stringify(leaveTypes))
  } catch {}
  return leaveTypes
}


