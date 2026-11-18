import { useEffect, type MutableRefObject } from "react"
import { api, getStaffSession, getToken } from "./api"
import type { TerminalOrderItem, TerminalUser } from "./types"
import type { ActiveWaiterCall } from "./terminal-notifications"
import { useTerminalApiSync } from "./use-terminal-api-sync"

export const CARTS_STORAGE_KEY = "terminal_carts_v1"
export const LOCKED_TABLE_STORAGE_KEY = "terminal_locked_table_id"
// Shared POS tablets sit idle while waiters talk to guests / use merchant on another device.
// 90s was kicking staff back to PIN select during normal floor work.
const STAFF_IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes inactivity auto-lock
const LOCK_HEARTBEAT_MS = 45_000 // Refresh 120s server lock every 45s while active

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
  selectedTableId: string | null
  lockedTableIdRef: MutableRefObject<string | null>
  lastActivityRef: MutableRefObject<number>
  setIsOffline: (offline: boolean) => void
  refreshData: () => Promise<void>
  refreshLiveState: () => Promise<void>
  pullTables: () => Promise<void>
  logout: () => void
  onWaiterCalled?: (call: ActiveWaiterCall) => void
}) {
  const {
    isLoggedIn,
    currentUser,
    selectedTableId,
    lockedTableIdRef,
    lastActivityRef,
    setIsOffline,
    refreshData,
    refreshLiveState,
    pullTables,
    logout,
    onWaiterCalled,
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

  // Auto-lock staff session after 90s of inactivity or when staff session expires
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return
    lastActivityRef.current = Date.now()
    const markActivity = () => {
      lastActivityRef.current = Date.now()
    }
    window.addEventListener("pointerdown", markActivity, { passive: true })
    window.addEventListener("keydown", markActivity, { passive: true })
    window.addEventListener("touchstart", markActivity, { passive: true })
    window.addEventListener("scroll", markActivity, { passive: true, capture: true })
    const timerId = window.setInterval(() => {
      if (!getStaffSession() || Date.now() - lastActivityRef.current >= STAFF_IDLE_TIMEOUT_MS) {
        logout()
      }
    }, 10_000)
    return () => {
      window.removeEventListener("pointerdown", markActivity)
      window.removeEventListener("keydown", markActivity)
      window.removeEventListener("touchstart", markActivity)
      window.removeEventListener("scroll", markActivity, true)
      window.clearInterval(timerId)
    }
  }, [isLoggedIn, currentUser, logout, lastActivityRef])
}
