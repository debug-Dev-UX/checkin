/**
/**
 * Real-Time Geolocation Validation Service for Chafé Check-In / Check-Out
 */

// Default store location: Phnom Penh center or stored config
export const DEFAULT_STORE_LOCATION = {
  name: 'Chafé Specialty Coffee • Store #01',
  lat: 11.5564,
  lng: 104.9282,
  radiusMeters: 300, // 300 meters allowed radius
}

/**
 * Get current configured store location
 */
export function getStoreLocation() {
  try {
    const saved = localStorage.getItem('chafe_store_location')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.lat && parsed.lng) {
        return {
          ...DEFAULT_STORE_LOCATION,
          ...parsed,
        }
      }
    }
  } catch {
    // quiet catch
  }
  return DEFAULT_STORE_LOCATION
}

/**
 * Set and persist store location coordinates
 */
export function setStoreLocation(location) {
  try {
    const data = {
      name: location.name || DEFAULT_STORE_LOCATION.name,
      lat: parseFloat(location.lat),
      lng: parseFloat(location.lng),
      radiusMeters: parseInt(location.radiusMeters || 300, 10),
    }
    localStorage.setItem('chafe_store_location', JSON.stringify(data))
    return data
  } catch {
    return DEFAULT_STORE_LOCATION
  }
}

/**
 * Calculate distance in meters between two GPS coordinates using the Haversine formula
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // Radius of Earth in meters
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
 * Verify real-time GPS location of user before check-in or check-out
 * Resolves if user is within the store radius, rejects with specific reasons if not.
 */
export function verifyRealtimeLocation(customStore = null) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 'NOT_SUPPORTED',
        message: 'Geolocation is not supported by your browser or device.',
      })
      return
    }

    const store = customStore || getStoreLocation()

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude
        const userLng = pos.coords.longitude
        const accuracy = Math.round(pos.coords.accuracy || 0)
        const distance = calculateDistanceMeters(userLat, userLng, store.lat, store.lng)

        if (distance <= store.radiusMeters) {
          resolve({
            allowed: true,
            distance,
            accuracy,
            allowedRadius: store.radiusMeters,
            coords: { lat: userLat, lng: userLng },
            store,
          })
        } else {
          reject({
            code: 'FAR_FROM_STORE',
            distance,
            allowedRadius: store.radiusMeters,
            coords: { lat: userLat, lng: userLng },
            message: `Too far from store! You are ${distance}m away. Attendance can only be recorded within ${store.radiusMeters}m of the store.`,
            store,
          })
        }
      },
      (err) => {
        let msg = 'Location permission is required to check in or check out. Please allow location access.'
        if (err.code === 1) {
          msg = 'Location permission was denied. You must allow location access to verify attendance at the store.'
        } else if (err.code === 2) {
          msg = 'Unable to determine your GPS location. Please turn on location services on your device.'
        } else if (err.code === 3) {
          msg = 'Location request timed out. Please try again.'
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
