import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { io, type Socket } from "socket.io-client"
import {
  BOSS_UNAUTHORIZED_EVENT,
  bossApi,
  clearBossSession,
  getApiBase,
  getBossToken,
  getStoredActiveBranchId,
  getStoredBossUser,
  getStoredBranches,
  setBossSession,
  setBossToken,
  setStoredActiveBranchId,
  setStoredBranches,
  type StoredBossUser,
} from "./api"
import { formatTitleCase } from "./format"
import type {
  BossOverviewResponse,
  BranchSummary,
  CatalogCategoryDto,
  CatalogProductDto,
  LiveOrderDto,
  LiveTableDto,
  PermissionCatalogResponse,
  RoleDefinition,
  StaffMemberDto,
} from "./types"

interface BossStoreContextValue {
  isAuthenticated: boolean
  user: StoredBossUser | null
  branches: BranchSummary[]
  /** Either 'ALL' (for consolidated multi-branch view) or a specific restaurantId */
  selectedBranchId: string
  /** Guaranteed concrete branch ID for single-branch tabs (Roles, Staff, Operations) */
  effectiveBranchId: string
  effectiveBranch: BranchSummary | null
  setSelectedBranchId: (id: string) => void
  overview: BossOverviewResponse | null
  catalog: PermissionCatalogResponse | null
  roles: RoleDefinition[]
  staff: StaffMemberDto[]
  tables: LiveTableDto[]
  orders: LiveOrderDto[]
  products: CatalogProductDto[]
  categories: CatalogCategoryDto[]
  loading: boolean
  error: string | null
  toast: { message: string; type: "success" | "error" } | null
  showToast: (message: string, type?: "success" | "error") => void
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  refreshAll: () => Promise<void>
  refreshBranchDetails: (branchId?: string) => Promise<void>
}

const BossStoreContext = createContext<BossStoreContextValue | null>(null)

export function useBossStore() {
  const ctx = useContext(BossStoreContext)
  if (!ctx) throw new Error("useBossStore must be used within BossStoreProvider")
  return ctx
}

export function BossStoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredBossUser | null>(() =>
    getBossToken() ? getStoredBossUser() : null
  )
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const liveRefreshTimerRef = useRef<number | null>(null)
  const lastSwitchedBranchRef = useRef<string | null>(null)

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }
    setToast({ message, type })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 3400)
  }, [])

  const resetBranchScopedState = useCallback(() => {
    setRoles([])
    setStaff([])
    setTables([])
    setOrders([])
    setProducts([])
    setCategories([])
  }, [])

  const logout = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    if (liveRefreshTimerRef.current !== null) {
      window.clearTimeout(liveRefreshTimerRef.current)
      liveRefreshTimerRef.current = null
    }
    lastSwitchedBranchRef.current = null
    clearBossSession()
    setUser(null)
    setBranches([])
    setOverview(null)
    setCatalog(null)
    setError(null)
    resetBranchScopedState()
  }, [resetBranchScopedState])

  useEffect(() => {
    const onUnauthorized = () => {
      logout()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && user && !getBossToken()) {
        logout()
      }
    }
    window.addEventListener(BOSS_UNAUTHORIZED_EVENT, onUnauthorized)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener(BOSS_UNAUTHORIZED_EVENT, onUnauthorized)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [logout, user])

  const effectiveBranchId = useMemo(() => {
    if (selectedBranchId && selectedBranchId !== "ALL") return selectedBranchId
    return branches[0]?.id ?? ""
  }, [selectedBranchId, branches])

  const effectiveBranch = useMemo(
    () => branches.find((b) => b.id === effectiveBranchId) ?? branches[0] ?? null,
    [branches, effectiveBranchId]
  )

  const setSelectedBranchId = useCallback(
    (id: string) => {
      if (id === selectedBranchId) return
      const prevEffective =
        selectedBranchId && selectedBranchId !== "ALL"
          ? selectedBranchId
          : (branches[0]?.id ?? "")
      const nextEffective = id && id !== "ALL" ? id : (branches[0]?.id ?? "")

      if (prevEffective !== nextEffective) {
        if (socketRef.current) {
          socketRef.current.disconnect()
          socketRef.current = null
        }
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
      setOrders(
        ordersRes.map((o) => ({
          ...o,
          waiterName: o.waiterName ? formatTitleCase(o.waiterName) : o.waiterName,
          items: (o.items ?? []).map((it) => ({
            ...it,
            productName: formatTitleCase(it.productName),
          })),
        }))
      )
      setProducts(
        productsRes.map((p) => ({
          ...p,
          name: formatTitleCase(p.name),
          price: Number(p.price),
        }))
      )
      setCategories(
        categoriesRes.map((c) => ({
          ...c,
          name: formatTitleCase(c.name),
        }))
      )
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
        setOrders(
          ordersRes.map((o) => ({
            ...o,
            waiterName: o.waiterName ? formatTitleCase(o.waiterName) : o.waiterName,
            items: (o.items ?? []).map((it) => ({
              ...it,
              productName: formatTitleCase(it.productName),
            })),
          }))
        )
      } catch {
        // 401 is handled globally via BOSS_UNAUTHORIZED_EVENT
      }
    },
    []
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
        id: meRes.user.id,
        name: meRes.user.name,
        email: meRes.user.email,
        phone: meRes.user.phone,
        roleLabel: meRes.user.roleLabel,
        bossTier: meRes.user.bossTier,
        brandName: meRes.user.brandName,
      }
      setBranches(meRes.restaurants)
      setStoredBranches(meRes.restaurants)
      setUser(u)
      setOverview(ovRes)

      targetBranchId =
        selectedBranchId && selectedBranchId !== "ALL"
          ? selectedBranchId
          : (meRes.restaurants[0]?.id ?? "")
      if (targetBranchId) {
        await refreshBranchDetails(targetBranchId)
      }
    } catch (e) {
      if (!getBossToken()) {
        logout()
        return
      }
      const msg = e instanceof Error ? e.message : "Veriler yüklenemedi."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [effectiveBranchId, selectedBranchId, refreshBranchDetails, logout])

  useEffect(() => {
    if (!user?.id || !getBossToken()) return
    void refreshAll()
  }, [user?.id, selectedBranchId, refreshAll])

  // Real-time Socket.IO connection for live updates on the active branch
  useEffect(() => {
    const token = getBossToken()
    if (!token || !effectiveBranchId || !user?.id) return
    const apiBase = getApiBase()
    const socket = io(apiBase || undefined, {
      path: "/ws",
      auth: { token, restaurantId: effectiveBranchId },
      transports: ["websocket", "polling"],
    })
    socketRef.current = socket

    const scheduleLiveRefresh = () => {
      if (liveRefreshTimerRef.current !== null) {
        window.clearTimeout(liveRefreshTimerRef.current)
      }
      liveRefreshTimerRef.current = window.setTimeout(() => {
        liveRefreshTimerRef.current = null
        void refreshLiveOperations(effectiveBranchId, selectedBranchId)
      }, 250)
    }

    const onTablesPresence = (
      presenceMap?: Record<string, { staffId: string; staffName: string }>
    ) => {
      if (!presenceMap || typeof presenceMap !== "object") return
      setTables((prev) =>
        prev.map((t) => {
          const entry = presenceMap[t.id]
          return {
            ...t,
            sessionStaffId: entry?.staffId ?? null,
            sessionStaffName: entry?.staffName ?? null,
          }
        })
      )
    }

    socket.on("order:created", scheduleLiveRefresh)
    socket.on("orders:moved", scheduleLiveRefresh)
    socket.on("orders:updated", scheduleLiveRefresh)
    socket.on("tables:presence", onTablesPresence)

    return () => {
      if (liveRefreshTimerRef.current !== null) {
        window.clearTimeout(liveRefreshTimerRef.current)
        liveRefreshTimerRef.current = null
      }
      socket.disconnect()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [effectiveBranchId, selectedBranchId, tokenVersion, user?.id, refreshLiveOperations])

  const login = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await bossApi.auth.login(email, password)
        if (!res.user.isBoss && res.user.role !== "root") {
          return {
            ok: false,
            error:
              "Corder Boss uygulamasına yalnızca İşletme Sahibi (Boss) hesapları giriş yapabilir.",
          }
        }
        const initialBranch =
          res.restaurants.length > 1 ? "ALL" : (res.restaurant?.id ?? res.restaurants[0]?.id ?? "")
        const u: StoredBossUser = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          phone: res.user.phone,
          roleLabel: res.user.roleLabel || "İşletme Sahibi (Boss)",
          bossTier: res.user.bossTier,
          brandName: res.user.brandName,
        }
        lastSwitchedBranchRef.current = res.restaurant?.id ?? res.restaurants[0]?.id ?? null
        setBossSession({
          accessToken: res.accessToken,
          user: u,
          restaurants: res.restaurants,
          activeBranchId: initialBranch,
        })
        setError(null)
        setUser(u)
        setBranches(res.restaurants)
        setSelectedBranchIdState(initialBranch)
        setTokenVersion((v) => v + 1)
        return { ok: true }
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Giriş yapılamadı",
        }
      }
    },
    []
  )

  const isAuthenticated = Boolean(user && getBossToken())

  return (
    <BossStoreContext.Provider
      value={{
        isAuthenticated,
        user,
        branches,
        selectedBranchId,
        effectiveBranchId,
        effectiveBranch,
        setSelectedBranchId,
        overview,
        catalog,
        roles,
        staff,
        tables,
        orders,
        products,
        categories,
        loading,
        error,
        toast,
        showToast,
        login,
        logout,
        refreshAll,
        refreshBranchDetails,
      }}
    >
      {children}
    </BossStoreContext.Provider>
  )
}
