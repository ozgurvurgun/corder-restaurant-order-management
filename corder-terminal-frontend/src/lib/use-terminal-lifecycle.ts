import { useEffect, type MutableRefObject } from "react"
import { acquireTerminalCoords, api, getRestaurant, getStaffSession, getToken, type MenuCategoryTree } from "./api"
import { computeClientHaversineMeters } from "./terminal-geofence"
import type { TerminalOrderItem, TerminalStaffMember, TerminalUser } from "./types"
import type { ActiveWaiterCall } from "./terminal-notifications"
import { useTerminalApiSync } from "./use-terminal-api-sync"

export const CARTS_STORAGE_KEY = "terminal_carts_v1"
export const LOCKED_TABLE_STORAGE_KEY = "terminal_locked_table_id"
const MENU_CACHE_KEY_PREFIX = "terminal_menu_cache_v1"
const LOCK_HEARTBEAT_MS = 45_000 // Refresh 120s server lock every 45s while active

export function loadStoredMenuCache(restaurantId?: string | null): MenuCategoryTree[] | null {
  if (typeof window === "undefined") return null
  const id = (restaurantId || getRestaurant()?.id || "").trim()
  if (!id) return null
  try {
    const raw = localStorage.getItem(`${MENU_CACHE_KEY_PREFIX}:${id}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as MenuCategoryTree[]) : null
  } catch {
    return null
  }
}

export function saveStoredMenuCache(
  categories: MenuCategoryTree[],
  restaurantId?: string | null
): void {
  if (typeof window === "undefined" || !Array.isArray(categories) || categories.length === 0) return
  const id = (restaurantId || getRestaurant()?.id || "").trim()
  if (!id) return
  try {
    localStorage.setItem(`${MENU_CACHE_KEY_PREFIX}:${id}`, JSON.stringify(categories))
  } catch {
    // Ignore storage quota errors
  }
}

export function loadStoredCarts(): Record<string, TerminalOrderItem[]> {
  if (typeof window === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(CARTS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, TerminalOrderItem[]>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function saveStoredCarts(carts: Record<string, TerminalOrderItem[]>) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(CARTS_STORAGE_KEY, JSON.stringify(carts))
  } catch {
    // Ignore storage quota errors
  }
}

export function useTerminalLifecycle(params: {
  isLoggedIn: boolean
  currentUser: TerminalUser | null
  users?: TerminalStaffMember[]
  usersLoaded?: boolean
  selectedTableId: string | null
  lockedTableIdRef: MutableRefObject<string | null>
  lastActivityRef: MutableRefObject<number>
  setIsOffline: (offline: boolean) => void
  refreshData: () => Promise<void>
  refreshLiveState: () => Promise<void>
  pullTables: () => Promise<void>
  logout: () => void
  onWaiterCalled?: (call: ActiveWaiterCall) => void
  onNotificationsUpdated?: () => Promise<void> | void
}) {
  const {
    isLoggedIn,
    currentUser,
    users = [],
    usersLoaded = false,
    selectedTableId,
    lockedTableIdRef,
    setIsOffline,
    refreshData,
    refreshLiveState,
    pullTables,
    logout,
    onWaiterCalled,
    onNotificationsUpdated,
  } = params

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      if (isLoggedIn) void refreshData()
    }
    const handleOffline = () => setIsOffline(true)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [isLoggedIn, refreshData, setIsOffline])

  useEffect(() => {
    if (!isLoggedIn) return
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshLiveState()
    }
    document.addEventListener("visibilitychange", onVisible)
    const intervalId = window.setInterval(onVisible, 30_000)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(intervalId)
    }
  }, [isLoggedIn, refreshLiveState])

  useTerminalApiSync({
    isLoggedIn,
    setIsOffline,
    refreshData,
    refreshLiveState,
    pullTables,
    onWaiterCalled,
    onNotificationsUpdated,
  })

  // Keep server lock alive while waiter is working on a table & release on tab close
  useEffect(() => {
    if (!isLoggedIn || !currentUser || !selectedTableId) return
    const heartbeat = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return
      const token = getToken()
      const lockedId = lockedTableIdRef.current
      if (!token || !lockedId) return
      void api.tables.sessionLock(token, lockedId).catch(() => undefined)
    }
    const intervalId = window.setInterval(heartbeat, LOCK_HEARTBEAT_MS)
    const onPageHide = () => {
      const token = getToken()
      const lockedId = lockedTableIdRef.current
      if (token && lockedId) {
        api.tables.unlockKeepalive(token, lockedId)
      }
    }
    window.addEventListener("pagehide", onPageHide)
    window.addEventListener("beforeunload", onPageHide)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("pagehide", onPageHide)
      window.removeEventListener("beforeunload", onPageHide)
    }
  }, [isLoggedIn, currentUser, selectedTableId, lockedTableIdRef])

  // Shift cutoff & Geofence live watchdog (replaces blind 5-minute idle lock)
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return

    const activeMember = users.find((u) => u.id === currentUser.id)
    if (usersLoaded && !activeMember) {
      try {
        sessionStorage.setItem(
          "terminal_staff_kick_notice",
          "Terminal erişim yetkiniz yönetici tarafından kapatıldığı için oturumunuz anında sonlandırıldı."
        )
      } catch {}
      logout()
      return
    }
    if (activeMember && activeMember.isWithinShift === false) {
      try {
        sessionStorage.setItem(
          "terminal_staff_kick_notice",
          activeMember.shiftBlockReason ||
            "Mesai erişim süreniz sona erdiği için oturumunuz otomatik olarak kapatıldı."
        )
      } catch {}
      logout()
      return
    }

    const checkSessionAndShift = () => {
      if (!getStaffSession()) {
        try {
          sessionStorage.setItem(
            "terminal_staff_kick_notice",
            "Mesai erişim süreniz sona erdiği için oturumunuz otomatik olarak kapatıldı."
          )
        } catch {}
        logout()
      }
    }

    const sample = activeMember ?? users[0]
    const geoEnabled = Boolean(
      sample?.terminalLocationRestrictionEnabled &&
        sample.locationLatitude != null &&
        sample.locationLongitude != null
    )

    const checkGeofence = async () => {
      if (
        !geoEnabled ||
        !sample ||
        sample.locationLatitude == null ||
        sample.locationLongitude == null ||
        (typeof document !== "undefined" && document.visibilityState !== "visible")
      ) {
        return
      }
      const coords = await acquireTerminalCoords(false)
      if (coords.latitude == null || coords.longitude == null) {
        try {
          sessionStorage.setItem(
            "terminal_staff_kick_notice",
            "Bu işletmede konum doğrulaması zorunludur. Konum (GPS) izni kapalı olduğu için oturumunuz kapatıldı."
          )
        } catch {}
        logout()
        return
      }
      const allowedRadius = Math.max(20, Number(sample.locationRadiusMeters || 150))
      const dist = computeClientHaversineMeters(
        Number(sample.locationLatitude),
        Number(sample.locationLongitude),
        coords.latitude,
        coords.longitude
      )
      if (dist > allowedRadius) {
        try {
          sessionStorage.setItem(
            "terminal_staff_kick_notice",
            `Restoran konumundan uzaklaştığınız için terminal oturumunuz kapatıldı (Mesafeniz: ${dist} m, İzin verilen: ${allowedRadius} m).`
          )
        } catch {}
        logout()
      }
    }

    if (geoEnabled) void checkGeofence()
    const shiftTimerId = window.setInterval(checkSessionAndShift, 4_000)
    const geoTimerId = geoEnabled
      ? window.setInterval(() => void checkGeofence(), 25_000)
      : null
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        checkSessionAndShift()
        if (geoEnabled) void checkGeofence()
      }
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      window.clearInterval(shiftTimerId)
      if (geoTimerId !== null) window.clearInterval(geoTimerId)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [isLoggedIn, currentUser, users, usersLoaded, logout])
}
