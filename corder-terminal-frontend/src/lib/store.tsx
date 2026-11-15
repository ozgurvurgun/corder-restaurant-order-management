import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react"
import type { Socket } from "socket.io-client"
import type { User, Table, Order, OrderItem, CartItem } from "./types"
import { KitchenService, PrinterService } from "./services"
import {
  api,
  getToken,
  setToken,
  clearToken,
  getRestaurant,
  setRestaurant,
  getStaffSession,
  setStaffSession,
  clearStaffSession,
  getBase,
  setAuthExpiredHandler,
  setStaffExpiredHandler,
} from "./api"
import type { OrderDto } from "./api"

interface RawTable {
  id: string
  name: string
  section: string
  status: string
  sessionStaffId?: string | null
  sessionStaffName?: string | null
  sessionLockedAt?: string | null
}

const SESSION_LOCK_STALE_MS = 120_000

function orderDtoToOrder(d: OrderDto): Order {
  return {
    id: d.id,
    tableId: d.tableId,
    userId: d.userId ?? "",
    userName: d.userName?.trim() || undefined,
    items: d.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      price: i.price,
      quantity: i.quantity,
      note: i.note,
      status: i.status as OrderItem["status"],
      createdAt: new Date(i.createdAt),
      sentAt: i.status === "sent" ? new Date(i.createdAt) : undefined,
    })),
    status: d.status as Order["status"],
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
    mergedFrom: d.mergedFrom ?? undefined,
  }
}

function deriveTables(rawTables: RawTable[], orders: Order[]): Table[] {
  const activeOrders = orders.filter((o) => o.status === "active")
  return rawTables.map((t) => {
    const tableOrders = activeOrders.filter((o) => o.tableId === t.id)
    const isCheckoutLocked = t.status === "checkout"
    const totalAmount = tableOrders.reduce(
      (sum, o) => sum + o.items.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.price * i.quantity, 0),
      0
    )
    const lastOrder = [...tableOrders].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]
    const waiter = lastOrder?.userName?.trim() || undefined
    const sid = t.sessionStaffId?.trim()
    const lockedAt = t.sessionLockedAt ? new Date(t.sessionLockedAt) : null
    const isStale = !lockedAt || Date.now() - lockedAt.getTime() > SESSION_LOCK_STALE_MS
    const focusLock = sid && !isStale
      ? {
          staffId: sid,
          staffName: (t.sessionStaffName ?? "Garson").trim() || "Garson",
        }
      : undefined
    return {
      id: t.id,
      name: t.name,
      section: t.section,
      status: tableOrders.length === 0 ? ("empty" as const) : (isCheckoutLocked ? ("checkout" as const) : ("occupied" as const)),
      activeOrderId: lastOrder?.id,
      waiter,
      focusLock,
      totalAmount,
      orderCount: tableOrders.length,
      lastUpdated: lastOrder ? new Date(lastOrder.updatedAt) : undefined,
    }
  })
}

interface AppState {
  currentUser: User | null
  isLoggedIn: boolean
  isOffline: boolean
  restaurant: { id: string; name: string; slug: string } | null
  tables: Table[]
  orders: Order[]
  cart: CartItem[]
  activeTableId: string | null
  loadError: string | null
}

interface AppContextType extends AppState {
  login: (email: string, password: string) => Promise<boolean>
  verifyStaffPin: (pin: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  staffLogout: () => void
  toggleOffline: () => void
  refreshData: () => Promise<void>
  selectTable: (tableId: string) => void
  moveTable: (fromTableId: string, toTableId: string) => Promise<boolean>
  moveOrderItems: (fromTableId: string, toTableId: string, itemIds: string[]) => Promise<boolean>
  addToCart: (item: CartItem) => void
  removeFromCart: (productId: string) => void
  updateCartQuantity: (productId: string, quantity: number) => void
  updateCartNote: (productId: string, note: string) => void
  clearCart: () => void
  getCartTotal: () => number
  sendOrder: (tableId: string) => Promise<boolean>
  getTableOrders: (tableId: string) => Order[]
  getTableTotal: (tableId: string) => number
  cancelOrderItem: (orderId: string, itemId: string) => void
  undoLastAction: () => void
  lastAction: { type: string; data: unknown } | null
  printReceipt: (tableId: string) => Promise<void>
  /** Mark the table as in-use on this device; other waiters are blocked. */
  requestTableFocus: (tableId: string) => Promise<{ ok: boolean; holderName?: string }>
  /** Release the lock when returning to tables or when the session ends. */
  releaseTableFocus: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const session = getStaffSession()
    return session ? { id: session.staffId, name: session.name, role: session.role } : null
  })
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [restaurant, setRestaurantState] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [rawTables, setRawTables] = useState<RawTable[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeTableId, setActiveTableId] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<{ type: string; data: unknown } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const sendOrderFlightRef = useRef(false)
  const focusTableIdRef = useRef<string | null>(null)
  // Kept until unlock succeeds — back button still uses this even if the API errors
  const pendingUnlockTableIdRef = useRef<string | null>(null)
  const currentUserRef = useRef<User | null>(currentUser)
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  const tables = useMemo(() => deriveTables(rawTables, orders), [rawTables, orders])

  const pullTables = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      const tablesRes = await api.tables.list(token)
      setRawTables(tablesRes)
    } catch {
      /* ignore */
    }
  }, [])

  const refreshData = useCallback(async () => {
    const token = getToken()
    if (!token) return
    setLoadError(null)
    try {
      const [tablesRes, ordersRes] = await Promise.all([
        api.tables.list(token),
        api.orders.list(token),
      ])
      setRawTables(tablesRes)
      setOrders(ordersRes.map(orderDtoToOrder))
      const session = getStaffSession()
      if (session) {
        setCurrentUser({ id: session.staffId, name: session.name, role: session.role })
      } else {
        setCurrentUser(null)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Veri yuklenemedi")
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

  // PWA / background: if the socket was missed or the tab slept, panel may have changed — refetch from API on visible
  useEffect(() => {
    if (!isLoggedIn) return
    const sync = () => {
      if (document.visibilityState === "visible") void refreshData()
    }
    const onOnline = () => void refreshData()
    document.addEventListener("visibilitychange", sync)
    window.addEventListener("online", onOnline)
    return () => {
      document.removeEventListener("visibilitychange", sync)
      window.removeEventListener("online", onOnline)
    }
  }, [isLoggedIn, refreshData])

  // Periodic backup sync (if the socket drops silently)
  useEffect(() => {
    if (!isLoggedIn) return
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshData()
    }, 45000)
    return () => window.clearInterval(id)
  }, [isLoggedIn, refreshData])

  // WebSocket: instant panel/terminal sync (orders, table moves, close check)
  useEffect(() => {
    if (!isLoggedIn) return
    const token = getToken()
    const base = getBase()
    if (!token || !base) return
    let cancelled = false
    import("socket.io-client").then(({ io }) => {
      if (cancelled) return
      const socket = io(base, {
        path: "/ws",
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: Infinity,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      })
      socketRef.current = socket
      const pull = () => void refreshData()
      socket.on("order:created", pull)
      socket.on("orders:moved", pull)
      socket.on("orders:updated", pull)
      socket.on("reconnect", pull)
      socket.on("tables:presence", () => void pullTables())
      socket.on("connect", () => {
        void pull()
      })
    })
    return () => {
      cancelled = true
      const s = socketRef.current
      s?.disconnect()
      socketRef.current = null
    }
  }, [isLoggedIn, refreshData, pullTables])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoadError(null)
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
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Giris basarisiz")
      return false
    }
  }, [refreshData])

  const verifyStaffPin = useCallback(
    async (pin: string): Promise<{ ok: boolean; error?: string }> => {
      const token = getToken()
      if (!token) return { ok: false, error: "Restoran oturumu gerekli" }
      try {
        const res = await api.staff.verifyPin(token, pin)
        setStaffSession({
          staffId: res.staffId,
          name: res.name,
          role: res.role,
          staffToken: res.staffToken,
        })
        setCurrentUser({
          id: res.staffId,
          name: res.name,
          role: res.role,
        })
        return { ok: true }
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Gecersiz PIN",
        }
      }
    },
    [],
  )

  const releaseTableFocus = useCallback(() => {
    const tid = focusTableIdRef.current ?? pendingUnlockTableIdRef.current
    const u = currentUserRef.current
    const token = getToken()
    focusTableIdRef.current = null
    if (!tid || !u || !token) return
    void api.tables
      .sessionUnlock(token, tid)
      .then(() => {
        pendingUnlockTableIdRef.current = null
        void pullTables()
      })
      .catch(() => {
        // pendingUnlockTableIdRef is kept — will retry on the next logout attempt
      })
  }, [pullTables])

  const staffLogout = useCallback(() => {
    releaseTableFocus()
    clearStaffSession()
    setCurrentUser(null)
    setActiveTableId(null)
  }, [releaseTableFocus])

  const logout = useCallback(() => {
    releaseTableFocus()
    clearToken()
    clearStaffSession()
    setIsLoggedIn(false)
    setRestaurantState(null)
    setCurrentUser(null)
    setActiveTableId(null)
    setRawTables([])
    setOrders([])
    setCart([])
    setLoadError(null)
  }, [releaseTableFocus])

  useEffect(() => {
    setAuthExpiredHandler(() => {
      logout()
    })
    setStaffExpiredHandler(() => {
      clearStaffSession()
      setCurrentUser(null)
      setActiveTableId(null)
      focusTableIdRef.current = null
      pendingUnlockTableIdRef.current = null
    })
    return () => {
      setAuthExpiredHandler(null)
      setStaffExpiredHandler(null)
    }
  }, [logout])

  const requestTableFocus = useCallback(async (tableId: string): Promise<{ ok: boolean; holderName?: string }> => {
    if (isOffline) {
      focusTableIdRef.current = tableId
      return { ok: true }
    }
    const u = currentUserRef.current
    if (!u) return { ok: false, holderName: "Garson secilmedi" }
    const token = getToken()
    if (!token) return { ok: false, holderName: "Baglanti yok" }
    try {
      const r = await api.tables.sessionLock(token, tableId)
      if (!r.ok) {
        return { ok: false, holderName: r.holderName }
      }
      focusTableIdRef.current = tableId
      pendingUnlockTableIdRef.current = tableId
      void pullTables()
      return { ok: true }
    } catch (e) {
      return {
        ok: false,
        holderName: e instanceof Error && e.message ? e.message : "Baglanti yok",
      }
    }
  }, [isOffline, pullTables])

  const toggleOffline = useCallback(() => {
    setIsOffline((prev) => !prev)
  }, [])

  const selectTable = useCallback((tableId: string) => {
    setActiveTableId(tableId)
  }, [])

  const moveTable = useCallback(
    async (fromTableId: string, toTableId: string): Promise<boolean> => {
      const token = getToken()
      if (!token) return false
      try {
        await api.orders.move(token, fromTableId, toTableId)
        await refreshData()
        return true
      } catch {
        return false
      }
    },
    [refreshData]
  )

  const moveOrderItems = useCallback(
    async (fromTableId: string, toTableId: string, itemIds: string[]): Promise<boolean> => {
      const token = getToken()
      if (!token || itemIds.length === 0) return false
      try {
        await api.orders.moveItems(token, {
          fromTableId,
          toTableId,
          itemIds,
        })
        await refreshData()
        return true
      } catch {
        return false
      }
    },
    [refreshData],
  )

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === item.productId)
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i
        )
      }
      return [...prev, item]
    })
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }, [])

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId))
    } else {
      setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)))
    }
  }, [])

  const updateCartNote = useCallback((productId: string, note: string) => {
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, note } : i)))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  const getCartTotal = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [cart])

  const sendOrder = useCallback(
    async (tableId: string): Promise<boolean> => {
      if (cart.length === 0) return false
      if (sendOrderFlightRef.current) return false
      const table = tables.find((t) => t.id === tableId)
      if (table?.status === "checkout") {
        setLoadError("Masa hesap kesiminde. Hesap penceresi kapatilmadan siparis gonderilemez.")
        return false
      }
      const token = getToken()
      if (!token) return false
      sendOrderFlightRef.current = true
      setLoadError(null)
      try {
        await api.orders.create(token, {
          tableId,
          items: cart.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            price: i.price,
            quantity: i.quantity,
            note: i.note,
          })),
        })
        await refreshData()
        const tableName = tables.find((t) => t.id === tableId)?.name ?? tableId
        const itemsForPrint = cart.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          price: i.price,
          quantity: i.quantity,
          note: i.note,
        }))
        await KitchenService.sendOrder(tableId, itemsForPrint)
        await PrinterService.printKitchenTicket(tableName, itemsForPrint)
        setCart([])
        return true
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Siparis gonderilemedi")
        return false
      } finally {
        sendOrderFlightRef.current = false
      }
    },
    [cart, tables, refreshData]
  )

  const getTableOrders = useCallback(
    (tableId: string) => orders.filter((o) => o.tableId === tableId && o.status === "active"),
    [orders]
  )

  const getTableTotal = useCallback(
    (tableId: string) =>
      orders
        .filter((o) => o.tableId === tableId && o.status === "active")
        .reduce(
          (sum, o) =>
            sum + o.items.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.price * i.quantity, 0),
          0
        ),
    [orders]
  )

  const cancelOrderItem = useCallback((orderId: string, itemId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, status: "cancelled" as const } : i)) }
          : o
      )
    )
    setLastAction({ type: "cancelItem", data: { orderId, itemId } })
  }, [])

  const undoLastAction = useCallback(() => {
    if (!lastAction) return
    if (lastAction.type === "cancelItem") {
      const { orderId, itemId } = lastAction.data as { orderId: string; itemId: string }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, status: "sent" as const } : i)) }
            : o
        )
      )
    }
    setLastAction(null)
  }, [lastAction])

  const printReceipt = useCallback(async (tableId: string) => {
    await PrinterService.printReceipt(tableId)
  }, [])

  const value = useMemo<AppContextType>(
    () => ({
      currentUser,
      isLoggedIn,
      isOffline,
      restaurant,
      tables,
      orders,
      cart,
      activeTableId,
      loadError,
      login,
      verifyStaffPin,
      logout,
      staffLogout,
      toggleOffline,
      refreshData,
      selectTable,
      moveTable,
      moveOrderItems,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      updateCartNote,
      clearCart,
      getCartTotal,
      sendOrder,
      getTableOrders,
      getTableTotal,
      cancelOrderItem,
      undoLastAction,
      lastAction,
      printReceipt,
      requestTableFocus,
      releaseTableFocus,
    }),
    [
      currentUser,
      isLoggedIn,
      isOffline,
      restaurant,
      tables,
      orders,
      cart,
      activeTableId,
      loadError,
      login,
      verifyStaffPin,
      logout,
      staffLogout,
      toggleOffline,
      refreshData,
      selectTable,
      moveTable,
      moveOrderItems,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      updateCartNote,
      clearCart,
      getCartTotal,
      sendOrder,
      getTableOrders,
      getTableTotal,
      cancelOrderItem,
      undoLastAction,
      lastAction,
      printReceipt,
      requestTableFocus,
      releaseTableFocus,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("useApp must be used within AppProvider")
  return context
}
