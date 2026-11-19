import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import type {
  PaymentMethod,
  TerminalCategory,
  TerminalOrder,
  TerminalOrderItem,
  TerminalProduct,
  TerminalScreen,
  TerminalStaffMember,
  TerminalTable,
  TerminalUser,
} from "./types"
import {
  api,
  getToken,
  getRestaurant,
  getStaffSession,
  type RawTableDto,
  type OrderDto,
} from "./api"
import { formatTitleCase, translateApiError } from "./format"
import {
  mapMenuTreeToCategoriesAndProducts,
  mapOrderDtoToTerminalOrder,
  mapTablesWithOrders,
} from "./terminal-mappers"
import {
  LOCKED_TABLE_STORAGE_KEY,
  useTerminalLifecycle,
} from "./use-terminal-lifecycle"
import { useTerminalCart } from "./use-terminal-cart"
import { useTerminalOrderActions } from "./use-terminal-order-actions"
import {
  mapSessionToTerminalUser,
  useTerminalSessionActions,
} from "./use-terminal-session-actions"
import type { ActiveWaiterCall } from "./terminal-notifications"

interface TerminalContextType {
  currentUser: TerminalUser | null
  users: TerminalStaffMember[]
  usersError: string | null
  isLoggedIn: boolean
  isOffline: boolean
  restaurant: { id: string; name: string; slug: string } | null
  activeScreen: TerminalScreen
  tables: TerminalTable[]
  categories: TerminalCategory[]
  products: TerminalProduct[]
  orders: TerminalOrder[]
  selectedTable: TerminalTable | null
  cart: TerminalOrderItem[]
  selectedCategory: string | null
  isLoading: boolean
  error: string | null
  waiterCalls: ActiveWaiterCall[]
  dismissWaiterCall: (id: string) => void
  login: (email: string, password: string) => Promise<boolean>
  loginWithPin: (pin: string, staffId?: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  logoutRestaurant: () => void
  toggleOffline: () => void
  refreshData: () => Promise<void>
  setActiveScreen: (screen: TerminalScreen) => void
  selectTable: (
    tableOrId: TerminalTable | string | null,
    force?: boolean
  ) => Promise<{ ok: boolean; holderName?: string; canForceUnlock?: boolean }>
  releaseTableSession: () => void
  selectCategory: (categoryId: string | null) => void
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
  getCartTotal: () => number
  getCartItemCount: () => number
}

const TerminalContext = createContext<TerminalContextType | null>(null)

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<TerminalUser | null>(() =>
    mapSessionToTerminalUser(getStaffSession())
  )
  const [users, setUsers] = useState<TerminalStaffMember[]>([])
  const [usersError, setUsersError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  )
  const [restaurant, setRestaurantState] = useState<{
    id: string
    name: string
    slug: string
  } | null>(null)
  const [activeScreen, setActiveScreen] = useState<TerminalScreen>("tables")
  const [rawTables, setRawTables] = useState<RawTableDto[]>([])
  const [rawOrders, setRawOrders] = useState<OrderDto[]>([])
  const [categories, setCategories] = useState<TerminalCategory[]>([])
  const [products, setProducts] = useState<TerminalProduct[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waiterCalls, setWaiterCalls] = useState<ActiveWaiterCall[]>([])

  const handleWaiterCalled = useCallback((call: ActiveWaiterCall) => {
    setWaiterCalls((prev) => {
      const withoutSameIdOrTable = prev.filter(
        (c) => c.id !== call.id && !(c.tableId === call.tableId && c.requestType === call.requestType)
      )
      return [call, ...withoutSameIdOrTable].slice(0, 20)
    })
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("corder:waiter-called", { detail: call }))
    }
  }, [])

  const dismissWaiterCall = useCallback((id: string) => {
    setWaiterCalls((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const lockedTableIdRef = useRef<string | null>(null)
  const pendingUnlockTableIdRef = useRef<string | null>(null)
  const currentUserRef = useRef<TerminalUser | null>(currentUser)
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  const cartSlice = useTerminalCart(selectedTableId)

  const productsById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  )
  const orders = useMemo(
    () =>
      rawOrders.map((dto) =>
        mapOrderDtoToTerminalOrder(dto, rawTables, productsById)
      ),
    [rawOrders, rawTables, productsById]
  )
  const tables = useMemo(
    () => mapTablesWithOrders(rawTables, orders),
    [rawTables, orders]
  )
  const selectedTable = useMemo(
    () =>
      selectedTableId
        ? tables.find((t) => t.id === selectedTableId) ?? null
        : null,
    [tables, selectedTableId]
  )

  const pullTables = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      setRawTables(await api.tables.list(token))
    } catch {
      /* ignore polling errors */
    }
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
        setUsers(staffUsersRes.map((u) => ({ ...u, name: formatTitleCase(u.name) })))
      }
      if (menuRes) {
        const mapped = mapMenuTreeToCategoriesAndProducts(menuRes.categories)
        setCategories(mapped.categories)
        setProducts(mapped.products)
        setSelectedCategory(
          (prev) => prev ?? mapped.categories.find((c) => !c.parentId)?.id ?? null
        )
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

  const sessionActions = useTerminalSessionActions({
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
    resetAllCarts: cartSlice.resetAllCarts,
    refreshData,
    pullTables,
  })

  useTerminalLifecycle({
    isLoggedIn,
    currentUser,
    users,
    selectedTableId,
    lockedTableIdRef,
    lastActivityRef,
    setIsOffline,
    refreshData,
    refreshLiveState,
    pullTables,
    logout: sessionActions.logout,
    onWaiterCalled: handleWaiterCalled,
  })

  const orderActions = useTerminalOrderActions({
    selectedTableId,
    cartsByTableId: cartSlice.cartsByTableId,
    tables,
    orders,
    clearCart: cartSlice.clearCart,
    refreshLiveState,
    setError,
  })

  const toggleOffline = useCallback(() => {
    setIsOffline(typeof navigator !== "undefined" ? !navigator.onLine : false)
  }, [])
  const selectCategory = useCallback(
    (categoryId: string | null) => setSelectedCategory(categoryId),
    []
  )
  const hasPermission = useCallback(
    (perm: string): boolean => Boolean(currentUser?.permissions?.includes(perm)),
    [currentUser]
  )

  return (
    <TerminalContext.Provider
      value={{
        currentUser,
        users,
        usersError,
        isLoggedIn,
        isOffline,
        restaurant,
        activeScreen,
        tables,
        categories,
        products,
        orders,
        selectedTable,
        cart: cartSlice.cart,
        selectedCategory,
        isLoading,
        error,
        waiterCalls,
        dismissWaiterCall,
        setActiveScreen,
        toggleOffline,
        refreshData,
        selectCategory,
        addToCart: cartSlice.addToCart,
        removeFromCart: cartSlice.removeFromCart,
        updateCartQuantity: cartSlice.updateCartQuantity,
        updateCartNote: cartSlice.updateCartNote,
        splitCartItem: cartSlice.splitCartItem,
        clearCart: cartSlice.clearCart,
        getCartTotal: cartSlice.getCartTotal,
        getCartItemCount: cartSlice.getCartItemCount,
        hasPermission,
        ...sessionActions,
        ...orderActions,
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
