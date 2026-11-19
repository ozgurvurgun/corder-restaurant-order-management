import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react"
import { io, type Socket } from "socket.io-client"
import {
  BOSS_UNAUTHORIZED_EVENT, bossApi, clearBossSession, getApiBase, getBossToken,
  getStoredActiveBranchId, getStoredBossUser, getStoredBranches, notifyUnauthorized, setBossSession,
  setBossToken, setStoredActiveBranchId, setStoredBranches, type StoredBossUser,
} from "./api"
import { formatTitleCase } from "./format"
import {
  getBossDismissedNotifIds, getBossReadNotifIds, getFraudPushSoundEnabled,
  markBossNotifReadLocal, markBossNotifsDismissedLocal, requestBrowserNotificationPermission,
  setFraudPushSoundEnabled, triggerFraudPushNotification, triggerPlatformPushNotification,
} from "./fraud-notifier"
import type {
  BossOverviewResponse, BossPlatformNotificationDto, BranchSummary, CatalogCategoryDto, CatalogProductDto,
  FraudAlertDto, FraudAlertStatus, LiveOrderDto, LiveTableDto,
  PermissionCatalogResponse, RoleDefinition, StaffMemberDto,
} from "./types"

interface BossStoreContextValue {
  isAuthenticated: boolean; user: StoredBossUser | null; branches: BranchSummary[]
  selectedBranchId: string; effectiveBranchId: string; effectiveBranch: BranchSummary | null
  setSelectedBranchId: (id: string) => void; overview: BossOverviewResponse | null
  catalog: PermissionCatalogResponse | null; roles: RoleDefinition[]; staff: StaffMemberDto[]
  tables: LiveTableDto[]; orders: LiveOrderDto[]; products: CatalogProductDto[]
  categories: CatalogCategoryDto[]; fraudAlerts: FraudAlertDto[]; openCriticalHighAlertCount: number
  platformNotifications: BossPlatformNotificationDto[]
  markPlatformNotificationRead: (id: string) => void
  clearPlatformNotifications: () => void
  pushSoundEnabled: boolean; togglePushSound: (enabled: boolean) => Promise<void>
  updateFraudAlertStatus: (id: string, status: FraudAlertStatus, resolutionNote?: string) => Promise<void>
  deleteFraudAlerts: (opts: { ids?: string[]; deleteAll?: boolean; onlyResolved?: boolean }) => Promise<void>
  loading: boolean; error: string | null; toast: { message: string; type: "success" | "error" } | null
  showToast: (message: string, type?: "success" | "error") => void
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void; refreshAll: () => Promise<void>; refreshBranchDetails: (branchId?: string) => Promise<void>
}

const BossStoreContext = createContext<BossStoreContextValue | null>(null)

export function useBossStore() {
  const ctx = useContext(BossStoreContext)
  if (!ctx) throw new Error("useBossStore must be used within BossStoreProvider")
  return ctx
}

function normalizeOrders(ordersRes: LiveOrderDto[]): LiveOrderDto[] {
  return ordersRes.map((o) => ({
    ...o,
    userName: o.userName ? formatTitleCase(o.userName) : o.userName,
    items: (o.items ?? []).map((it) => ({ ...it, productName: formatTitleCase(it.productName) })),
  }))
}

export function BossStoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredBossUser | null>(() => (getBossToken() ? getStoredBossUser() : null))
  const [branches, setBranches] = useState<BranchSummary[]>(getStoredBranches)
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>(() => {
    const saved = getStoredActiveBranchId()
    if (saved) return saved
    const stored = getStoredBranches()
    return stored.length > 1 ? "ALL" : (stored[0]?.id ?? "")
  })
  const [tokenVersion, setTokenVersion] = useState(0)
  const [overview, setOverview] = useState<BossOverviewResponse | null>(null)
  const [catalog, setCatalog] = useState<PermissionCatalogResponse | null>(null)
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [staff, setStaff] = useState<StaffMemberDto[]>([])
  const [tables, setTables] = useState<LiveTableDto[]>([])
  const [orders, setOrders] = useState<LiveOrderDto[]>([])
  const [products, setProducts] = useState<CatalogProductDto[]>([])
  const [categories, setCategories] = useState<CatalogCategoryDto[]>([])
  const [fraudAlerts, setBackendFraudAlerts] = useState<FraudAlertDto[]>([])
  const [platformNotifications, setPlatformNotifications] = useState<BossPlatformNotificationDto[]>([])
  const [pushSoundEnabled, setPushSoundEnabledState] = useState<boolean>(getFraudPushSoundEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const liveRefreshTimerRef = useRef<number | null>(null)
  const lastSwitchedBranchRef = useRef<string | null>(null)
  const seenAlertIdsRef = useRef<Set<string>>(new Set())
  const initialAlertsLoadedRef = useRef(false)

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 3400)
  }, [])

  const resetBranchScopedState = useCallback(() => {
    setRoles([]); setStaff([]); setTables([]); setOrders([]); setProducts([]); setCategories([])
  }, [])

  const logout = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
    if (liveRefreshTimerRef.current !== null) {
      window.clearTimeout(liveRefreshTimerRef.current)
      liveRefreshTimerRef.current = null
    }
    lastSwitchedBranchRef.current = null
    seenAlertIdsRef.current.clear()
    initialAlertsLoadedRef.current = false
    clearBossSession()
    setUser(null); setBranches([]); setOverview(null); setCatalog(null)
    setBackendFraudAlerts([]); setPlatformNotifications([]); setError(null)
    resetBranchScopedState()
  }, [resetBranchScopedState])

  useEffect(() => {
    const onUnauthorized = () => logout()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && user && !getBossToken()) logout()
    }
    window.addEventListener(BOSS_UNAUTHORIZED_EVENT, onUnauthorized)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener(BOSS_UNAUTHORIZED_EVENT, onUnauthorized)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [logout, user])

  const effectiveBranchId = useMemo(
    () => (selectedBranchId && selectedBranchId !== "ALL" ? selectedBranchId : (branches[0]?.id ?? "")),
    [selectedBranchId, branches]
  )
  const effectiveBranch = useMemo(
    () => branches.find((b) => b.id === effectiveBranchId) ?? branches[0] ?? null,
    [branches, effectiveBranchId]
  )
  const openCriticalHighAlertCount = useMemo(
    () => fraudAlerts.filter((a) => (a.status === "open" || a.status === "investigating") && (a.severity === "critical" || a.severity === "high")).length,
    [fraudAlerts]
  )

  useEffect(() => {
    if (fraudAlerts.length === 0) return
    if (!initialAlertsLoadedRef.current) {
      for (const a of fraudAlerts) seenAlertIdsRef.current.add(a.id)
      initialAlertsLoadedRef.current = true
      return
    }
    const newCriticalOrHigh = fraudAlerts.filter(
      (a) => !seenAlertIdsRef.current.has(a.id) && a.status === "open" && (a.severity === "critical" || a.severity === "high")
    )
    for (const a of fraudAlerts) seenAlertIdsRef.current.add(a.id)
    if (newCriticalOrHigh.length > 0 && pushSoundEnabled) void triggerFraudPushNotification(newCriticalOrHigh[0]!)
  }, [fraudAlerts, pushSoundEnabled])

  const togglePushSound = useCallback(
    async (enabled: boolean) => {
      setPushSoundEnabledState(enabled)
      setFraudPushSoundEnabled(enabled)
      if (enabled) {
        const perm = await requestBrowserNotificationPermission()
        showToast(
          perm === "granted"
            ? "Anlık Push Güvenlik Bildirimleri aktif edildi"
            : "Push bildirimi için tarayıcı bildirim izni gereklidir",
          perm === "granted" ? "success" : "error"
        )
      } else {
        showToast("Anlık Push Güvenlik Bildirimleri kapatıldı")
      }
    },
    [showToast]
  )

  const fetchFraudAlertsSilently = useCallback(async (branchFilter?: string) => {
    const token = getBossToken()
    if (!token) return
    try {
      setBackendFraudAlerts(await bossApi.getFraudAlerts(token, branchFilter))
    } catch {
      // Fallback to heuristic alerts when endpoint is not populated
    }
  }, [])

  const fetchPlatformNotifsSilently = useCallback(async (branchId?: string) => {
    if (!branchId || !getBossToken()) return
    try {
      const state = await bossApi.notifications.getState(branchId)
      const readSet = getBossReadNotifIds()
      const dismissedSet = getBossDismissedNotifIds()
      const items = (state.platformNotifications ?? [])
        .filter((pn) => (!Array.isArray(pn.targetApps) || pn.targetApps.includes("boss")) && !dismissedSet.has(pn.id))
        .map((pn) => ({ ...pn, read: readSet.has(pn.id) }))
      setPlatformNotifications(items)
    } catch {}
  }, [])

  const markPlatformNotificationRead = useCallback((id: string) => {
    markBossNotifReadLocal(id)
    setPlatformNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const clearPlatformNotifications = useCallback(() => {
    setPlatformNotifications((prev) => {
      const ids = prev.map((n) => n.id)
      markBossNotifsDismissedLocal(ids)
      if (effectiveBranchId && ids.length > 0) {
        void bossApi.notifications.dismiss(effectiveBranchId, ids).catch(() => {})
      }
      return []
    })
  }, [effectiveBranchId])

  const updateFraudAlertStatus = useCallback(
    async (id: string, status: FraudAlertStatus, resolutionNote?: string) => {
      const token = getBossToken()
      if (!token) return
      const updated = await bossApi.updateFraudAlert(token, id, { status, resolutionNote })
      setBackendFraudAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updated, status, resolutionNote } : a))
      )
      showToast("Güvenlik uyarısı durumu güncellendi")
    },
    [showToast]
  )

  const deleteFraudAlerts = useCallback(
    async (opts: { ids?: string[]; deleteAll?: boolean; onlyResolved?: boolean }) => {
      const token = getBossToken()
      if (!token) return
      try {
        const res = await bossApi.bulkDeleteFraudAlerts(token, {
          ...opts,
          branchId: selectedBranchId,
        })
        if (opts.deleteAll) {
          setBackendFraudAlerts([])
        } else if (opts.onlyResolved) {
          setBackendFraudAlerts((prev) =>
            prev.filter((a) => a.status !== "resolved" && a.status !== "false_positive")
          )
        } else if (opts.ids?.length) {
          const idSet = new Set(opts.ids)
          setBackendFraudAlerts((prev) => prev.filter((a) => !idSet.has(a.id)))
        }
        showToast(`${res.deletedCount || 0} güvenlik kaydı silindi`)
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Kayıt silinemedi", "error")
      }
    },
    [selectedBranchId, showToast]
  )

  const setSelectedBranchId = useCallback(
    (id: string) => {
      if (id === selectedBranchId) return
      const prevEffective =
        selectedBranchId && selectedBranchId !== "ALL" ? selectedBranchId : (branches[0]?.id ?? "")
      const nextEffective = id && id !== "ALL" ? id : (branches[0]?.id ?? "")
      if (prevEffective !== nextEffective) {
        socketRef.current?.disconnect()
        socketRef.current = null
        resetBranchScopedState()
      }
      setError(null)
      setSelectedBranchIdState(id)
      setStoredActiveBranchId(id)
    },
    [selectedBranchId, branches, resetBranchScopedState]
  )

  const refreshBranchDetails = useCallback(
    async (explicitBranchId?: string) => {
      const targetId = explicitBranchId || effectiveBranchId
      if (!targetId || !getBossToken()) return
      const [catRes, rolesRes, staffRes, tablesRes, ordersRes, productsRes, categoriesRes] =
        await Promise.all([
          bossApi.roles.catalog(targetId),
          bossApi.roles.list(targetId),
          bossApi.staff.list(targetId),
          bossApi.operations.tables(targetId),
          bossApi.operations.orders(targetId),
          bossApi.operations.products(targetId),
          bossApi.operations.categories(targetId),
        ])
      setCatalog(catRes)
      setRoles(rolesRes)
      setStaff(staffRes.map((s) => ({ ...s, name: formatTitleCase(s.name) })))
      setTables(tablesRes)
      setOrders(normalizeOrders(ordersRes))
      setProducts(productsRes.map((p) => ({ ...p, name: formatTitleCase(p.name), price: Number(p.price) })))
      setCategories(categoriesRes.map((c) => ({ ...c, name: formatTitleCase(c.name) })))
    },
    [effectiveBranchId]
  )

  const refreshLiveOperations = useCallback(
    async (branchId: string, overviewFilter: string) => {
      if (!branchId || !getBossToken()) return
      try {
        const [ovRes, tablesRes, ordersRes] = await Promise.all([
          bossApi.overview.get(overviewFilter),
          bossApi.operations.tables(branchId),
          bossApi.operations.orders(branchId),
        ])
        setOverview(ovRes)
        setTables(tablesRes)
        setOrders(normalizeOrders(ordersRes))
        void fetchFraudAlertsSilently(overviewFilter)
      } catch {
        // 401 handled via BOSS_UNAUTHORIZED_EVENT
      }
    },
    [fetchFraudAlertsSilently]
  )

  const refreshAll = useCallback(async () => {
    if (!getBossToken()) return
    setLoading(true)
    setError(null)
    try {
      let targetBranchId = effectiveBranchId
      if (targetBranchId && lastSwitchedBranchRef.current !== targetBranchId) {
        const switched = await bossApi.auth.switchBranch(targetBranchId)
        setBossToken(switched.accessToken)
        setStoredBranches(switched.restaurants)
        setBranches(switched.restaurants)
        lastSwitchedBranchRef.current = targetBranchId
        setTokenVersion((v) => v + 1)
      }
      const [meRes, ovRes] = await Promise.all([
        bossApi.auth.me(),
        bossApi.overview.get(selectedBranchId),
      ])
      if (!meRes.user.isBoss && meRes.user.role !== "root") {
        logout()
        return
      }
      const u: StoredBossUser = {
        id: meRes.user.id, name: meRes.user.name, email: meRes.user.email, phone: meRes.user.phone,
        roleLabel: meRes.user.roleLabel, bossTier: meRes.user.bossTier, brandName: meRes.user.brandName,
      }
      setBranches(meRes.restaurants)
      setStoredBranches(meRes.restaurants)
      setUser(u)
      setOverview(ovRes)
      void fetchFraudAlertsSilently(selectedBranchId)
      targetBranchId =
        selectedBranchId && selectedBranchId !== "ALL" ? selectedBranchId : (meRes.restaurants[0]?.id ?? "")
      if (targetBranchId) {
        void fetchPlatformNotifsSilently(targetBranchId)
        await refreshBranchDetails(targetBranchId)
      }
    } catch (e) {
      if (!getBossToken()) {
        logout()
        return
      }
      setError(e instanceof Error ? e.message : "Veriler yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [effectiveBranchId, selectedBranchId, refreshBranchDetails, fetchFraudAlertsSilently, fetchPlatformNotifsSilently, logout])

  useEffect(() => {
    if (!user?.id || !getBossToken()) return
    void refreshAll()
  }, [user?.id, selectedBranchId, refreshAll])

  useEffect(() => {
    const token = getBossToken()
    if (!token || !effectiveBranchId || !user?.id) return
    const socket = io(getApiBase() || undefined, {
      path: "/ws",
      auth: { token, restaurantId: effectiveBranchId },
      transports: ["websocket", "polling"],
    })
    socketRef.current = socket
    const scheduleLiveRefresh = () => {
      if (liveRefreshTimerRef.current !== null) window.clearTimeout(liveRefreshTimerRef.current)
      liveRefreshTimerRef.current = window.setTimeout(() => {
        liveRefreshTimerRef.current = null
        void refreshLiveOperations(effectiveBranchId, selectedBranchId)
      }, 250)
    }
    const onTablesPresence = (presenceMap?: Record<string, { staffId: string; staffName: string }>) => {
      if (!presenceMap || typeof presenceMap !== "object") return
      setTables((prev) =>
        prev.map((t) => ({
          ...t,
          sessionStaffId: presenceMap[t.id]?.staffId ?? null,
          sessionStaffName: presenceMap[t.id]?.staffName ?? null,
        }))
      )
    }
    const onAuthExpired = (payload?: { reason?: string }) => {
      notifyUnauthorized(payload?.reason)
    }
    const onPlatformNotification = (payload?: BossPlatformNotificationDto) => {
      if (!payload || !payload.id) return
      if (Array.isArray(payload.targetApps) && !payload.targetApps.includes("boss")) return
      setPlatformNotifications((prev) =>
        prev.some((n) => n.id === payload.id) ? prev : [{ ...payload, read: false }, ...prev]
      )
      showToast(`📢 ${payload.title}: ${payload.message}`, payload.level === "urgent" ? "error" : "success")
      if (pushSoundEnabled) void triggerPlatformPushNotification(payload)
    }
    socket.on("auth:expired", onAuthExpired)
    socket.on("platform:notification", onPlatformNotification)
    socket.on("order:created", scheduleLiveRefresh)
    socket.on("orders:moved", scheduleLiveRefresh)
    socket.on("orders:updated", scheduleLiveRefresh)
    socket.on("fraud:alert", scheduleLiveRefresh)
    socket.on("tables:presence", onTablesPresence)
    return () => {
      if (liveRefreshTimerRef.current !== null) {
        window.clearTimeout(liveRefreshTimerRef.current)
        liveRefreshTimerRef.current = null
      }
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [effectiveBranchId, selectedBranchId, tokenVersion, user?.id, refreshLiveOperations, pushSoundEnabled, showToast])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await bossApi.auth.login(email, password)
      if (!res.user.isBoss && res.user.role !== "root") {
        return {
          ok: false,
          error: "Corder Boss uygulamasına yalnızca İşletme Sahibi (Boss) hesapları giriş yapabilir.",
        }
      }
      const initialBranch =
        res.restaurants.length > 1 ? "ALL" : (res.restaurant?.id ?? res.restaurants[0]?.id ?? "")
      const u: StoredBossUser = {
        id: res.user.id, name: res.user.name, email: res.user.email, phone: res.user.phone,
        roleLabel: res.user.roleLabel || "İşletme Sahibi (Boss)",
        bossTier: res.user.bossTier, brandName: res.user.brandName,
      }
      lastSwitchedBranchRef.current = res.restaurant?.id ?? res.restaurants[0]?.id ?? null
      setBossSession({ accessToken: res.accessToken, user: u, restaurants: res.restaurants, activeBranchId: initialBranch })
      setError(null)
      setUser(u)
      setBranches(res.restaurants)
      setSelectedBranchIdState(initialBranch)
      setTokenVersion((v) => v + 1)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Giriş yapılamadı" }
    }
  }, [])

  return (
    <BossStoreContext.Provider
      value={{
        isAuthenticated: Boolean(user && getBossToken()),
        user, branches, selectedBranchId, effectiveBranchId, effectiveBranch, setSelectedBranchId,
        overview, catalog, roles, staff, tables, orders, products, categories,
        fraudAlerts, openCriticalHighAlertCount,
        platformNotifications, markPlatformNotificationRead, clearPlatformNotifications,
        pushSoundEnabled, togglePushSound, updateFraudAlertStatus, deleteFraudAlerts,
        loading, error, toast, showToast, login, logout, refreshAll, refreshBranchDetails,
      }}
    >
      {children}
    </BossStoreContext.Provider>
  )
}
