import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react"
import type {
  PaymentMethod, TerminalCategory, TerminalOrder, TerminalOrderItem,
  TerminalProduct, TerminalScreen, TerminalStaffMember, TerminalTable, TerminalUser,
} from "./types"
import {
  api, getToken, setToken, clearToken, getRestaurant, setRestaurant,
  getStaffSession, setStaffSession, clearStaffSession,
  setAuthExpiredHandler, setStaffExpiredHandler, type RawTableDto, type OrderDto, type StaffSession,
} from "./api"
import { formatTitleCaseTr, translateApiError } from "./format"
import {
  calculateOrderItemsTotal, mapMenuTreeToCategoriesAndProducts,
  mapOrderDtoToTerminalOrder, mapTablesWithOrders, upsertCartItem,
} from "./terminal-mappers"
import {
  CARTS_STORAGE_KEY, LOCKED_TABLE_STORAGE_KEY,
  loadStoredCarts, saveStoredCarts, useTerminalLifecycle,
} from "./use-terminal-lifecycle"

function mapSessionToTerminalUser(s: Omit<StaffSession, "expiresAt" | "staffToken"> | null): TerminalUser | null {
  if (!s) return null
  return {
    id: s.staffId,
    name: formatTitleCaseTr(s.name),
    role: s.role,
    roleLabel: s.roleLabel,
    permissions: Array.isArray(s.permissions) ? s.permissions : [],
    limits: s.limits,
  }
}

interface TerminalContextType {
  currentUser: TerminalUser | null; users: TerminalStaffMember[]; usersError: string | null
  isLoggedIn: boolean; isOffline: boolean
  restaurant: { id: string; name: string; slug: string } | null
  activeScreen: TerminalScreen; tables: TerminalTable[]; categories: TerminalCategory[]
  products: TerminalProduct[]; orders: TerminalOrder[]; selectedTable: TerminalTable | null
  cart: TerminalOrderItem[]; selectedCategory: string | null; isLoading: boolean; error: string | null
  login: (email: string, password: string) => Promise<boolean>
  loginWithPin: (pin: string, staffId?: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void; logoutRestaurant: () => void; toggleOffline: () => void; refreshData: () => Promise<void>
  setActiveScreen: (screen: TerminalScreen) => void
  selectTable: (
    tableOrId: TerminalTable | string | null,
    force?: boolean
  ) => Promise<{ ok: boolean; holderName?: string; canForceUnlock?: boolean }>
  releaseTableSession: () => void; selectCategory: (categoryId: string | null) => void
  addToCart: (product: TerminalProduct, quantity?: number, note?: string) => void
  removeFromCart: (itemOrProductId: string) => void
  updateCartQuantity: (itemOrProductId: string, quantity: number) => void
  updateCartNote: (itemOrProductId: string, note: string) => void
  splitCartItem: (itemId: string) => string | null
  clearCart: (tableId?: string) => void
  submitOrder: (tableId?: string, noteOverrides?: Record<string, string>) => Promise<boolean>
  requestBill: (tableId: string) => Promise<boolean>
  closeTable: (tableId: string, method?: PaymentMethod) => Promise<boolean>
  moveTable: (fromTableId: string, toTableId: string) => Promise<boolean>
  moveOrderItemsToTable: (
    fromTableId: string,
    toTableId: string,
    items: Array<{ itemId: string; quantity?: number }>
  ) => Promise<boolean>
  cancelOrderItemOnServer: (
    orderId: string,
    itemId: string,
    reason?: string,
    quantity?: number
  ) => Promise<boolean>
  processPayment: (orderId: string, method: PaymentMethod, amount?: number) => Promise<boolean>
  printReceipt: (tableId: string, orderId?: string) => Promise<void>
  hasPermission: (perm: string) => boolean
  getTableOrders: (tableId: string) => TerminalOrder[]
  getTableTotal: (tableId: string) => number
  getCartTotal: () => number; getCartItemCount: () => number
}

const TerminalContext = createContext<TerminalContextType | null>(null)

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<TerminalUser | null>(() => mapSessionToTerminalUser(getStaffSession()))
  const [users, setUsers] = useState<TerminalStaffMember[]>([])
  const [usersError, setUsersError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  )
  const [restaurant, setRestaurantState] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [activeScreen, setActiveScreen] = useState<TerminalScreen>("tables")
  const [rawTables, setRawTables] = useState<RawTableDto[]>([])
  const [rawOrders, setRawOrders] = useState<OrderDto[]>([])
  const [categories, setCategories] = useState<TerminalCategory[]>([])
  const [products, setProducts] = useState<TerminalProduct[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [cartsByTableId, setCartsByTableId] = useState<Record<string, TerminalOrderItem[]>>(() => loadStoredCarts())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitInFlightRef = useRef(false)
  const lockedTableIdRef = useRef<string | null>(null)
  const pendingUnlockTableIdRef = useRef<string | null>(null)
  const currentUserRef = useRef<TerminalUser | null>(currentUser)
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => { currentUserRef.current = currentUser }, [currentUser])
  useEffect(() => { saveStoredCarts(cartsByTableId) }, [cartsByTableId])

  const cart = useMemo(
    () => (selectedTableId ? cartsByTableId[selectedTableId] ?? [] : []),
    [cartsByTableId, selectedTableId]
  )
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

  const refreshLiveState = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      const [tablesRes, ordersRes] = await Promise.all([
        api.tables.list(token),
        api.orders.list(token),
      ])
      setRawTables(tablesRes)
      setRawOrders(ordersRes)
    } catch {
      /* ignore background sync errors */
    }
  }, [])

  const refreshData = useCallback(async () => {
    const token = getToken()
    if (!token) return
    setIsLoading(true)
    setError(null)
    setUsersError(null)
    try {
      const [tablesRes, ordersRes, menuRes, staffUsersRes] = await Promise.all([
        api.tables.list(token),
        api.orders.list(token),
        api.menu.terminal(token).catch(() => null),
        api.staff.listTerminalUsers(token).catch((err: unknown) => {
          setUsersError(translateApiError(err, "Personel listesi yüklenemedi"))
          return null
        }),
      ])
      setRawTables(tablesRes)
      setRawOrders(ordersRes)
      if (staffUsersRes) {
        setUsers(staffUsersRes.map((u) => ({ ...u, name: formatTitleCaseTr(u.name) })))
      }
      if (menuRes) {
        const mapped = mapMenuTreeToCategoriesAndProducts(menuRes.categories)
        setCategories(mapped.categories)
        setProducts(mapped.products)
        setSelectedCategory((prev) => prev ?? mapped.categories.find((c) => !c.parentId)?.id ?? null)
      }
      setCurrentUser(mapSessionToTerminalUser(getStaffSession()))
    } catch (err) {
      setError(translateApiError(err, "Veri yüklenemedi"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = getToken()
    const rest = getRestaurant()
    if (token && rest) {
      const leftoverLockedId = sessionStorage.getItem(LOCKED_TABLE_STORAGE_KEY)
      if (leftoverLockedId) {
        sessionStorage.removeItem(LOCKED_TABLE_STORAGE_KEY)
        void api.tables.sessionUnlock(token, leftoverLockedId).catch(() => undefined)
      }
      setIsLoggedIn(true)
      setRestaurantState(rest)
      void refreshData()
    }
  }, [refreshData])

  const releaseTableSession = useCallback(() => {
    const tableId = lockedTableIdRef.current ?? pendingUnlockTableIdRef.current
    const user = currentUserRef.current
    const token = getToken()
    lockedTableIdRef.current = null
    sessionStorage.removeItem(LOCKED_TABLE_STORAGE_KEY)
    setSelectedTableId(null)
    if (!tableId || !user || !token) return
    void api.tables.sessionUnlock(token, tableId).then(() => {
      pendingUnlockTableIdRef.current = null
      void pullTables()
    }).catch(() => { /* keep pendingUnlockTableIdRef for retry */ })
  }, [pullTables])

  const logout = useCallback(() => {
    releaseTableSession()
    clearStaffSession()
    setCurrentUser(null)
    setCartsByTableId({})
    sessionStorage.removeItem(CARTS_STORAGE_KEY)
    setError(null)
    setActiveScreen("tables")
  }, [releaseTableSession])

  useTerminalLifecycle({
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
  })

  const logoutRestaurant = useCallback(() => {
    releaseTableSession(); clearToken(); clearStaffSession()
    sessionStorage.removeItem(CARTS_STORAGE_KEY)
    setIsLoggedIn(false); setRestaurantState(null); setCurrentUser(null); setUsers([]); setActiveScreen("tables")
    setRawTables([]); setRawOrders([]); setCategories([]); setProducts([]); setCartsByTableId({}); setError(null)
  }, [releaseTableSession])

  useEffect(() => {
    setAuthExpiredHandler(logoutRestaurant)
    setStaffExpiredHandler(() => {
      clearStaffSession(); setCurrentUser(null); setSelectedTableId(null); setActiveScreen("tables")
      lockedTableIdRef.current = null; pendingUnlockTableIdRef.current = null
      sessionStorage.removeItem(LOCKED_TABLE_STORAGE_KEY)
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
      setError(translateApiError(err, "Giriş başarısız"))
      return false
    }
  }, [refreshData])

  const loginWithPin = useCallback(async (pin: string, staffId?: string): Promise<{ ok: boolean; error?: string }> => {
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
  }, [])

  const selectTable = useCallback(async (
    tableOrId: TerminalTable | string | null,
    force = false
  ): Promise<{ ok: boolean; holderName?: string; canForceUnlock?: boolean }> => {
    if (!tableOrId) { releaseTableSession(); return { ok: true } }
    const tableId = typeof tableOrId === "string" ? tableOrId : tableOrId.id
    if (!navigator.onLine) {
      return { ok: false, holderName: "İnternet bağlantısı yok. Masa açılamadı." }
    }
    const user = currentUserRef.current
    const token = getToken()
    if (!user) return { ok: false, holderName: "Garson seçilmedi" }
    if (!token) return { ok: false, holderName: "Bağlantı yok" }
    const prevLocked = lockedTableIdRef.current
    if (prevLocked && prevLocked !== tableId) {
      void api.tables.sessionUnlock(token, prevLocked).catch(() => undefined)
    }
    try {
      const res = await api.tables.sessionLock(token, tableId, force)
      if (!res.ok) return { ok: false, holderName: res.holderName, canForceUnlock: res.canForceUnlock }
      lockedTableIdRef.current = tableId
      pendingUnlockTableIdRef.current = tableId
      sessionStorage.setItem(LOCKED_TABLE_STORAGE_KEY, tableId)
      setSelectedTableId(tableId)
      void pullTables()
      return { ok: true }
    } catch (err) {
      return { ok: false, holderName: translateApiError(err, "Masa kilitlenemedi") }
    }
  }, [pullTables, releaseTableSession])

  const toggleOffline = useCallback(() => {
    setIsOffline(typeof navigator !== "undefined" ? !navigator.onLine : false)
  }, [])
  const selectCategory = useCallback((categoryId: string | null) => setSelectedCategory(categoryId), [])

  const updateActiveTableCart = useCallback(
    (updater: (prev: TerminalOrderItem[]) => TerminalOrderItem[], explicitTableId?: string) => {
      const tid = explicitTableId ?? selectedTableId
      if (!tid) return
      setCartsByTableId((prev) => {
        const current = prev[tid] ?? []
        const next = updater(current)
        if (next.length === 0) {
          const copy = { ...prev }
          delete copy[tid]
          return copy
        }
        return { ...prev, [tid]: next }
      })
    },
    [selectedTableId]
  )

  const addToCart = useCallback((product: TerminalProduct, quantity = 1, note?: string) => {
    updateActiveTableCart((prev) => upsertCartItem(prev, product, quantity, note))
  }, [updateActiveTableCart])
  const removeFromCart = useCallback((id: string) => {
    updateActiveTableCart((prev) => prev.filter((i) => i.id !== id && i.product.id !== id))
  }, [updateActiveTableCart])
  const updateCartQuantity = useCallback((id: string, quantity: number) => {
    updateActiveTableCart((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.id !== id && i.product.id !== id)
        : prev.map((i) => (i.id === id || i.product.id === id ? { ...i, quantity } : i))
    )
  }, [updateActiveTableCart])
  const updateCartNote = useCallback((id: string, note: string) => {
    const cleaned = note.trim()
    updateActiveTableCart((prev) =>
      prev.map((i) => (i.id === id || i.product.id === id ? { ...i, note: cleaned || undefined } : i))
    )
  }, [updateActiveTableCart])
  const splitCartItem = useCallback((itemId: string): string | null => {
    let createdId: string | null = null
    updateActiveTableCart((prev) => {
      const idx = prev.findIndex((i) => i.id === itemId)
      if (idx === -1 || prev[idx].quantity <= 1) return prev
      const target = prev[idx]
      const newId = `cart-${target.product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      createdId = newId
      const next = [...prev]
      next[idx] = { ...target, quantity: target.quantity - 1 }
      next.splice(idx + 1, 0, {
        id: newId,
        product: target.product,
        quantity: 1,
        note: undefined,
        status: "pending",
      })
      return next
    })
    return createdId
  }, [updateActiveTableCart])
  const clearCart = useCallback((explicitTableId?: string) => {
    updateActiveTableCart(() => [], explicitTableId)
  }, [updateActiveTableCart])
  const getCartTotal = useCallback(() => calculateOrderItemsTotal(cart), [cart])
  const getCartItemCount = useCallback(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])

  const submitOrder = useCallback(async (
    explicitTableId?: string,
    noteOverrides?: Record<string, string>
  ): Promise<boolean> => {
    const targetTableId = explicitTableId ?? selectedTableId
    const targetCart = targetTableId ? (cartsByTableId[targetTableId] ?? []) : []
    if (!targetTableId || targetCart.length === 0 || submitInFlightRef.current) return false
    if (!navigator.onLine) {
      setError("İnternet bağlantısı yok. Bağlantı geldiğinde tekrar deneyin; sepetiniz korunuyor.")
      return false
    }
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
        items: targetCart.map((i) => {
          const override = noteOverrides?.[i.id] ?? noteOverrides?.[i.product.id]
          const finalNote = (override !== undefined ? override : i.note)?.trim() || undefined
          return { productId: i.product.id, quantity: i.quantity, note: finalNote }
        }),
      })
      clearCart(targetTableId)
      await refreshLiveState()
      return true
    } catch (err) {
      setError(translateApiError(err, "Sipariş gönderilemedi"))
      return false
    } finally {
      submitInFlightRef.current = false
    }
  }, [cartsByTableId, selectedTableId, tables, clearCart, refreshLiveState])

  const printReceipt = useCallback(async (tableId: string, orderId?: string) => {
    const token = getToken()
    if (!token) throw new Error("Oturum yok")
    await api.orders.printReceipt(token, orderId ? { tableId, orderId } : { tableId })
  }, [])

  const runServerMutation = useCallback(async (fn: (token: string) => Promise<unknown>): Promise<boolean> => {
    const token = getToken()
    if (!token) return false
    setError(null)
    try {
      await fn(token)
      await refreshLiveState()
      return true
    } catch (err) {
      setError(translateApiError(err, "İşlem gerçekleştirilemedi"))
      return false
    }
  }, [refreshLiveState])

  const requestBill = useCallback((tableId: string) => runServerMutation((t) => api.orders.printReceipt(t, { tableId })), [runServerMutation])
  const closeTable = useCallback((tableId: string, method: PaymentMethod = "cash") => runServerMutation((t) => api.orders.closeCheck(t, { tableId, method })), [runServerMutation])
  const moveTable = useCallback((fromTableId: string, toTableId: string) => runServerMutation((t) => api.orders.move(t, fromTableId, toTableId)), [runServerMutation])
  const moveOrderItemsToTable = useCallback((
    fromTableId: string,
    toTableId: string,
    items: Array<{ itemId: string; quantity?: number }>
  ) => {
    if (items.length === 0) return Promise.resolve(false)
    return runServerMutation((t) => api.orders.moveItems(t, { fromTableId, toTableId, items }))
  }, [runServerMutation])
  const cancelOrderItemOnServer = useCallback(
    (orderId: string, itemId: string, reason = "Terminal iptali", quantity?: number) =>
      runServerMutation((t) => api.orders.cancelItem(t, orderId, itemId, reason, quantity)),
    [runServerMutation]
  )
  const hasPermission = useCallback(
    (perm: string): boolean => {
      if (!currentUser || !Array.isArray(currentUser.permissions)) return false
      return currentUser.permissions.includes(perm)
    },
    [currentUser]
  )
  const processPayment = useCallback((orderId: string, method: PaymentMethod) => {
    const tableId = orders.find((o) => o.id === orderId)?.tableId ?? selectedTableId
    if (!tableId) return Promise.resolve(false)
    return runServerMutation((t) => api.orders.closeCheck(t, { tableId, method }))
  }, [orders, selectedTableId, runServerMutation])

  const getTableOrders = useCallback((tableId: string) => orders.filter((o) => o.tableId === tableId && o.status === "active"), [orders])
  const getTableTotal = useCallback(
    (tableId: string) => {
      const matched = tables.find((t) => t.id === tableId)
      if (matched) return matched.currentTotal
      return orders.filter((o) => o.tableId === tableId && o.status === "active").reduce((sum, o) => sum + calculateOrderItemsTotal(o.items), 0)
    },
    [orders, tables]
  )

  return (
    <TerminalContext.Provider
      value={{
        currentUser, users, usersError, isLoggedIn, isOffline, restaurant, activeScreen, tables, categories, products, orders,
        selectedTable, cart, selectedCategory, isLoading, error, login, loginWithPin, logout, logoutRestaurant,
        toggleOffline, refreshData, setActiveScreen, selectTable, releaseTableSession, selectCategory, addToCart,
        removeFromCart, updateCartQuantity, updateCartNote, splitCartItem, clearCart, submitOrder, requestBill, closeTable,
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
