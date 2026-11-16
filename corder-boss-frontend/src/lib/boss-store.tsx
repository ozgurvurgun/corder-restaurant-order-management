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
import type { Socket } from "socket.io-client"
import {
  bossApi,
  clearBossSession,
  getApiBase,
  getBossToken,
  getStoredActiveBranchId,
  getStoredBossUser,
  getStoredBranches,
  setBossSession,
  setStoredActiveBranchId,
} from "./api"
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
  user: {
    id: string
    name: string
    email: string
    phone?: string | null
    roleLabel: string
  } | null
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
  const [user, setUser] = useState(getStoredBossUser)
  const [branches, setBranches] = useState<BranchSummary[]>(getStoredBranches)
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>(() => {
    const saved = getStoredActiveBranchId()
    if (saved) return saved
    const stored = getStoredBranches()
    return stored.length > 1 ? "ALL" : (stored[0]?.id ?? "")
  })
  const [overview, setOverview] = useState<BossOverviewResponse | null>(null)
  const [catalog, setCatalog] = useState<PermissionCatalogResponse | null>(null)
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [staff, setStaff] = useState<StaffMemberDto[]>([])
  const [tables, setTables] = useState<LiveTableDto[]>([])
  const [orders, setOrders] = useState<LiveOrderDto[]>([])
  const [products, setProducts] = useState<CatalogProductDto[]>([])
  const [categories, setCategories] = useState<CatalogCategoryDto[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type })
    window.setTimeout(() => {
      setToast((cur) => (cur?.message === message ? null : cur))
    }, 3200)
  }, [])

  const effectiveBranchId = useMemo(() => {
    if (selectedBranchId && selectedBranchId !== "ALL") return selectedBranchId
    return branches[0]?.id ?? ""
  }, [selectedBranchId, branches])

  const effectiveBranch = useMemo(
    () => branches.find((b) => b.id === effectiveBranchId) ?? branches[0] ?? null,
    [branches, effectiveBranchId]
  )

  const setSelectedBranchId = useCallback((id: string) => {
    setSelectedBranchIdState(id)
    setStoredActiveBranchId(id)
  }, [])

  const refreshBranchDetails = useCallback(
    async (explicitBranchId?: string) => {
      const targetId = explicitBranchId || effectiveBranchId
      if (!targetId || !getBossToken()) return
      try {
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
        setStaff(staffRes)
        setTables(tablesRes)
        setOrders(ordersRes)
        setProducts(productsRes.map((p) => ({ ...p, price: Number(p.price) })))
        setCategories(categoriesRes)
      } catch {
        // ignore background refresh error
      }
    },
    [effectiveBranchId]
  )

  const refreshAll = useCallback(async () => {
    if (!getBossToken()) return
    setLoading(true)
    try {
      const [meRes, ovRes] = await Promise.all([
        bossApi.auth.me().catch(() => null),
        bossApi.overview.get(selectedBranchId),
      ])
      if (meRes) {
        setBranches(meRes.restaurants)
        setUser({
          id: meRes.user.id,
          name: meRes.user.name,
          email: meRes.user.email,
          phone: meRes.user.phone,
          roleLabel: meRes.user.roleLabel,
        })
      }
      setOverview(ovRes)
      await refreshBranchDetails()
    } catch (e) {
      if (e instanceof Error && e.message.includes("Oturum")) {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId, refreshBranchDetails])

  useEffect(() => {
    if (!user || !getBossToken()) return
    void refreshAll()
  }, [user?.id, selectedBranchId, refreshAll])

  // Real-time Socket.IO connection for live updates on the active branch
  useEffect(() => {
    const token = getBossToken()
    if (!token || !effectiveBranchId) return
    let cancelled = false
    import("socket.io-client").then(({ io }) => {
      if (cancelled) return
      const socket = io(getApiBase(), {
        path: "/ws",
        auth: { token, restaurantId: effectiveBranchId },
        transports: ["websocket", "polling"],
      })
      socketRef.current = socket
      const onRealtimeChange = () => {
        void bossApi.overview.get(selectedBranchId).then(setOverview).catch(() => {})
        void refreshBranchDetails(effectiveBranchId)
      }
      socket.on("order:created", onRealtimeChange)
      socket.on("orders:moved", onRealtimeChange)
      socket.on("orders:updated", onRealtimeChange)
      socket.on("tables:presence", onRealtimeChange)
    })
    return () => {
      cancelled = true
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [effectiveBranchId, selectedBranchId, refreshBranchDetails])

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
        const u = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          phone: res.user.phone,
          roleLabel: res.user.roleLabel || "İşletme Sahibi (Boss)",
        }
        setBossSession({
          accessToken: res.accessToken,
          user: u,
          restaurants: res.restaurants,
          activeBranchId: initialBranch,
        })
        setUser(u)
        setBranches(res.restaurants)
        setSelectedBranchIdState(initialBranch)
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

  const logout = useCallback(() => {
    clearBossSession()
    setUser(null)
    setBranches([])
    setOverview(null)
  }, [])

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

