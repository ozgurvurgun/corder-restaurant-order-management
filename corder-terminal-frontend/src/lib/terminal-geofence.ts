let cachedTerminalCoords: {
  latitude: number
  longitude: number
  fetchedAt: number
} | null = null

export function getCachedTerminalCoords(): { latitude: number; longitude: number } | null {
  return cachedTerminalCoords
    ? { latitude: cachedTerminalCoords.latitude, longitude: cachedTerminalCoords.longitude }
    : null
}

export async function acquireTerminalCoords(forceFresh = false): Promise<{
  latitude: number | null
  longitude: number | null
}> {
  if (
    !forceFresh &&
    cachedTerminalCoords &&
    Date.now() - cachedTerminalCoords.fetchedAt < 30_000
  ) {
    return {
      latitude: cachedTerminalCoords.latitude,
      longitude: cachedTerminalCoords.longitude,
    }
  }
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return { latitude: null, longitude: null }
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedTerminalCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          fetchedAt: Date.now(),
        }
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
      },
      () => {
        resolve({ latitude: null, longitude: null })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: forceFresh ? 0 : 20000 }
    )
  })
}

export function computeClientHaversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}
