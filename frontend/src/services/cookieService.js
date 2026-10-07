/**
 * Cookie and Permission Management Service for Chafé
 * Handles account-specific cookie persistence for:
 * 1. Automatic Camera and Location permissions on site visit
 * 2. Store Alerts & Notices read / deleted state per staff account
 */

export function setCookie(name, value, days = 365) {
  if (typeof document === 'undefined') return
  const maxAge = days * 24 * 60 * 60
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

export function getCookie(name) {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split(';')
  for (let cookie of cookies) {
    const parts = cookie.trim().split('=')
    if (decodeURIComponent(parts[0]) === name) {
      try {
        return decodeURIComponent(parts.slice(1).join('='))
      } catch {
        return parts.slice(1).join('=')
      }
    }
  }
  return null
}

export function deleteCookie(name) {
  if (typeof document === 'undefined') return
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`
}

/**
 * Get account permissions for camera and location
 */
export function getAccountPermissions(userId = 'guest') {
  const safeId = String(userId || 'guest')
  const cookieCam = getCookie(`chafe_perm_camera_${safeId}`) || getCookie('chafe_allow_camera')
  const cookieLoc = getCookie(`chafe_perm_location_${safeId}`) || getCookie('chafe_allow_location')
  const cookieDontAsk = getCookie(`chafe_dont_ask_${safeId}`) || getCookie('chafe_dont_ask_permissions')

  let localCam = null
  let localLoc = null
  let localDontAsk = null
  try {
    localCam = localStorage.getItem(`chafe_perm_camera_${safeId}`)
    localLoc = localStorage.getItem(`chafe_perm_location_${safeId}`)
    localDontAsk = localStorage.getItem(`chafe_dont_ask_${safeId}`)
  } catch {}

  const allowCamera = cookieCam === 'allowed' || localCam === 'true'
  const allowLocation = cookieLoc === 'allowed' || localLoc === 'true'
  const dontAskAgain = cookieDontAsk === 'true' || localDontAsk === 'true' || (allowCamera && allowLocation)

  return {
    camera: allowCamera,
    location: allowLocation,
    dontAskAgain: dontAskAgain,
    userId: safeId,
    cookieActive: !!(cookieCam || cookieLoc || cookieDontAsk),
  }
}

/**
 * Save account permissions to cookies (1-year expiration) & localStorage
 */
export function saveAccountPermissions(userId = 'guest', { camera, location, dontAskAgain = true }) {
  const safeId = String(userId || 'guest')

  if (camera) {
    setCookie(`chafe_perm_camera_${safeId}`, 'allowed', 365)
    setCookie('chafe_allow_camera', 'allowed', 365)
    try { localStorage.setItem(`chafe_perm_camera_${safeId}`, 'true') } catch {}
  } else {
    deleteCookie(`chafe_perm_camera_${safeId}`)
    deleteCookie('chafe_allow_camera')
    try { localStorage.removeItem(`chafe_perm_camera_${safeId}`) } catch {}
  }

  if (location) {
    setCookie(`chafe_perm_location_${safeId}`, 'allowed', 365)
    setCookie('chafe_allow_location', 'allowed', 365)
    try { localStorage.setItem(`chafe_perm_location_${safeId}`, 'true') } catch {}
  } else {
    deleteCookie(`chafe_perm_location_${safeId}`)
    deleteCookie('chafe_allow_location')
    try { localStorage.removeItem(`chafe_perm_location_${safeId}`) } catch {}
  }

  if (dontAskAgain) {
    setCookie(`chafe_dont_ask_${safeId}`, 'true', 365)
    setCookie('chafe_dont_ask_permissions', 'true', 365)
    try { localStorage.setItem(`chafe_dont_ask_${safeId}`, 'true') } catch {}
  } else {
    deleteCookie(`chafe_dont_ask_${safeId}`)
    deleteCookie('chafe_dont_ask_permissions')
    try { localStorage.removeItem(`chafe_dont_ask_${safeId}`) } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chafe_permissions_updated', {
      detail: { userId: safeId, camera: !!camera, location: !!location, dontAskAgain: !!dontAskAgain }
    }))
  }

  return { camera: !!camera, location: !!location, dontAskAgain: !!dontAskAgain }
}

/**
 * Get dismissed alert IDs for this account
 */
export function getDismissedAlertIds(userId = 'guest') {
  const safeId = String(userId || 'guest')
  const cookieVal = getCookie(`chafe_dismissed_alerts_${safeId}`)
  if (cookieVal) {
    try {
      const parsed = JSON.parse(cookieVal)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  try {
    const local = localStorage.getItem(`chafe_dismissed_alerts_${safeId}`)
    if (local) {
      const parsed = JSON.parse(local)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

/**
 * Dismiss / delete single alert for account
 */
export function dismissAlertForAccount(userId = 'guest', alertId) {
  if (!alertId) return []
  const safeId = String(userId || 'guest')
  const current = getDismissedAlertIds(safeId)
  if (!current.includes(alertId)) {
    const updated = [...current, alertId]
    setCookie(`chafe_dismissed_alerts_${safeId}`, JSON.stringify(updated), 365)
    try {
      localStorage.setItem(`chafe_dismissed_alerts_${safeId}`, JSON.stringify(updated))
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chafe_alerts_dismissed_updated', {
        detail: { userId: safeId, dismissedIds: updated }
      }))
    }
    return updated
  }
  return current
}

/**
 * Dismiss all alerts for account
 */
export function dismissAllAlertsForAccount(userId = 'guest', alertIds = []) {
  const safeId = String(userId || 'guest')
  const current = getDismissedAlertIds(safeId)
  const set = new Set([...current, ...alertIds])
  const updated = Array.from(set)
  setCookie(`chafe_dismissed_alerts_${safeId}`, JSON.stringify(updated), 365)
  try {
    localStorage.setItem(`chafe_dismissed_alerts_${safeId}`, JSON.stringify(updated))
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chafe_alerts_dismissed_updated', {
      detail: { userId: safeId, dismissedIds: updated }
    }))
  }
  return updated
}

/**
 * Reset dismissed alerts for account so they appear again
 */
export function resetDismissedAlertsForAccount(userId = 'guest') {
  const safeId = String(userId || 'guest')
  deleteCookie(`chafe_dismissed_alerts_${safeId}`)
  try {
    localStorage.removeItem(`chafe_dismissed_alerts_${safeId}`)
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chafe_alerts_dismissed_updated', {
      detail: { userId: safeId, dismissedIds: [] }
    }))
  }
  return []
}
