import { useCallback } from "react"
import {
  itemCountsTowardBill,
  type AuditLog, type CancelledItem, type CashShift, type CloseCheckSplitMethod,
  type ClosedTable, type PanelDiscountType, type PanelOrder, type PanelPaymentMethod,
  type PanelSection, type PanelTable, type PanelUser,
} from "../panel-types"
import { api, type CloseCheckResponseDto } from "../api"
import { genId } from "./panel-local-storage"
import type { LogActivityFn } from "./panel-store-context"

export function useTableOrderActions(params: {
  token: string | null
  currentUser: PanelUser | null
  currentShift: CashShift | null
  tables: PanelTable[]
  orders: PanelOrder[]
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
    token, currentUser, currentShift, tables, orders,
    setTables, setOrders, setSections, setCancelledItems,
    applyCloseCheckResult, ledgerRefresh, logActivity, addAuditLog,
  } = params

  const getTableOrders = useCallback(
    (tableId: string) => orders.filter((o) => o.tableId === tableId && o.status === "active"),
    [orders],
  )

  const getTableTotal = useCallback(
    (tableId: string) =>
      orders
        .filter((o) => o.tableId === tableId && o.status === "active")
        .reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + i.price * i.quantity, 0), 0),
    [orders],
  )

  const moveTable = useCallback(async (fromId: string, toId: string): Promise<boolean> => {
    if (!token) return false
    try { await api.orders.move(token, fromId, toId) } catch { return false }
    const fromName = tables.find((t) => t.id === fromId)?.name || fromId
    setOrders((prev) => prev.map((o) => (o.tableId === fromId && o.status === "active" ? { ...o, tableId: toId, mergedFrom: fromName } : o)))
    setTables((prev) => {
      const from = prev.find((t) => t.id === fromId)
      const to = prev.find((t) => t.id === toId)
      if (!from) return prev
      return prev.map((t) => {
        if (t.id === fromId) return { ...t, status: "empty" as const, waiter: undefined, totalAmount: 0, orderCount: 0, lastUpdated: undefined, activeOrderId: undefined, discount: undefined, splitInfo: undefined }
        if (t.id === toId) {
          if (to?.status === "occupied") return { ...t, totalAmount: (to.totalAmount || 0) + from.totalAmount, orderCount: (to.orderCount || 0) + from.orderCount, lastUpdated: new Date() }
          return { ...t, status: from.status, waiter: from.waiter, totalAmount: from.totalAmount, orderCount: from.orderCount, lastUpdated: new Date(), activeOrderId: from.activeOrderId }
        }
        return t
      })
    })
    logActivity({ action: "table_moved", category: "table", details: `${fromName} masasindaki adisyon ${toId} masaya tasindi`, metadata: { fromId, toId } })
    return true
  }, [token, tables, setOrders, setTables, logActivity])

  const moveOrderItems = useCallback(async (fromTableId: string, toTableId: string, itemIds: string[]): Promise<boolean> => {
    if (!token || itemIds.length === 0) return false
    try {
      await api.orders.moveItems(token, { fromTableId, toTableId, itemIds })
      logActivity({ action: "order_items_moved", category: "order", details: `${itemIds.length} kalem baska masaya tasindi`, metadata: { fromTableId, toTableId, itemIds } })
      return true
    } catch { return false }
  }, [token, logActivity])

  const closeTableWithPayment = useCallback(async (
    tableId: string,
    method: PanelPaymentMethod,
    discount?: { type: PanelDiscountType; value: number; reason: string },
    splitDetails?: { method: CloseCheckSplitMethod; amount: number }[],
    opts?: { ledgerCustomerId?: string; ledgerDebtAmount?: number; tip?: number },
  ): Promise<{ ok: boolean; completedOrder?: ClosedTable; error?: string }> => {
    if (!token) return { ok: false, error: "Oturum gerekli" }
    const table = tables.find((t) => t.id === tableId)
    if (!table) return { ok: false, error: "Masa bulunamadi" }
    if (method === "ledger" && !opts?.ledgerCustomerId) return { ok: false, error: "Musteri hesabi secilmelidir" }

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
        ...(effectiveDiscount ? { discount: effectiveDiscount } : {}),
        ...(splitDetails?.length ? { splitDetails } : {}),
        ...(opts?.ledgerCustomerId ? { ledgerCustomerId: opts.ledgerCustomerId } : {}),
        ...(opts?.ledgerDebtAmount != null && Number.isFinite(opts.ledgerDebtAmount) ? { ledgerDebtAmount: opts.ledgerDebtAmount } : {}),
        ...(opts?.tip != null && Number.isFinite(opts.tip) && opts.tip > 0 ? { tip: opts.tip } : {}),
      })
      const mapped = applyCloseCheckResult(res)
      setOrders((prev) => prev.map((o) => (o.tableId === tableId && o.status === "active" ? { ...o, status: "closed" as const } : o)))
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status: "empty" as const, waiter: undefined, totalAmount: 0, orderCount: 0, lastUpdated: undefined, activeOrderId: undefined, discount: undefined, splitInfo: undefined } : t)))
      if (opts?.ledgerCustomerId) void ledgerRefresh()
      logActivity({
        action: "table_closed_with_payment",
        category: "payment",
        details: `${mapped.tableName} kapatildi. Yontem: ${method}, Net: ${mapped.netAmount}`,
        metadata: { tableId, tableName: mapped.tableName, method, rawTotal: mapped.totalAmount, discountAmount: mapped.discountAmount, netAmount: mapped.netAmount, orderCount: mapped.orders.length },
      })
      return { ok: true, completedOrder: mapped }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Hesap kapatilamadi" }
    }
  }, [token, tables, applyCloseCheckResult, setOrders, setTables, ledgerRefresh, logActivity])

  const addQuickSale = useCallback(async (
    items: { productId: string; quantity: number; note?: string }[],
    method: PanelPaymentMethod,
  ): Promise<{ ok: boolean; completedOrder?: ClosedTable; error?: string }> => {
    if (!token) return { ok: false, error: "Oturum gerekli" }
    if (!currentShift || items.length === 0) return { ok: false, error: "Vardiya acik degil veya sepet bos" }
    try {
      const res = await api.orders.closeCheck(token, {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, ...(i.note?.trim() ? { note: i.note.trim() } : {}) })),
        method,
      })
      const mapped = applyCloseCheckResult(res)
      logActivity({ action: "quick_sale_completed", category: "payment", details: `Elden Satis tamamlandi. Yontem: ${method}, Net: ${mapped.netAmount}`, metadata: { completedOrderId: mapped.id, method, netAmount: mapped.netAmount, itemCount: items.length } })
      return { ok: true, completedOrder: mapped }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Satis tamamlanamadi" }
    }
  }, [token, currentShift, applyCloseCheckResult, logActivity])

  const createTableOrder = useCallback(async (
    tableId: string,
    items: { productId: string; quantity: number; note?: string }[],
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!token) return { ok: false, error: "Oturum gerekli" }
    if (!currentShift) return { ok: false, error: "Once vardiyayi acin" }
    if (items.length === 0) return { ok: false, error: "Sepet bos" }
    const table = tables.find((t) => t.id === tableId)
    if (table?.status === "checkout") return { ok: false, error: "Masa hesap kesiminde. Hesap penceresi kapatilmadan siparis gonderilemez." }
    try {
      await api.orders.create(token, { tableId, items })
      logActivity({ action: "table_order_created", category: "order", details: `${table?.name ?? tableId} masasina ${items.length} kalemli siparis`, metadata: { tableId, itemCount: items.length } })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Siparis gonderilemedi" }
    }
  }, [token, currentShift, tables, logActivity])

  const cancelOrderItem = useCallback((orderId: string, itemId: string, reason: string) => {
    const order = orders.find((o) => o.id === orderId)
    const item = order?.items.find((i) => i.id === itemId)
    if (!order || !item) return
    const table = tables.find((t) => t.id === order.tableId)
    const cancelled: CancelledItem = {
      id: genId("ci"),
      orderItem: { ...item, status: "cancelled", cancelReason: reason, cancelledBy: currentUser?.name, cancelledAt: new Date() },
      tableName: table?.name || "?", orderId, reason, cancelledBy: currentUser?.name || "Sistem", cancelledAt: new Date(),
    }
    setCancelledItems((prev) => [cancelled, ...prev])
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, status: "cancelled" as const, cancelReason: reason, cancelledBy: currentUser?.name, cancelledAt: new Date() } : i)) } : o)))
    const cancelledAmount = item.price * item.quantity
    setTables((prev) => prev.map((t) => (t.id === order.tableId ? { ...t, totalAmount: Math.max(0, t.totalAmount - cancelledAmount) } : t)))
    if (token) void api.orders.cancelItem(token, { itemId, reason }).catch((err) => console.error("cancel-item API:", err))
    logActivity({ action: "order_item_cancelled", category: "order", details: `${table?.name || "Masa"} - ${item.productName} iptal edildi (${reason})`, metadata: { orderId, itemId, tableId: order.tableId, quantity: item.quantity, price: item.price, reason } })
  }, [orders, tables, currentUser, token, setCancelledItems, setOrders, setTables, logActivity])

  const assignItemsToLedger = useCallback(async (lines: { itemId: string; quantity?: number }[], ledgerCustomerId: string): Promise<{ ok: boolean; amount?: number }> => {
    if (!token || lines.length === 0 || !ledgerCustomerId) return { ok: false }
    try {
      const res = await api.orders.assignToLedger(token, { lines, ledgerCustomerId })
      void ledgerRefresh()
      logActivity({ action: "order_items_assigned_to_ledger", category: "payment", details: `${lines.length} kalem musteri hesabina aktarildi`, metadata: { ledgerCustomerId, lineCount: lines.length, amount: res.amount } })
      return { ok: true, amount: res.amount }
    } catch (e) {
      console.error("assign-to-ledger:", e)
      return { ok: false }
    }
  }, [token, ledgerRefresh, logActivity])

  const revertLedgerOrderItem = useCallback(async (itemId: string): Promise<{ ok: boolean; amount?: number }> => {
    if (!token || !itemId) return { ok: false }
    try {
      const res = await api.orders.revertLedgerItem(token, { itemId })
      void ledgerRefresh()
      logActivity({ action: "ledger_item_reverted_to_order", category: "payment", details: "Musteri hesabina yazilan kalem adisyona geri alindi", metadata: { itemId, amount: res.amount } })
      return { ok: true, amount: res.amount }
    } catch (e) {
      console.error("revert-ledger-item:", e)
      return { ok: false }
    }
  }, [token, ledgerRefresh, logActivity])

  const addSection = useCallback((name: string) => setSections((prev) => [...prev, { id: genId("ps"), name }]), [setSections])
  const updateSection = useCallback((id: string, name: string) => setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s))), [setSections])
  const deleteSection = useCallback((id: string) => setSections((prev) => prev.filter((s) => s.id !== id)), [setSections])

  const addTable = useCallback((name: string, section: string) => {
    if (!token) return
    api.tables.create(token, { name, section }).then((created) => {
      setTables((prev) => [...prev, { id: created.id, name: created.name, section: created.section, status: "empty", totalAmount: 0, orderCount: 0 }])
      logActivity({ action: "table_created", category: "table", details: `Masa eklendi: ${created.name}`, metadata: { tableId: created.id, section: created.section } })
    }).catch(console.error)
  }, [token, setTables, logActivity])

  const deleteTable = useCallback((id: string) => {
    if (!token) return
    api.tables.delete(token, id).then(() => {
      setTables((prev) => prev.filter((t) => t.id !== id))
      logActivity({ action: "table_deleted", category: "table", details: `Masa silindi: ${id}`, metadata: { tableId: id } })
    }).catch(console.error)
  }, [token, setTables, logActivity])

  const reprintReceipt = useCallback(async (
    target: string | { orderId: string } | { tableName: string; waiterName?: string; items: { productName: string; quantity: number; price: number; note?: string; productId?: string; categoryId?: string }[]; total: number },
  ) => {
    if (!token) return
    try {
      if (typeof target === "string") await api.orders.printReceipt(token, { tableId: target })
      else if ("orderId" in target) await api.orders.printReceipt(token, { orderId: target.orderId })
      else await api.orders.printReceipt(token, target)
    } catch (e) { console.error("printReceipt", e) }
  }, [token])

  const applyDiscount = useCallback((tableId: string, discount: { type: PanelDiscountType; value: number; reason: string }) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    const rawTotal = orders.filter((o) => o.tableId === tableId && o.status === "active").reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + i.price * i.quantity, 0), 0)
    const discountAmount = discount.type === "percent" ? Math.round((rawTotal * discount.value) / 100) : discount.type === "amount" ? Math.min(discount.value, rawTotal) : rawTotal
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, discount: { type: discount.type, value: discount.value, amount: discountAmount, reason: discount.reason }, totalAmount: Math.max(0, rawTotal - discountAmount) } : t)))
    addAuditLog({
      userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "discount_applied", category: "payment",
      details: `${table.name}: ${discount.type === "percent" ? `%${discount.value}` : discount.type === "complimentary" ? "Tam Ikram" : `${discount.value} TL`} indirim uygulandi. Neden: ${discount.reason}`,
    })
  }, [tables, orders, currentUser, setTables, addAuditLog])

  const clearDiscount = useCallback((tableId: string) => {
    const rawTotal = orders.filter((o) => o.tableId === tableId && o.status === "active").reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + i.price * i.quantity, 0), 0)
    const table = tables.find((t) => t.id === tableId)
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, discount: undefined, totalAmount: rawTotal } : t)))
    if (table) addAuditLog({ userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "discount_cleared", category: "payment", details: `${table.name}: Indirim kaldirildi` })
  }, [orders, tables, currentUser, setTables, addAuditLog])

  const splitBillByPerson = useCallback((tableId: string, personCount: number) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo: { type: "person", personCount, perPersonAmount: Math.ceil((t.totalAmount || 0) / personCount) } } : t)))
    addAuditLog({ userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "bill_split", category: "payment", details: `${table.name}: Hesap ${personCount} kisiye bolundu` })
  }, [tables, currentUser, setTables, addAuditLog])

  const splitBillByItems = useCallback((tableId: string, itemIds: string[], amounts: Record<string, number>) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    const allItems = orders.filter((o) => o.tableId === tableId && o.status === "active").flatMap((o) => o.items.filter(itemCountsTowardBill))
    const selectedTotal = Object.entries(amounts).reduce((sum, [itemId, qty]) => {
      const item = allItems.find((i) => i.id === itemId)
      return sum + (item ? item.price * qty : 0)
    }, 0)
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo: { type: "items", itemIds, amounts, selectedTotal } } : t)))
    addAuditLog({ userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "bill_split_items", category: "payment", details: `${table.name}: ${itemIds.length} urun ayri hesaba ayrildi. Tutar: ${selectedTotal} TL` })
  }, [tables, orders, currentUser, setTables, addAuditLog])

  return {
    getTableOrders, getTableTotal, moveTable, moveOrderItems, closeTableWithPayment, addQuickSale, createTableOrder,
    cancelOrderItem, assignItemsToLedger, revertLedgerOrderItem, addSection, updateSection, deleteSection,
    addTable, deleteTable, reprintReceipt, applyDiscount, clearDiscount, splitBillByPerson, splitBillByItems,
  }
}
