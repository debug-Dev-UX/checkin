import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'

const TELEGRAM_STORAGE_KEY = 'chafe_telegram_config'

export const DEFAULT_TELEGRAM_CONFIG = {
  enabled: false,
  bot_token: '',
  chat_id: '',
  notify_checkin: true,
  notify_checkout: true,
  notify_late: true,
  notify_leave: true,
  notify_messages: true,
  notify_broadcast: true,
  branch_filter: 'all', // 'all' or branch id
  bot_name: 'Chafé Alert Bot',
  custom_footer: '☕ Chafé Multi-Branch HR System',
  // Customizable Message Templates
  template_checkin: `🟢 <b>STAFF CLOCK-IN</b> (ចុះវត្តមានចូល)
───────────────────────
👤 <b>Staff:</b> {name}
💼 <b>Role:</b> {role}
🏢 <b>Branch:</b> {branch}
⏰ <b>Time:</b> {time} | {date}
📍 <b>Location:</b> {location}
📊 <b>Status:</b> {status}
───────────────────────
<i>{footer}</i>`,
  template_checkout: `🔴 <b>STAFF CLOCK-OUT</b> (ចុះវត្តមានចេញ)
───────────────────────
👤 <b>Staff:</b> {name}
💼 <b>Role:</b> {role}
🏢 <b>Branch:</b> {branch}
⏰ <b>Clock Out:</b> {time} | {date}
⏱ <b>Shift Duration:</b> {duration}
📋 <b>Status:</b> Shift finalized on cloud timesheet
───────────────────────
<i>{footer}</i>`,
  template_late: `🚨 <b>ATTENDANCE WARNING: LATE ARRIVAL</b>
───────────────────────
⚠️ <b>Staff Member:</b> {name}
🏢 <b>Branch:</b> {branch}
⏰ <b>Arrival Time:</b> {time}
⏳ <b>Tardiness:</b> Late by <b>{late_minutes} minutes</b>
💼 <b>Designated Shift:</b> {shift}
───────────────────────
<i>Immediate review recommended by Management</i>`,
  template_leave: `☀️ <b>STAFF LEAVE / DAY OFF SCHEDULED</b>
───────────────────────
👤 <b>Staff:</b> {name}
🏢 <b>Branch:</b> {branch}
📅 <b>Date:</b> {date}
🏷 <b>Leave Category:</b> {type}
📝 <b>Reason / Note:</b> {reason}
───────────────────────
<i>{footer}</i>`,
  template_custom: `📢 <b>{badge}</b>
───────────────────────
📌 <b>{title}</b>
⏰ <b>Time:</b> {time} ({date})
🏢 <b>Branch:</b> {branch}
📝 <b>Message:</b>
{message}
───────────────────────
<i>{footer}</i>`,
}

/**
 * Replace placeholders like {name}, {time}, {branch} in templates
 */
export function renderTemplate(template, vars = {}) {
  if (!template) return ''
  let text = template
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, v ?? '')
  }
  return text
}
export function getLocalTelegramConfig() {
  try {
    const raw = localStorage.getItem(TELEGRAM_STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_TELEGRAM_CONFIG, ...JSON.parse(raw) }
    }
  } catch { /* quiet */ }
  return { ...DEFAULT_TELEGRAM_CONFIG }
}

/**
 * Save Telegram Config to localStorage
 */
export function setLocalTelegramConfig(config) {
  try {
    localStorage.setItem(TELEGRAM_STORAGE_KEY, JSON.stringify(config))
  } catch { /* quiet */ }
}

/**
 * Get Telegram Config from Firestore (with localStorage fallback)
 */
export async function getTelegramConfig() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'telegram'))
    if (snap.exists()) {
      const data = { ...DEFAULT_TELEGRAM_CONFIG, ...snap.data() }
      setLocalTelegramConfig(data)
      return data
    }
  } catch (err) {
    console.warn('Could not read telegram config from Firestore:', err)
  }
  return getLocalTelegramConfig()
}

/**
 * Save Telegram Config to Firestore and localStorage
 */
export async function saveTelegramConfig(config) {
  const merged = { ...DEFAULT_TELEGRAM_CONFIG, ...config }
  setLocalTelegramConfig(merged)
  try {
    await setDoc(doc(db, 'settings', 'telegram'), merged, { merge: true })
  } catch (err) {
    console.warn('Could not save telegram config to Firestore:', err)
  }
  return merged
}

/**
 * Subscribe to real-time changes to Telegram Config in Firestore
 */
export function subscribeToTelegramConfig(callback) {
  callback(getLocalTelegramConfig())
  try {
    return onSnapshot(doc(db, 'settings', 'telegram'), (snap) => {
      if (snap.exists()) {
        const data = { ...DEFAULT_TELEGRAM_CONFIG, ...snap.data() }
        setLocalTelegramConfig(data)
        callback(data)
      }
    }, (err) => {
      console.warn('Telegram config snapshot error:', err)
      callback(getLocalTelegramConfig())
    })
  } catch {
    return () => {}
  }
}

/**
 * Core function to send an alert message to Telegram via the Telegram Bot HTTP API
 * @param {string} text - Message text formatted in HTML
 * @param {string} parseMode - 'HTML' or 'Markdown'
 * @param {object|null} overrideConfig - Optional override config (for testing before saving)
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function sendTelegramMessage(text, parseMode = 'HTML', overrideConfig = null) {
  const config = overrideConfig || getLocalTelegramConfig()
  
  if (!config.enabled && !overrideConfig) {
    return { success: false, error: 'Telegram alerts are disabled.' }
  }

  const token = (config.bot_token || '').trim()
  const chatId = (config.chat_id || '').trim()

  if (!token) {
    return { success: false, error: 'Telegram Bot Token is missing.' }
  }
  if (!chatId) {
    return { success: false, error: 'Telegram Chat ID is missing.' }
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    })

    const data = await res.json()
    if (data.ok) {
      return { success: true, message: 'Message sent successfully.' }
    } else {
      return { success: false, error: data.description || 'Failed to send Telegram message' }
    }
  } catch (err) {
    return { success: false, error: err.message || 'Network error reaching Telegram API' }
  }
}

/**
 * Test Connection by sending a rich test card to the Telegram target chat
 */
export async function sendTelegramTestNotification(config) {
  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const text = `🚀 <b>Chafé HR System • Telegram Connection Test</b>
───────────────────────
✅ <b>Status:</b> Telegram Bot Connected Successfully!
⏰ <b>Time:</b> ${time} (${date})
🏢 <b>System:</b> Chafé Multi-Branch Attendance & Operations
🤖 <b>Bot Name:</b> ${config.bot_name || 'Chafé Alert Bot'}

🔔 <b>Configured Alert Triggers:</b>
• Staff Clock-In: ${config.notify_checkin ? '✅ Active' : '❌ Disabled'}
• Staff Clock-Out: ${config.notify_checkout ? '✅ Active' : '❌ Disabled'}
• Late Arrival Alert: ${config.notify_late ? '✅ Active' : '❌ Disabled'}
• Leave / Day Off: ${config.notify_leave ? '✅ Active' : '❌ Disabled'}
• Staff Support Inquiries: ${config.notify_messages ? '✅ Active' : '❌ Disabled'}
• Store Announcements: ${config.notify_broadcast ? '✅ Active' : '❌ Disabled'}
• Branch Filter: <b>${config.branch_filter === 'all' ? 'All Branches (Floating)' : config.branch_filter}</b>
───────────────────────
<i>All designated staff check-in events will now be broadcast live to this channel.</i>`

  return await sendTelegramMessage(text, 'HTML', { ...config, enabled: true })
}

/**
 * Trigger: Staff Clock-In (Check-In)
 */
export async function notifyTelegramCheckin(record, branchName = 'Store') {
  const config = getLocalTelegramConfig()
  if (!config.enabled || !config.notify_checkin) return

  // Branch filter check
  if (config.branch_filter && config.branch_filter !== 'all') {
    if (record.branch_id && String(record.branch_id) !== String(config.branch_filter)) {
      return
    }
  }

  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const isLate = record.punctuality_status === 'late'
  const punctualityText = isLate
    ? `⚠️ <b>LATE ARRIVAL</b> (+${record.late_minutes || 0} min)`
    : '✅ <b>On-Time</b> (Good Standing)'

  const template = config.template_checkin || DEFAULT_TELEGRAM_CONFIG.template_checkin
  const text = renderTemplate(template, {
    name: record.name || 'Staff Member',
    role: record.department || record.role || 'Barista',
    branch: branchName || record.branch_name || record.location || 'Store',
    time,
    date,
    location: record.distance ? `${record.distance}m from store` : 'GPS Verified',
    status: punctualityText,
    footer: config.custom_footer || DEFAULT_TELEGRAM_CONFIG.custom_footer,
  })

  sendTelegramMessage(text).catch(() => {})

  // Also trigger dedicated late alert if configured and late
  if (isLate && config.notify_late) {
    notifyTelegramLate(record, branchName, record.late_minutes || 0)
  }
}

/**
 * Trigger: Staff Clock-Out (Check-Out)
 */
export async function notifyTelegramCheckout(record, branchName = 'Store', sessionDuration = '') {
  const config = getLocalTelegramConfig()
  if (!config.enabled || !config.notify_checkout) return

  if (config.branch_filter && config.branch_filter !== 'all') {
    if (record.branch_id && String(record.branch_id) !== String(config.branch_filter)) {
      return
    }
  }

  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const template = config.template_checkout || DEFAULT_TELEGRAM_CONFIG.template_checkout
  const text = renderTemplate(template, {
    name: record.name || 'Staff Member',
    role: record.department || record.role || 'Barista',
    branch: branchName || record.branch_name || record.location || 'Store',
    time,
    date,
    duration: sessionDuration || 'Logged',
    footer: config.custom_footer || DEFAULT_TELEGRAM_CONFIG.custom_footer,
  })

  sendTelegramMessage(text).catch(() => {})
}

/**
 * Trigger: Late Arrival Alert
 */
export async function notifyTelegramLate(record, branchName = 'Store', lateMinutes = 0) {
  const config = getLocalTelegramConfig()
  if (!config.enabled || !config.notify_late) return

  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const template = config.template_late || DEFAULT_TELEGRAM_CONFIG.template_late
  const text = renderTemplate(template, {
    name: record.name || 'Staff Member',
    branch: branchName || record.branch_name || 'Store',
    time,
    late_minutes: lateMinutes,
    shift: `${record.shift_start || '07:30'} - ${record.shift_end || '16:00'}`,
    footer: config.custom_footer || DEFAULT_TELEGRAM_CONFIG.custom_footer,
  })

  sendTelegramMessage(text).catch(() => {})
}

/**
 * Trigger: Leave / Day Off Request or Approval
 */
export async function notifyTelegramLeave(leaveData) {
  const config = getLocalTelegramConfig()
  if (!config.enabled || !config.notify_leave) return

  const typeFormatted = (leaveData.type || 'day_off').replace('_', ' ').toUpperCase()
  const template = config.template_leave || DEFAULT_TELEGRAM_CONFIG.template_leave
  const text = renderTemplate(template, {
    name: leaveData.staff_name || leaveData.name || 'Staff Member',
    branch: leaveData.branch_name || 'All Branches',
    date: leaveData.date || '',
    type: typeFormatted,
    reason: leaveData.reason || 'Rest & Recharge',
    footer: config.custom_footer || DEFAULT_TELEGRAM_CONFIG.custom_footer,
  })

  sendTelegramMessage(text).catch(() => {})
}

/**
 * Trigger: Staff Support Inquiry / Message to Admin
 */
export async function notifyTelegramStaffMessage(msgData) {
  const config = getLocalTelegramConfig()
  if (!config.enabled || !config.notify_messages) return

  const priorityBadge = msgData.priority === 'urgent' ? '🚨 URGENT' : '📩 NORMAL'
  const text = `💬 <b>STAFF MESSAGE TO MANAGEMENT</b>
───────────────────────
👤 <b>From:</b> ${msgData.staff_name} (${msgData.email || 'Staff'})
🏢 <b>Branch:</b> ${msgData.branch_name || 'Store'}
📌 <b>Subject:</b> ${msgData.subject || 'Inquiry'}
⚡ <b>Priority:</b> ${priorityBadge}
📝 <b>Message:</b>
<i>"${msgData.message}"</i>
───────────────────────
<i>Admin can reply directly from the Chafé Support Center</i>`

  sendTelegramMessage(text).catch(() => {})
}

/**
 * Trigger: Store Announcement Broadcast
 */
export async function notifyTelegramStoreAlert(alertData) {
  const config = getLocalTelegramConfig()
  if (!config.enabled || !config.notify_broadcast) return

  const priorityBadge = alertData.priority === 'high' ? '🚨 HIGH PRIORITY' : '📢 NOTICE'
  const text = `📢 <b>NEW STORE ANNOUNCEMENT PUBLISHED</b>
───────────────────────
📌 <b>Title:</b> ${alertData.title}
⚡ <b>Priority:</b> ${priorityBadge}
📝 <b>Announcement Details:</b>
${alertData.message}
───────────────────────
☕ <i>Broadcast live to staff portals across all branches</i>`

  sendTelegramMessage(text).catch(() => {})
}

/**
 * Trigger: Admin Custom Message Alert Broadcast
 */
export async function notifyTelegramCustomAlert(customData, overrideConfig = null) {
  const config = overrideConfig || getLocalTelegramConfig()
  if (!config.enabled && !overrideConfig) {
    return { success: false, error: 'Telegram alerts are disabled.' }
  }

  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const priorityBadge = customData.priority === 'urgent' ? '🚨 URGENT NOTICE' : '📢 MANAGEMENT BROADCAST'
  const template = config.template_custom || DEFAULT_TELEGRAM_CONFIG.template_custom

  const text = renderTemplate(template, {
    badge: priorityBadge,
    title: customData.title || 'Management Notice',
    time,
    date,
    branch: customData.branch_name || 'All Branches',
    message: customData.message || '',
    footer: config.custom_footer || DEFAULT_TELEGRAM_CONFIG.custom_footer,
  })

  return await sendTelegramMessage(text, 'HTML', overrideConfig)
}
