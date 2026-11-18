import { useCallback, useEffect, type MutableRefObject } from "react"
import type {
  TerminalScreen,
  TerminalStaffMember,
  TerminalTable,
  TerminalUser,
} from "./types"
import {
  api,
  clearStaffSession,
  clearToken,
  getStaffSession,
  getToken,
  setAuthExpiredHandler,
  setRestaurant,
  setStaffExpiredHandler,
  setStaffSession,
  setToken,
  type RawTableDto,
  type OrderDto,
  type StaffSession,
} from "./api"
import { formatTitleCase, translateApiError } from "./format"
import { LOCKED_TABLE_STORAGE_KEY } from "./use-terminal-lifecycle"

export function mapSessionToTerminalUser(
  s: Omit<StaffSession, "expiresAt" | "staffToken"> | null
): TerminalUser | null {
  if (!s) return null
  return {
    id: s.staffId,
    name: formatTitleCase(s.name),
    role: s.role,
    roleLabel: s.roleLabel,
    permissions: Array.isArray(s.permissions) ? s.permissions : [],
    limits: s.limits,
  }
}

export function useTerminalSessionActions(params: {
  currentUserRef: MutableRefObject<TerminalUser | null>
  lockedTableIdRef: MutableRefObject<string | null>
  pendingUnlockTableIdRef: MutableRefObject<string | null>
  lastActivityRef: MutableRefObject<number>
  setCurrentUser: (u: TerminalUser | null) => void
  setUsers: (u: TerminalStaffMember[]) => void
  setIsLoggedIn: (v: boolean) => void
  setRestaurantState: (r: { id: string; name: string; slug: string } | null) => void
  setActiveScreen: (s: TerminalScreen) => void
  setSelectedTableId: (id: string | null) => void
  setRawTables: (t: RawTableDto[]) => void
  setRawOrders: (o: OrderDto[]) => void
  setError: (e: string | null) => void
  resetAllCarts: () => void
  refreshData: () => Promise<void>
  pullTables: () => Promise<void>
}) {
  const {
    currentUserRef,
    lockedTableIdRef,
    pendingUnlockTableIdRef,
    lastActivityRef,
    setCurrentUser,
    setUsers,
    setIsLoggedIn,
    setRestaurantState,
    setActiveScreen,
    setSelectedTableId,
    setRawTables,
    setRawOrders,
    setError,
    resetAllCarts,
    refreshData,
    pullTables,
  } = params

  const releaseTableSession = useCallback(() => {
    const tableId = lockedTableIdRef.current ?? pendingUnlockTableIdRef.current
    const user = currentUserRef.current
    const token = getToken()
    lockedTableIdRef.current = null
    sessionStorage.removeItem(LOCKED_TABLE_STORAGE_KEY)
    setSelectedTableId(null)
    if (!tableId || !user || !token) return
    void api.tables
      .sessionUnlock(token, tableId)
      .then(() => {
        pendingUnlockTableIdRef.current = null
        void pullTables()
      })
      .catch(() => undefined)
  }, [currentUserRef, lockedTableIdRef, pendingUnlockTableIdRef, pullTables, setSelectedTableId])

  const logout = useCallback(() => {
    releaseTableSession()
    clearStaffSession()
    setCurrentUser(null)
    resetAllCarts()
    setError(null)
    setActiveScreen("tables")
  }, [releaseTableSession, resetAllCarts, setActiveScreen, setCurrentUser, setError])

  const logoutRestaurant = useCallback(() => {
    releaseTableSession()
    clearToken()
    clearStaffSession()
    resetAllCarts()
    setIsLoggedIn(false)
    setRestaurantState(null)
    setCurrentUser(null)
    setUsers([])
    setActiveScreen("tables")
    setRawTables([])
    setRawOrders([])
    setError(null)
  }, [
    releaseTableSession,
    resetAllCarts,
    setActiveScreen,
    setCurrentUser,
    setError,
    setIsLoggedIn,
    setRawOrders,
    setRawTables,
    setRestaurantState,
    setUsers,
  ])

  useEffect(() => {
    setAuthExpiredHandler(logoutRestaurant)
    setStaffExpiredHandler(() => {
      clearStaffSession()
      setCurrentUser(null)
      setSelectedTableId(null)
      setActiveScreen("tables")
      lockedTableIdRef.current = null
      pendingUnlockTableIdRef.current = null
      sessionStorage.removeItem(LOCKED_TABLE_STORAGE_KEY)
    })
    return () => {
      setAuthExpiredHandler(null)
      setStaffExpiredHandler(null)
    }
  }, [
    lockedTableIdRef,
    logoutRestaurant,
    pendingUnlockTableIdRef,
    setActiveScreen,
    setCurrentUser,
    setSelectedTableId,
  ])

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null)
      try {
        const res = await api.restaurant.login(email, password)
        clearStaffSession()
        setCurrentUser(null)
        setToken(res.accessToken)
        setRestaurant(res.restaurant)
        setRestaurantState(res.restaurant)
        setIsLoggedIn(true)
        await refreshData()
        return true
      } catch (err) {
        setError(translateApiError(err, "Giriş başarısız"))
        return false
      }
    },
    [refreshData, setCurrentUser, setError, setIsLoggedIn, setRestaurantState]
  )

  const loginWithPin = useCallback(
    async (
      pin: string,
      staffId?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const token = getToken()
      if (!token) return { ok: false, error: "Restoran oturumu gerekli" }
      try {
        const res = await api.staff.verifyPin(token, pin, staffId)
        const session = {
          staffId: res.staffId,
          name: res.name,
          role: res.role,
          roleLabel: res.roleLabel,
          permissions: res.permissions,
          limits: res.limits,
          staffToken: res.staffToken,
        }
        setStaffSession(session)
        lastActivityRef.current = Date.now()
        setCurrentUser(mapSessionToTerminalUser(session))
        setActiveScreen("tables")
        return { ok: true }
      } catch (err) {
        return { ok: false, error: translateApiError(err, "Geçersiz PIN kodu") }
      }
    },
    [lastActivityRef, setActiveScreen, setCurrentUser]
  )

  const selectTable = useCallback(
    async (
      tableOrId: TerminalTable | string | null,
      force = false
    ): Promise<{ ok: boolean; holderName?: string; canForceUnlock?: boolean }> => {
      if (!tableOrId) {
        releaseTableSession()
        return { ok: true }
      }
      const tableId = typeof tableOrId === "string" ? tableOrId : tableOrId.id
      if (!navigator.onLine) {
        return { ok: false, holderName: "İnternet bağlantısı yok. Masa açılamadı." }
      }
      if (!currentUserRef.current) return { ok: false, holderName: "Garson seçilmedi" }
      const token = getToken()
      if (!token) return { ok: false, holderName: "Bağlantı yok" }
      const prevLocked = lockedTableIdRef.current
      if (prevLocked && prevLocked !== tableId) {
        void api.tables.sessionUnlock(token, prevLocked).catch(() => undefined)
      }
      try {
        const res = await api.tables.sessionLock(token, tableId, force)
        if (!res.ok) {
          return {
            ok: false,
            holderName: res.holderName ? formatTitleCase(res.holderName) : undefined,
            canForceUnlock: res.canForceUnlock,
          }
        }
        lockedTableIdRef.current = tableId
        pendingUnlockTableIdRef.current = tableId
        sessionStorage.setItem(LOCKED_TABLE_STORAGE_KEY, tableId)
        setSelectedTableId(tableId)
        void pullTables()
        return { ok: true }
      } catch (err) {
        return { ok: false, holderName: translateApiError(err, "Masa kilitlenemedi") }
      }
    },
    [
      currentUserRef,
      lockedTableIdRef,
      pendingUnlockTableIdRef,
      pullTables,
      releaseTableSession,
      setSelectedTableId,
    ]
  )

  const refreshSavedUser = useCallback(() => {
    setCurrentUser(mapSessionToTerminalUser(getStaffSession()))
  }, [setCurrentUser])

  return {
    releaseTableSession,
    logout,
    logoutRestaurant,
    login,
    loginWithPin,
    selectTable,
    refreshSavedUser,
  }
}

