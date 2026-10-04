/**
 * Multi-Branch (សាខា) Geolocation Validation Service for Chafé
 * Supports multiple café branches with custom GPS coordinates and admin-chosen scan radius.
 */

// Default Store Branches (សាខា)
export const DEFAULT_BRANCHES = [
  {
    id: 'branch_2',
    code: 'KK',
    name: 'Chafé • Kohke',
    address: 'Siem Reap, Cambodia',
    lat: 13.3632967,
    lng: 103.8623305,
    radiusMeters: 50,
    isActive: true,
  },
  {
    id: 'branch_1791018243906',
    code: 'WB',
    name: 'Chafé • Watbo',
    address: 'Siem Reap, Cambodia',
    lat: 13.3545705,
    lng: 103.8589937,
    radiusMeters: 50,
    isActive: true,
  },
  {
    id: 'branch_1791018323584',
    code: 'HT',
    name: 'Hotel',
    address: 'Siem Reap, Cambodia',
    lat: 13.351881,
    lng: 103.853068,
    radiusMeters: 50,
    isActive: true,
  },
]

export const DEFAULT_STORE_LOCATION = DEFAULT_BRANCHES[0]

const BRANCHES_STORAGE_KEY = 'chafe_branches_config'

/**
 * Get all configured branches from localStorage / defaults
 */
export function getBranches() {
  try {
    const saved = localStorage.getItem(BRANCHES_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {
    // quiet catch
  }
  try {
    const live = localStorage.getItem('chafe_live_branches')
    if (live) {
      const parsed = JSON.parse(live)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {}
  return DEFAULT_BRANCHES
}

/**
 * Save and persist branches configuration
 */
export function saveBranches(branches) {
  try {
    localStorage.setItem(BRANCHES_STORAGE_KEY, JSON.stringify(branches))
    localStorage.setItem('chafe_live_branches', JSON.stringify(branches))
  } catch {
    // quiet catch
  }
  return branches
}

/**
 * Get branch by ID or fallback
 */
export function getBranchById(id) {
  const branches = getBranches()
  if (!id) return branches[0] || DEFAULT_BRANCHES[0]
  return (
    branches.find(b => b.id === id) ||
    // Legacy mapping: branch_1 maps to first branch (Kohke)
    (id === 'branch_1' ? branches[0] : null) ||
    branches.find(b => b.code?.toLowerCase() === id.toLowerCase()) ||
    branches.find(b => b.name?.toLowerCase().includes(id.toLowerCase())) ||
    branches[0] ||
    DEFAULT_BRANCHES[0]
  )
}

/**
 * Backward compatibility: Get single primary store location
 */
export function getStoreLocation() {
  const branches = getBranches()
  return branches[0] || DEFAULT_STORE_LOCATION
}

/**
 * Backward compatibility: Set primary store location
 */
export function setStoreLocation(location) {
  const branches = getBranches()
  const updated = branches.map((b, i) => {
    if (i === 0 || b.id === location.id) {
      return {
        ...b,
        name: location.name || b.name,
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng),
        radiusMeters: parseInt(location.radiusMeters || b.radiusMeters || 50, 10),
      }
    }
    return b
  })
  saveBranches(updated)
  return updated[0]
}

/**
 * Calculate distance in meters between two GPS coordinates using Haversine formula
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c)
}

/**
 * Verify real-time GPS location of staff before check-in or check-out
 * Validates against the staff member's assigned branch (សាខា), or closest branch if floating
 */
export function verifyRealtimeLocationForStaff(staffUser = null, customBranches = null) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 'NOT_SUPPORTED',
        message: 'Geolocation is not supported by your browser or device.',
      })
      return
    }

    const branches = customBranches || getBranches()
    const activeBranches = branches.filter(b => b.isActive !== false)

    if (activeBranches.length === 0) {
      resolve({ allowed: true, branch: DEFAULT_BRANCHES[0], distance: 0 })
      return
    }

    // Determine target branch
    let targetBranch = null
    const assignedBranchId = staffUser?.branch_id
    const assignedBranchName = staffUser?.branch_name

    if (assignedBranchId && assignedBranchId !== 'all') {
      targetBranch =
        activeBranches.find(b => b.id === assignedBranchId) ||
        (assignedBranchName && assignedBranchName !== 'All Branches (Floating)'
          ? activeBranches.find(b => b.name?.toLowerCase() === assignedBranchName.toLowerCase() || b.name?.includes(assignedBranchName) || assignedBranchName?.includes(b.name))
          : null) ||
        (assignedBranchId === 'branch_1' ? activeBranches[0] : null)
    } else if (assignedBranchName && assignedBranchName !== 'All Branches (Floating)') {
      targetBranch = activeBranches.find(
        b => b.name?.toLowerCase() === assignedBranchName.toLowerCase() || b.name?.includes(assignedBranchName) || assignedBranchName?.includes(b.name)
      )
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude
        const userLng = pos.coords.longitude
        const accuracy = Math.round(pos.coords.accuracy || 0)

        // 1. If assigned to a specific branch: strictly validate against that branch
        if (targetBranch) {
          const distance = calculateDistanceMeters(userLat, userLng, targetBranch.lat, targetBranch.lng)
          const allowedRadius = targetBranch.radiusMeters || 50

          if (distance <= allowedRadius) {
            resolve({
              allowed: true,
              branch: targetBranch,
              distance,
              accuracy,
              allowedRadius,
              coords: { lat: userLat, lng: userLng },
            })
            return
          } else {
            // Also check if they happen to be at another active branch
            const otherBranch = activeBranches.find(b => {
              if (b.id === targetBranch.id) return false
              const dist = calculateDistanceMeters(userLat, userLng, b.lat, b.lng)
              return dist <= (b.radiusMeters || 50)
            })

            let extraMsg = ''
            if (otherBranch) {
              extraMsg = ` (Note: You are currently within ${otherBranch.name}'s radius. If you are stationed at ${otherBranch.name} today, please ask management to update your assigned branch.)`
            }

            reject({
              code: 'FAR_FROM_STORE',
              branch: targetBranch,
              distance,
              allowedRadius,
              coords: { lat: userLat, lng: userLng },
              message: `You are too far from ${targetBranch.name}! You are ${distance}m away. The allowed scan radius is ${allowedRadius}m.${extraMsg}`,
            })
            return
          }
        }

        // 2. If staff is assigned to 'all' or no specific branch: check against all active branches
        const results = activeBranches.map(b => {
          const dist = calculateDistanceMeters(userLat, userLng, b.lat, b.lng)
          const rad = b.radiusMeters || 50
          return {
            branch: b,
            distance: dist,
            allowedRadius: rad,
            isWithin: dist <= rad,
          }
        })

        // Find if within any branch
        const matched = results.find(r => r.isWithin)
        if (matched) {
          resolve({
            allowed: true,
            branch: matched.branch,
            distance: matched.distance,
            accuracy,
            allowedRadius: matched.allowedRadius,
            coords: { lat: userLat, lng: userLng },
          })
          return
        }

        // If not within any branch, report nearest branch
        results.sort((a, b) => a.distance - b.distance)
        const nearest = results[0]
        reject({
          code: 'FAR_FROM_STORE',
          branch: nearest.branch,
          distance: nearest.distance,
          allowedRadius: nearest.allowedRadius,
          coords: { lat: userLat, lng: userLng },
          message: `Too far from store! Nearest branch is ${nearest.branch.name} (${nearest.distance}m away). Admin-configured allowed scan radius is ${nearest.allowedRadius}m.`,
        })
      },
      (err) => {
        let msg = 'Location permission is required to check in or check out. Please allow location access on your phone/browser.'
        if (err.code === 1) {
          msg = 'Location permission was denied. You must allow GPS location access to verify you are at the store before scanning.'
        } else if (err.code === 2) {
          msg = 'Unable to determine your GPS location. Please make sure Location/GPS is turned on in your device settings.'
        } else if (err.code === 3) {
          msg = 'GPS location request timed out. Please try again.'
        }
        reject({
          code: 'PERMISSION_DENIED',
          message: msg,
          rawError: err,
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}

/**
 * Backward compatibility: verifyRealtimeLocation
 */
export function verifyRealtimeLocation(customStore = null) {
  if (customStore) {
    return verifyRealtimeLocationForStaff(null, [customStore])
  }
  return verifyRealtimeLocationForStaff(null)
}
