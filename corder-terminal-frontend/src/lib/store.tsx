import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react"
import type { Socket } from "socket.io-client"
import type {
  PaymentMethod, TerminalCategory, TerminalOrder, TerminalOrderItem,
  TerminalProduct, TerminalScreen, TerminalTable, TerminalUser,
} from "./types"
import {
  api, getToken, setToken, clearToken, getRestaurant, setRestaurant,
  getStaffSession, setStaffSession, clearStaffSession, getBase,
  setAuthExpiredHandler, setStaffExpiredHandler, type RawTableDto, type OrderDto, type StaffSession,
} from "./api"
import {
  calculateOrderItemsTotal, mapMenuTreeToCategoriesAndProducts,
  mapOrderDtoToTerminalOrder, mapTablesWithOrders, upsertCartItem,
} from "./terminal-mappers"

function mapSessionToTerminalUser(s: Omit<StaffSession, "expiresAt" | "staffToken"> | null): TerminalUser | null {
  if (!s) return null
  return {
    id: s.staffId,
    name: s.name,
    role: s.role,
    roleLabel: s.roleLabel,
    permissions: s.permissions,
    limits: s.limits,
  }
}

interface TerminalContextType {
  currentUser: TerminalUser | null; isLoggedIn: boolean; isOffline: boolean
  restaurant: { id: string; name: string; slug: string } | null
  activeScreen: TerminalScreen; tables: TerminalTable[]; categories: TerminalCategory[]
  products: TerminalProduct[]; orders: TerminalOrder[]; selectedTable: TerminalTable | null
  cart: TerminalOrderItem[]; selectedCategory: string | null; isLoading: boolean; error: string | null
  login: (email: string, password: string) => Promise<boolean>
  loginWithPin: (pin: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void; logoutRestaurant: () => void; toggleOffline: () => void; refreshData: () => Promise<void>
  setActiveScreen: (screen: TerminalScreen) => void
  selectTable: (tableOrId: TerminalTable | string | null) => Promise<{ ok: boolean; holderName?: string }>
  releaseTableSession: () => void; selectCategory: (categoryId: string | null) => void
  addToCart: (product: TerminalProduct, quantity?: number, note?: string) => void
  removeFromCart: (itemOrProductId: string) => void
  updateCartQuantity: (itemOrProductId: string, quantity: number) => void
  updateCartNote: (itemOrProductId: string, note: string) => void
  clearCart: () => void; submitOrder: (tableId?: string) => Promise<boolean>
  requestBill: (tableId: string) => Promise<boolean>
  closeTable: (tableId: string, method?: PaymentMethod) => Promise<boolean>
  moveTable: (fromTableId: string, toTableId: string) => Promise<boolean>
  moveOrderItemsToTable: (fromTableId: string, toTableId: string, itemIds: string[]) => Promise<boolean>
  cancelOrderItemOnServer: (orderId: string, itemId: string, reason?: string) => Promise<boolean>
  processPayment: (orderId: string, method: PaymentMethod, amount?: number) => Promise<boolean>
  printReceipt: (tableId: string) => Promise<void>
  hasPermission: (perm: string) => boolean
  getTableOrders: (tableId: string) => TerminalOrder[]
  getTableTotal: (tableId: string) => number
  getCartTotal: () => number; getCartItemCount: () => number
}

const TerminalContext = createContext<TerminalContextType | null>(null)

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<TerminalUser | null>(() => mapSessionToTerminalUser(getStaffSession()))
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [restaurant, setRestaurantState] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [activeScreen, setActiveScreen] = useState<TerminalScreen>("tables")
  const [rawTables, setRawTables] = useState<RawTableDto[]>([])
  const [rawOrders, setRawOrders] = useState<OrderDto[]>([])
  const [categories, setCategories] = useState<TerminalCategory[]>([])
  const [products, setProducts] = useState<TerminalProduct[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<TerminalOrderItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const submitInFlightRef = useRef(false)
  const lockedTableIdRef = useRef<string | null>(null)
  const pendingUnlockTableIdRef = useRef<string | null>(null)
  const currentUserRef = useRef<TerminalUser | null>(currentUser)

  useEffect(() => { currentUserRef.current = currentUser }, [currentUser])

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const orders = useMemo(
    () => rawOrders.map((dto) => mapOrderDtoToTerminalOrder(dto, rawTables, productsById)),
    [rawOrders, rawTables, productsById]
  )
  const tables = useMemo(() => mapTablesWithOrders(rawTables, orders), [rawTables, orders])
  const selectedTable = useMemo(
    () => (selectedTableId ? tables.find((t) => t.id === selectedTableId) ?? null : null),
    [tables, selectedTableId]
  )

  const pullTables = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try { setRawTables(await api.tables.list(token)) } catch { /* ignore polling errors */ }
  }, [])

  const refreshData = useCallback(async () => {
    const token = getToken()
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const [tablesRes, ordersRes, menuRes] = await Promise.all([
        api.tables.list(token),
        api.orders.list(token),
        api.menu.terminal(token).catch(() => null),
      ])
      setRawTables(tablesRes)
      setRawOrders(ordersRes)
      if (menuRes) {
        const mapped = mapMenuTreeToCategoriesAndProducts(menuRes.categories)
        setCategories(mapped.categories)
        setProducts(mapped.products)
        setSelectedCategory((prev) => prev ?? mapped.categories.find((c) => !c.parentId)?.id ?? null)
      }
      setCurrentUser(mapSessionToTerminalUser(getStaffSession()))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri yüklenemedi")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = getToken()
    const rest = getRestaurant()
    if (token && rest) {
      setIsLoggedIn(true)
      setRestaurantState(rest)
      void refreshData()
    }
  }, [refreshData])

  useEffect(() => {
    if (!isLoggedIn) return
    const syncOnVisible = () => { if (document.visibilityState === "visible") void refreshData() }
    const syncOnOnline = () => void refreshData()
    document.addEventListener("visibilitychange", syncOnVisible)
    window.addEventListener("online", syncOnOnline)
    const intervalId = window.setInterval(syncOnVisible, 45_000)
    return () => {
      document.removeEventListener("visibilitychange", syncOnVisible)
      window.removeEventListener("online", syncOnOnline)
      window.clearInterval(intervalId)
    }
  }, [isLoggedIn, refreshData])

  useEffect(() => {
    if (!isLoggedIn) return
    const token = getToken()
    const base = getBase()
    if (!token || !base) return
    let cancelled = false
    import("socket.io-client").then(({ io }) => {
      if (cancelled) return
      const socket = io(base, {
        path: "/ws", auth: { token }, transports: ["websocket", "polling"],
        reconnectionAttempts: Infinity, reconnectionDelayMax: 10000, timeout: 20000,
      })
      socketRef.current = socket
      const syncAll = () => void refreshData()
      socket.on("order:created", syncAll)
      socket.on("orders:moved", syncAll)
      socket.on("orders:updated", syncAll)
      socket.on("reconnect", syncAll)
      socket.on("tables:presence", () => void pullTables())
      socket.on("connect", syncAll)
    })
    return () => {
      cancelled = true
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [isLoggedIn, refreshData, pullTables])

  const releaseTableSession = useCallback(() => {
    const tableId = lockedTableIdRef.current ?? pendingUnlockTableIdRef.current
    const user = currentUserRef.current
    const token = getToken()
    lockedTableIdRef.current = null
    setSelectedTableId(null)
    if (!tableId || !user || !token) return
    void api.tables.sessionUnlock(token, tableId).then(() => {
      pendingUnlockTableIdRef.current = null
      void pullTables()
    }).catch(() => { /* keep pendingUnlockTableIdRef for retry */ })
  }, [pullTables])

  const logout = useCallback(() => {
    releaseTableSession(); clearStaffSession(); setCurrentUser(null); setActiveScreen("tables")
  }, [releaseTableSession])

  const logoutRestaurant = useCallback(() => {
    releaseTableSession(); clearToken(); clearStaffSession()
    setIsLoggedIn(false); setRestaurantState(null); setCurrentUser(null); setActiveScreen("tables")
    setRawTables([]); setRawOrders([]); setCategories([]); setProducts([]); setCart([]); setError(null)
  }, [releaseTableSession])

  useEffect(() => {
    setAuthExpiredHandler(logoutRestaurant)
    setStaffExpiredHandler(() => {
      clearStaffSession(); setCurrentUser(null); setSelectedTableId(null); setActiveScreen("tables")
      lockedTableIdRef.current = null; pendingUnlockTableIdRef.current = null
    })
    return () => { setAuthExpiredHandler(null); setStaffExpiredHandler(null) }
  }, [logoutRestaurant])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
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
      setError(err instanceof Error ? err.message : "Giriş başarısız")
      return false
    }
  }, [refreshData])

  const loginWithPin = useCallback(async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    const token = getToken()
    if (!token) return { ok: false, error: "Restoran oturumu gerekli" }
    try {
      const res = await api.staff.verifyPin(token, pin)
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
      setCurrentUser(mapSessionToTerminalUser(session))
      setActiveScreen("tables")
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Geçersiz PIN kodu" }
    }
  }, [])

  const selectTable = useCallback(async (tableOrId: TerminalTable | string | null): Promise<{ ok: boolean; holderName?: string }> => {
    if (!tableOrId) { releaseTableSession(); return { ok: true } }
    const tableId = typeof tableOrId === "string" ? tableOrId : tableOrId.id
    if (isOffline) { lockedTableIdRef.current = tableId; setSelectedTableId(tableId); return { ok: true } }
    const user = currentUserRef.current
    const token = getToken()
    if (!user) return { ok: false, holderName: "Garson seçilmedi" }
    if (!token) return { ok: false, holderName: "Bağlantı yok" }
    try {
      const res = await api.tables.sessionLock(token, tableId)
      if (!res.ok) return { ok: false, holderName: res.holderName }
      lockedTableIdRef.current = tableId
      pendingUnlockTableIdRef.current = tableId
      setSelectedTableId(tableId)
      void pullTables()
      return { ok: true }
    } catch (err) {
      return { ok: false, holderName: err instanceof Error && err.message ? err.message : "Bağlantı yok" }
    }
  }, [isOffline, pullTables, releaseTableSession])

  const toggleOffline = useCallback(() => setIsOffline((prev) => !prev), [])
  const selectCategory = useCallback((categoryId: string | null) => setSelectedCategory(categoryId), [])
  const addToCart = useCallback((product: TerminalProduct, quantity = 1, note?: string) => {
    setCart((prev) => upsertCartItem(prev, product, quantity, note))
  }, [])
  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id && i.product.id !== id))
  }, [])
  const updateCartQuantity = useCallback((id: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.id !== id && i.product.id !== id)
        : prev.map((i) => (i.id === id || i.product.id === id ? { ...i, quantity } : i))
    )
  }, [])
  const updateCartNote = useCallback((id: string, note: string) => {
    setCart((prev) => prev.map((i) => (i.id === id || i.product.id === id ? { ...i, note } : i)))
  }, [])
  const clearCart = useCallback(() => setCart([]), [])
  const getCartTotal = useCallback(() => calculateOrderItemsTotal(cart), [cart])
  const getCartItemCount = useCallback(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])

  const submitOrder = useCallback(async (explicitTableId?: string): Promise<boolean> => {
    const targetTableId = explicitTableId ?? selectedTableId
    if (!targetTableId || cart.length === 0 || submitInFlightRef.current) return false
    if (tables.find((t) => t.id === targetTableId)?.status === "bill-requested") {
      setError("Masa hesap kesiminde. Hesap penceresi kapatılmadan sipariş gönderilemez.")
      return false
    }
    const token = getToken()
    if (!token) return false
    submitInFlightRef.current = true
    setError(null)
    try {
      await api.orders.create(token, {
        tableId: targetTableId,
        items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity, note: i.note })),
      })
      await refreshData()
      setCart([])
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sipariş gönderilemedi")
      return false
    } finally {
      submitInFlightRef.current = false
    }
  }, [cart, selectedTableId, tables, refreshData])

  const printReceipt = useCallback(async (tableId: string) => {
    const token = getToken()
    if (!token) throw new Error("Oturum yok")
    await api.orders.printReceipt(token, { tableId })
  }, [])

  const runServerMutation = useCallback(async (fn: (token: string) => Promise<unknown>): Promise<boolean> => {
    const token = getToken()
    if (!token) return false
    try { await fn(token); await refreshData(); return true } catch { return false }
  }, [refreshData])

  const requestBill = useCallback((tableId: string) => runServerMutation((t) => api.orders.printReceipt(t, { tableId })), [runServerMutation])
  const closeTable = useCallback((tableId: string, method: PaymentMethod = "cash") => runServerMutation((t) => api.tables.closeCheck(t, tableId, { method })), [runServerMutation])
  const moveTable = useCallback((fromTableId: string, toTableId: string) => runServerMutation((t) => api.orders.move(t, fromTableId, toTableId)), [runServerMutation])
  const moveOrderItemsToTable = useCallback((fromTableId: string, toTableId: string, itemIds: string[]) => {
    if (itemIds.length === 0) return Promise.resolve(false)
    return runServerMutation((t) => api.orders.moveItems(t, { fromTableId, toTableId, itemIds }))
  }, [runServerMutation])
  const cancelOrderItemOnServer = useCallback(
    (orderId: string, itemId: string, reason = "Terminal iptali") =>
      runServerMutation((t) => api.orders.cancelItem(t, orderId, itemId, reason)),
    [runServerMutation]
  )
  const hasPermission = useCallback(
    (perm: string): boolean => {
      if (!currentUser) return false
      if (!currentUser.permissions) return true
      return currentUser.permissions.includes(perm)
    },
    [currentUser]
  )
  const processPayment = useCallback((orderId: string, method: PaymentMethod, amount?: number) => {
    const tableId = orders.find((o) => o.id === orderId)?.tableId ?? selectedTableId
    if (!tableId) return Promise.resolve(false)
    return runServerMutation((t) => api.tables.closeCheck(t, tableId, { method, paidAmount: amount }))
  }, [orders, selectedTableId, runServerMutation])

  const getTableOrders = useCallback((tableId: string) => orders.filter((o) => o.tableId === tableId && o.status === "active"), [orders])
  const getTableTotal = useCallback(
    (tableId: string) => orders.filter((o) => o.tableId === tableId && o.status === "active").reduce((sum, o) => sum + calculateOrderItemsTotal(o.items), 0),
    [orders]
  )

  return (
    <TerminalContext.Provider
      value={{
        currentUser, isLoggedIn, isOffline, restaurant, activeScreen, tables, categories, products, orders,
        selectedTable, cart, selectedCategory, isLoading, error, login, loginWithPin, logout, logoutRestaurant,
        toggleOffline, refreshData, setActiveScreen, selectTable, releaseTableSession, selectCategory, addToCart,
        removeFromCart, updateCartQuantity, updateCartNote, clearCart, submitOrder, requestBill, closeTable,
        moveTable, moveOrderItemsToTable, cancelOrderItemOnServer, processPayment, printReceipt, hasPermission, getTableOrders,
        getTableTotal, getCartTotal, getCartItemCount,
      }}
    >
      {children}
    </TerminalContext.Provider>
  )
}

export const AppProvider = TerminalProvider

export function useTerminal() {
  const context = useContext(TerminalContext)
  if (!context) throw new Error("useTerminal must be used within TerminalProvider")
  return context
}

export const useApp = useTerminal
