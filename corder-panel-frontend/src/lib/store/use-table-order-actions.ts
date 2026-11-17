import { useCallback } from "react"
import {
  itemCountsTowardBill,
  type AuditLog,
  type CancelledItem,
  type CashShift,
  type CloseCheckSplitMethod,
  type ClosedTable,
  type PanelDiscountType,
  type PanelOrder,
  type PanelPaymentMethod,
  type PanelSection,
  type PanelTable,
  type PanelUser,
} from "../panel-types"
import { api, type CloseCheckResponseDto } from "../api"
import { computeDiscountMinorUnits, fromMinorUnits, toMinorUnits } from "../format"
import {
  mapApiOrdersToPanel,
  mapApiTablesToPanel,
  mapOrder,
  mergeTablesPreserveClientFields,
} from "../mappers/orders-tables.mapper"
import { showPanelToast } from "@/components/panel/panel-toast"
import type { LogActivityFn } from "./panel-store-context"
import { useTableSettlementActions } from "./use-table-settlement-actions"

export function useTableOrderActions(params: {
  token: string | null
  restaurantId?: string | null
  currentUser: PanelUser | null
  currentShift: CashShift | null
  tables: PanelTable[]
  orders: PanelOrder[]
  users: PanelUser[]
  sections: PanelSection[]
  setTables: (v: PanelTable[] | ((prev: PanelTable[]) => PanelTable[])) => void
  setOrders: (v: PanelOrder[] | ((prev: PanelOrder[]) => PanelOrder[])) => void
  setSections: (v: PanelSection[] | ((prev: PanelSection[]) => PanelSection[])) => void
  setCancelledItems: (v: CancelledItem[] | ((prev: CancelledItem[]) => CancelledItem[])) => void
  applyCloseCheckResult: (res: CloseCheckResponseDto) => ClosedTable
  ledgerRefresh: () => Promise<void>
  logActivity: LogActivityFn
  addAuditLog: (log: Omit<AuditLog, "id" | "createdAt">) => void
}) {
  const {
    token,
    restaurantId,
    currentUser,
    currentShift,
    tables,
    orders,
    users,
    sections,
    setTables,
    setOrders,
    setSections,
    setCancelledItems,
    applyCloseCheckResult,
    ledgerRefresh,
    logActivity,
    addAuditLog,
  } = params

  const syncOrdersAndTablesFromServer = useCallback(async () => {
    if (!token) return
    const [freshOrdersDto, freshTablesDto] = await Promise.all([
      api.orders.list(token).catch(() => null),
      api.tables.list(token).catch(() => null),
    ])
    if (freshOrdersDto) {
      const freshOrders = mapApiOrdersToPanel(freshOrdersDto)
      setOrders(freshOrders)
      if (freshTablesDto) {
        const mappedTables = mapApiTablesToPanel(freshTablesDto, freshOrders, users)
        setTables((prev) => mergeTablesPreserveClientFields(prev, mappedTables))
      }
    }
  }, [token, users, setOrders, setTables])

  const getTableOrders = useCallback(
    (tableId: string) => orders.filter((o) => o.tableId === tableId && o.status === "active"),
    [orders],
  )
  const getTableTotal = useCallback(
    (tableId: string) =>
      fromMinorUnits(
        orders
          .filter((o) => o.tableId === tableId && o.status === "active")
          .reduce(
            (sum, o) =>
              sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + toMinorUnits(i.price) * i.quantity, 0),
            0,
          ),
      ),
    [orders],
  )

  const moveTable = useCallback(
    async (fromId: string, toId: string): Promise<boolean> => {
      if (!token) return false
      try {
        await api.orders.move(token, fromId, toId)
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Masa taşınamadı", "error")
        return false
      }
      const fromName = tables.find((t) => t.id === fromId)?.name || fromId
      await syncOrdersAndTablesFromServer()
      logActivity({
        action: "table_moved",
        category: "table",
        details: `${fromName} masasındaki adisyon ${toId} masaya taşındı`,
        metadata: { fromId, toId },
      })
      return true
    },
    [token, tables, syncOrdersAndTablesFromServer, logActivity],
  )

  const moveOrderItems = useCallback(
    async (
      fromTableId: string,
      toTableId: string,
      itemIds: string[],
      quantity?: number,
    ): Promise<boolean> => {
      if (!token || itemIds.length === 0) return false
      try {
        await api.orders.moveItems(token, {
          fromTableId,
          toTableId,
          items: itemIds.map((itemId, idx) => ({
            itemId,
            ...(idx === 0 && quantity != null ? { quantity } : {}),
          })),
        })
        await syncOrdersAndTablesFromServer()
        logActivity({
          action: "order_items_moved",
          category: "order",
          details: `${itemIds.length} kalem başka masaya taşındı`,
          metadata: { fromTableId, toTableId, itemIds, ...(quantity != null ? { quantity } : {}) },
        })
        return true
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Ürünler taşınamadı", "error")
        return false
      }
    },
    [token, syncOrdersAndTablesFromServer, logActivity],
  )

  const closeTableWithPayment = useCallback(
    async (
      tableId: string,
      method: PanelPaymentMethod,
      discount?: { type: PanelDiscountType; value: number; reason: string },
      splitDetails?: { method: CloseCheckSplitMethod; amount: number }[],
      opts?: {
        ledgerCustomerId?: string
        ledgerDebtAmount?: number
        tip?: number
        lines?: { itemId: string; quantity: number }[]
      },
    ): Promise<{
      ok: boolean
      completedOrder?: ClosedTable
      tableFullyClosed?: boolean
      error?: string
    }> => {
      if (!token) return { ok: false, error: "Oturum gerekli" }
      const table = tables.find((t) => t.id === tableId)
      if (!table) return { ok: false, error: "Masa bulunamadı" }
      if (method === "ledger" && !opts?.ledgerCustomerId) {
        return { ok: false, error: "Müşteri hesabı seçilmelidir" }
      }

      const effectiveDiscount: { type: "percent" | "amount"; value: number; reason: string } | undefined =
        discount && (discount.type === "complimentary" || discount.value > 0)
          ? discount.type === "complimentary"
            ? { type: "percent", value: 100, reason: discount.reason }
            : { type: discount.type, value: discount.value, reason: discount.reason }
          : undefined

      try {
        const res = await api.orders.closeCheck(token, {
          tableId,
          method,
          ...(opts?.lines?.length ? { lines: opts.lines } : {}),
          ...(effectiveDiscount ? { discount: effectiveDiscount } : {}),
          ...(splitDetails?.length ? { splitDetails } : {}),
          ...(opts?.ledgerCustomerId ? { ledgerCustomerId: opts.ledgerCustomerId } : {}),
          ...(opts?.ledgerDebtAmount != null && Number.isFinite(opts.ledgerDebtAmount)
            ? { ledgerDebtAmount: opts.ledgerDebtAmount }
            : {}),
          ...(opts?.tip != null && Number.isFinite(opts.tip) && opts.tip > 0 ? { tip: opts.tip } : {}),
        })
        const mapped = applyCloseCheckResult(res)
        if (res.tableFullyClosed === false) {
          await syncOrdersAndTablesFromServer()
        } else {
          setOrders((prev) =>
            prev.map((o) => (o.tableId === tableId && o.status === "active" ? { ...o, status: "closed" as const } : o)),
          )
          setTables((prev) =>
            prev.map((t) =>
              t.id === tableId
                ? {
                    ...t,
                    status: "empty" as const,
                    waiter: undefined,
                    totalAmount: 0,
                    orderCount: 0,
                    lastUpdated: undefined,
                    activeOrderId: undefined,
                    discount: undefined,
                    splitInfo: undefined,
                  }
                : t,
            ),
          )
        }
        if (opts?.ledgerCustomerId) void ledgerRefresh()
        logActivity({
          action: res.tableFullyClosed === false ? "table_partial_checkout" : "table_closed_with_payment",
          category: "payment",
          details: `${mapped.tableName} ${res.tableFullyClosed === false ? "kısmi ödeme alındı" : "kapatıldı"}. Yöntem: ${method}, Net: ${mapped.netAmount}`,
          metadata: {
            tableId,
            tableName: mapped.tableName,
            method,
            rawTotal: mapped.totalAmount,
            discountAmount: mapped.discountAmount,
            netAmount: mapped.netAmount,
            orderCount: mapped.orders.length,
            tableFullyClosed: res.tableFullyClosed !== false,
          },
        })
        return { ok: true, completedOrder: mapped, tableFullyClosed: res.tableFullyClosed !== false }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Hesap kapatılamadı"
        showPanelToast(msg, "error")
        return { ok: false, error: msg }
      }
    },
    [token, tables, applyCloseCheckResult, syncOrdersAndTablesFromServer, setOrders, setTables, ledgerRefresh, logActivity],
  )

  const addQuickSale = useCallback(
    async (
      items: { productId: string; quantity: number; note?: string }[],
      method: PanelPaymentMethod,
    ): Promise<{ ok: boolean; completedOrder?: ClosedTable; error?: string }> => {
      if (!token) return { ok: false, error: "Oturum gerekli" }
      if (!currentShift || items.length === 0) return { ok: false, error: "Vardiya açık değil veya sepet boş" }
      try {
        const res = await api.orders.closeCheck(token, {
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            ...(i.note?.trim() ? { note: i.note.trim() } : {}),
          })),
          method,
        })
        const mapped = applyCloseCheckResult(res)
        logActivity({
          action: "quick_sale_completed",
          category: "payment",
          details: `Elden Satış tamamlandı. Yöntem: ${method}, Net: ${mapped.netAmount}`,
          metadata: { completedOrderId: mapped.id, method, netAmount: mapped.netAmount, itemCount: items.length },
        })
        return { ok: true, completedOrder: mapped }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Satış tamamlanamadı"
        showPanelToast(msg, "error")
        return { ok: false, error: msg }
      }
    },
    [token, currentShift, applyCloseCheckResult, logActivity],
  )

  const createTableOrder = useCallback(
    async (
      tableId: string,
      items: { productId: string; quantity: number; note?: string }[],
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!token) return { ok: false, error: "Oturum gerekli" }
      if (!currentShift) return { ok: false, error: "Önce vardiyayı açın" }
      if (items.length === 0) return { ok: false, error: "Sepet boş" }
      const table = tables.find((t) => t.id === tableId)
      if (table?.status === "checkout") {
        return { ok: false, error: "Masa hesap kesiminde. Hesap penceresi kapatılmadan sipariş gönderilemez." }
      }
      try {
        const cleanItems = items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          ...(i.note?.trim() ? { note: i.note.trim() } : {}),
        }))
        const createdDto = await api.orders.create(token, { tableId, items: cleanItems })
        const mapped = mapOrder(createdDto)
        const lineMinorUnits = mapped.items.filter(itemCountsTowardBill).reduce((s, i) => s + toMinorUnits(i.price) * i.quantity, 0)
        setOrders((prev) => (prev.some((o) => o.id === mapped.id) ? prev : [mapped, ...prev]))
        setTables((prev) =>
          prev.map((t) => {
            if (t.id !== tableId || t.activeOrderId === mapped.id) return t
            const rawMinorUnits = toMinorUnits(t.totalAmount || 0) + toMinorUnits(t.discount?.amount || 0) + lineMinorUnits
            const discountMinorUnits = computeDiscountMinorUnits(rawMinorUnits, t.discount)
            const nextTotal = fromMinorUnits(Math.max(0, rawMinorUnits - discountMinorUnits))
            return {
              ...t,
              status: "occupied" as const,
              totalAmount: nextTotal,
              ...(t.discount ? { discount: { ...t.discount, amount: fromMinorUnits(discountMinorUnits) } } : {}),
              orderCount: t.orderCount + 1,
              lastUpdated: mapped.updatedAt,
              activeOrderId: mapped.id,
              waiter: mapped.userName || t.waiter,
            }
          }),
        )
        logActivity({
          action: "table_order_created",
          category: "order",
          details: `${table?.name ?? tableId} masasına ${items.length} kalemli sipariş`,
          metadata: { tableId, itemCount: items.length },
        })
        return { ok: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sipariş gönderilemedi"
        showPanelToast(msg, "error")
        return { ok: false, error: msg }
      }
    },
    [token, currentShift, tables, setOrders, setTables, logActivity],
  )

  const cancelOrderItem = useCallback(
    async (
      orderId: string,
      itemId: string,
      reason: string,
      quantity?: number,
    ): Promise<boolean> => {
      const order = orders.find((o) => o.id === orderId)
      const item = order?.items.find((i) => i.id === itemId)
      const trimmedReason = reason.trim()
      if (!order || !item || !token || !trimmedReason) return false
      const effectiveQty =
        quantity != null ? Math.min(Math.max(1, Math.floor(quantity)), item.quantity) : item.quantity
      try {
        await api.orders.cancelItem(token, {
          itemId,
          reason: trimmedReason,
          ...(quantity != null ? { quantity: effectiveQty } : {}),
        })
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Ürün iptal edilemedi", "error")
        return false
      }
      const table = tables.find((t) => t.id === order.tableId)
      const cancelled: CancelledItem = {
        id: `ci-${item.id}-${Date.now()}`,
        orderItem: {
          ...item,
          quantity: effectiveQty,
          status: "cancelled",
          cancelReason: trimmedReason,
          cancelledBy: currentUser?.name,
          cancelledAt: new Date(),
        },
        tableName: table?.name || "?",
        orderId,
        reason: trimmedReason,
        cancelledBy: currentUser?.name || "Sistem",
        cancelledAt: new Date(),
      }
      setCancelledItems((prev) => [cancelled, ...prev.filter((x) => x.id !== cancelled.id)])
      await syncOrdersAndTablesFromServer()
      logActivity({
        action: "order_item_cancelled",
        category: "order",
        details: `${table?.name || "Masa"} - ${item.productName} (${effectiveQty} adet) iptal edildi (${trimmedReason})`,
        metadata: { orderId, itemId, tableId: order.tableId, quantity: effectiveQty, price: item.price, reason: trimmedReason },
      })
      return true
    },
    [orders, tables, currentUser, token, setCancelledItems, syncOrdersAndTablesFromServer, logActivity],
  )

  const assignItemsToLedger = useCallback(
    async (lines: { itemId: string; quantity?: number }[], ledgerCustomerId: string): Promise<{ ok: boolean; amount?: number }> => {
      if (!token || lines.length === 0 || !ledgerCustomerId) return { ok: false }
      try {
        const res = await api.orders.assignToLedger(token, { lines, ledgerCustomerId })
        await Promise.all([ledgerRefresh(), syncOrdersAndTablesFromServer()])
        logActivity({
          action: "order_items_assigned_to_ledger",
          category: "payment",
          details: `${lines.length} kalem müşteri hesabına aktarıldı`,
          metadata: { ledgerCustomerId, lineCount: lines.length, amount: res.amount },
        })
        return { ok: true, amount: res.amount }
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Cariye aktarılamadı", "error")
        return { ok: false }
      }
    },
    [token, ledgerRefresh, syncOrdersAndTablesFromServer, logActivity],
  )

  const revertLedgerOrderItem = useCallback(
    async (itemId: string): Promise<{ ok: boolean; amount?: number }> => {
      if (!token || !itemId) return { ok: false }
      try {
        const res = await api.orders.revertLedgerItem(token, { itemId })
        await Promise.all([ledgerRefresh(), syncOrdersAndTablesFromServer()])
        logActivity({
          action: "ledger_item_reverted_to_order",
          category: "payment",
          details: "Müşteri hesabına yazılan kalem adisyona geri alındı",
          metadata: { itemId, amount: res.amount },
        })
        return { ok: true, amount: res.amount }
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Cari kalemi geri alınamadı", "error")
        return { ok: false }
      }
    },
    [token, ledgerRefresh, syncOrdersAndTablesFromServer, logActivity],
  )

  const settlementActions = useTableSettlementActions({
    token,
    restaurantId,
    currentUser,
    tables,
    orders,
    sections,
    setTables,
    setSections,
    logActivity,
    addAuditLog,
    closeTableWithPayment,
  })

  return {
    getTableOrders,
    getTableTotal,
    moveTable,
    moveOrderItems,
    closeTableWithPayment,
    addQuickSale,
    createTableOrder,
    cancelOrderItem,
    assignItemsToLedger,
    revertLedgerOrderItem,
    ...settlementActions,
  }
}
