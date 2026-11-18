import { useCallback, useRef } from "react"
import type {
  PaymentMethod,
  TerminalOrder,
  TerminalOrderItem,
  TerminalTable,
} from "./types"
import { api, getToken } from "./api"
import { translateApiError } from "./format"
import { calculateOrderItemsTotal } from "./terminal-mappers"

export function useTerminalOrderActions(params: {
  selectedTableId: string | null
  cartsByTableId: Record<string, TerminalOrderItem[]>
  tables: TerminalTable[]
  orders: TerminalOrder[]
  clearCart: (tableId?: string) => void
  refreshLiveState: () => Promise<void>
  setError: (err: string | null) => void
}) {
  const {
    selectedTableId,
    cartsByTableId,
    tables,
    orders,
    clearCart,
    refreshLiveState,
    setError,
  } = params
  const submitInFlightRef = useRef(false)

  const submitOrder = useCallback(
    async (
      explicitTableId?: string,
      noteOverrides?: Record<string, string>
    ): Promise<boolean> => {
      const targetTableId = explicitTableId ?? selectedTableId
      const targetCart = targetTableId ? cartsByTableId[targetTableId] ?? [] : []
      if (!targetTableId || targetCart.length === 0 || submitInFlightRef.current)
        return false
      if (!navigator.onLine) {
        setError(
          "İnternet bağlantısı yok. Bağlantı geldiğinde tekrar deneyin; sepetiniz korunuyor."
        )
        return false
      }
      if (tables.find((t) => t.id === targetTableId)?.status === "bill-requested") {
        setError(
          "Masa hesap kesiminde. Hesap penceresi kapatılmadan sipariş gönderilemez."
        )
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
            const finalNote =
              (override !== undefined ? override : i.note)?.trim() || undefined
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
    },
    [cartsByTableId, selectedTableId, tables, clearCart, refreshLiveState, setError]
  )

  const printReceipt = useCallback(async (tableId: string, orderId?: string) => {
    const token = getToken()
    if (!token) throw new Error("Oturum yok")
    await api.orders.printReceipt(token, orderId ? { tableId, orderId } : { tableId })
  }, [])

  const runServerMutation = useCallback(
    async (fn: (token: string) => Promise<unknown>): Promise<boolean> => {
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
    },
    [refreshLiveState, setError]
  )

  const requestBill = useCallback(
    (tableId: string) =>
      runServerMutation((t) => api.orders.printReceipt(t, { tableId })),
    [runServerMutation]
  )
  const closeTable = useCallback(
    (tableId: string, method: PaymentMethod = "cash") =>
      runServerMutation((t) => api.orders.closeCheck(t, { tableId, method })),
    [runServerMutation]
  )
  const moveTable = useCallback(
    (fromTableId: string, toTableId: string) =>
      runServerMutation((t) => api.orders.move(t, fromTableId, toTableId)),
    [runServerMutation]
  )
  const moveOrderItemsToTable = useCallback(
    (
      fromTableId: string,
      toTableId: string,
      items: Array<{ itemId: string; quantity?: number }>
    ) => {
      if (items.length === 0) return Promise.resolve(false)
      return runServerMutation((t) =>
        api.orders.moveItems(t, { fromTableId, toTableId, items })
      )
    },
    [runServerMutation]
  )
  const cancelOrderItemOnServer = useCallback(
    (orderId: string, itemId: string, reason = "Terminal iptali", quantity?: number) =>
      runServerMutation((t) =>
        api.orders.cancelItem(t, orderId, itemId, reason, quantity)
      ),
    [runServerMutation]
  )
  const processPayment = useCallback(
    (orderId: string, method: PaymentMethod) => {
      const tableId =
        orders.find((o) => o.id === orderId)?.tableId ?? selectedTableId
      if (!tableId) return Promise.resolve(false)
      return runServerMutation((t) => api.orders.closeCheck(t, { tableId, method }))
    },
    [orders, selectedTableId, runServerMutation]
  )
  const getTableOrders = useCallback(
    (tableId: string) =>
      orders.filter((o) => o.tableId === tableId && o.status === "active"),
    [orders]
  )
  const getTableTotal = useCallback(
    (tableId: string) => {
      const matched = tables.find((t) => t.id === tableId)
      if (matched) return matched.currentTotal
      return orders
        .filter((o) => o.tableId === tableId && o.status === "active")
        .reduce((sum, o) => sum + calculateOrderItemsTotal(o.items), 0)
    },
    [orders, tables]
  )

  return {
    submitOrder,
    printReceipt,
    requestBill,
    closeTable,
    moveTable,
    moveOrderItemsToTable,
    cancelOrderItemOnServer,
    processPayment,
    getTableOrders,
    getTableTotal,
  }
}

