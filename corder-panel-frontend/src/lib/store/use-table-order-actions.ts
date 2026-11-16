import { useCallback } from "react"
import {
  itemCountsTowardBill,
  type AuditLog, type CancelledItem, type CashShift, type CloseCheckSplitMethod,
  type ClosedTable, type PanelDiscountType, type PanelOrder, type PanelPaymentMethod,
  type PanelSection, type PanelSplitSharePayment, type PanelTable, type PanelUser,
} from "../panel-types"
import { api, type CloseCheckResponseDto } from "../api"
import { mapApiOrdersToPanel, mapApiTablesToPanel } from "../mappers/orders-tables.mapper"
import { showPanelToast } from "@/components/panel/panel-toast"
import { genId, getStoredCustomSections, setStoredCustomSections } from "./panel-local-storage"
import type { LogActivityFn } from "./panel-store-context"

export function useTableOrderActions(params: {
  token: string | null; currentUser: PanelUser | null; currentShift: CashShift | null
  tables: PanelTable[]; orders: PanelOrder[]; sections: PanelSection[]
  setTables: (v: PanelTable[] | ((prev: PanelTable[]) => PanelTable[])) => void
  setOrders: (v: PanelOrder[] | ((prev: PanelOrder[]) => PanelOrder[])) => void
  setSections: (v: PanelSection[] | ((prev: PanelSection[]) => PanelSection[])) => void
  setCancelledItems: (v: CancelledItem[] | ((prev: CancelledItem[]) => CancelledItem[])) => void
  applyCloseCheckResult: (res: CloseCheckResponseDto) => ClosedTable
  ledgerRefresh: () => Promise<void>; logActivity: LogActivityFn
  addAuditLog: (log: Omit<AuditLog, "id" | "createdAt">) => void
}) {
  const {
    token, currentUser, currentShift, tables, orders, sections,
    setTables, setOrders, setSections, setCancelledItems,
    applyCloseCheckResult, ledgerRefresh, logActivity, addAuditLog,
  } = params

  const getTableOrders = useCallback((tableId: string) => orders.filter((o) => o.tableId === tableId && o.status === "active"), [orders])
  const getTableTotal = useCallback(
    (tableId: string) => orders.filter((o) => o.tableId === tableId && o.status === "active").reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + i.price * i.quantity, 0), 0),
    [orders],
  )

  const moveTable = useCallback(async (fromId: string, toId: string): Promise<boolean> => {
    if (!token) return false
    try { await api.orders.move(token, fromId, toId) } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Masa taşınamadı", "error")
      return false
    }
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
    logActivity({ action: "table_moved", category: "table", details: `${fromName} masasındaki adisyon ${toId} masaya taşındı`, metadata: { fromId, toId } })
    return true
  }, [token, tables, setOrders, setTables, logActivity])

  const moveOrderItems = useCallback(async (fromTableId: string, toTableId: string, itemIds: string[]): Promise<boolean> => {
    if (!token || itemIds.length === 0) return false
    try {
      await api.orders.moveItems(token, { fromTableId, toTableId, itemIds })
      logActivity({ action: "order_items_moved", category: "order", details: `${itemIds.length} kalem başka masaya taşındı`, metadata: { fromTableId, toTableId, itemIds } })
      return true
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Ürünler taşınamadı", "error")
      return false
    }
  }, [token, logActivity])

  const closeTableWithPayment = useCallback(async (
    tableId: string, method: PanelPaymentMethod,
    discount?: { type: PanelDiscountType; value: number; reason: string },
    splitDetails?: { method: CloseCheckSplitMethod; amount: number }[],
    opts?: { ledgerCustomerId?: string; ledgerDebtAmount?: number; tip?: number; lines?: { itemId: string; quantity: number }[] },
  ): Promise<{ ok: boolean; completedOrder?: ClosedTable; tableFullyClosed?: boolean; error?: string }> => {
    if (!token) return { ok: false, error: "Oturum gerekli" }
    const table = tables.find((t) => t.id === tableId)
    if (!table) return { ok: false, error: "Masa bulunamadı" }
    if (method === "ledger" && !opts?.ledgerCustomerId) return { ok: false, error: "Müşteri hesabı seçilmelidir" }

    const effectiveDiscount: { type: "percent" | "amount"; value: number; reason: string } | undefined =
      discount && (discount.type === "complimentary" || discount.value > 0)
        ? discount.type === "complimentary" ? { type: "percent", value: 100, reason: discount.reason } : { type: discount.type, value: discount.value, reason: discount.reason }
        : undefined

    try {
      const res = await api.orders.closeCheck(token, {
        tableId, method,
        ...(opts?.lines?.length ? { lines: opts.lines } : {}),
        ...(effectiveDiscount ? { discount: effectiveDiscount } : {}),
        ...(splitDetails?.length ? { splitDetails } : {}),
        ...(opts?.ledgerCustomerId ? { ledgerCustomerId: opts.ledgerCustomerId } : {}),
        ...(opts?.ledgerDebtAmount != null && Number.isFinite(opts.ledgerDebtAmount) ? { ledgerDebtAmount: opts.ledgerDebtAmount } : {}),
        ...(opts?.tip != null && Number.isFinite(opts.tip) && opts.tip > 0 ? { tip: opts.tip } : {}),
      })
      const mapped = applyCloseCheckResult(res)
      if (res.tableFullyClosed === false) {
        if (opts?.lines?.length) {
          const lineMap = new Map(opts.lines.map((l) => [l.itemId, l.quantity]))
          setOrders((prev) => prev.map((o) => {
            if (o.tableId !== tableId || o.status !== "active") return o
            const nextItems = o.items.map((item) => {
              const paidQty = lineMap.get(item.id)
              if (!paidQty) return item
              const rem = item.quantity - paidQty
              return rem > 0 ? { ...item, quantity: rem } : null
            }).filter((x): x is NonNullable<typeof x> => x !== null)
            return { ...o, items: nextItems, status: nextItems.some(itemCountsTowardBill) ? "active" : "closed" }
          }))
        }
        setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status: "occupied" as const, splitInfo: undefined, totalAmount: Math.max(0, (t.totalAmount || 0) - mapped.netAmount) } : t)))
        const [freshOrdersDto, freshTablesDto] = await Promise.all([api.orders.list(token).catch(() => null), api.tables.list(token).catch(() => null)])
        if (freshOrdersDto) {
          const freshOrders = mapApiOrdersToPanel(freshOrdersDto)
          setOrders(freshOrders)
          if (freshTablesDto) {
            setTables((prev) => mapApiTablesToPanel(freshTablesDto, freshOrders, []).map((nt) => {
              const old = prev.find((p) => p.id === nt.id)
              return old?.waiter && !nt.waiter ? { ...nt, waiter: old.waiter } : nt
            }))
          }
        }
      } else {
        setOrders((prev) => prev.map((o) => (o.tableId === tableId && o.status === "active" ? { ...o, status: "closed" as const } : o)))
        setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status: "empty" as const, waiter: undefined, totalAmount: 0, orderCount: 0, lastUpdated: undefined, activeOrderId: undefined, discount: undefined, splitInfo: undefined } : t)))
      }
      if (opts?.ledgerCustomerId) void ledgerRefresh()
      logActivity({
        action: res.tableFullyClosed === false ? "table_partial_checkout" : "table_closed_with_payment", category: "payment",
        details: `${mapped.tableName} ${res.tableFullyClosed === false ? "kısmi ödeme alındı" : "kapatıldı"}. Yöntem: ${method}, Net: ${mapped.netAmount}`,
        metadata: { tableId, tableName: mapped.tableName, method, rawTotal: mapped.totalAmount, discountAmount: mapped.discountAmount, netAmount: mapped.netAmount, orderCount: mapped.orders.length, tableFullyClosed: res.tableFullyClosed !== false },
      })
      return { ok: true, completedOrder: mapped, tableFullyClosed: res.tableFullyClosed !== false }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hesap kapatılamadı"
      showPanelToast(msg, "error")
      return { ok: false, error: msg }
    }
  }, [token, tables, applyCloseCheckResult, setOrders, setTables, ledgerRefresh, logActivity])

  const addQuickSale = useCallback(async (
    items: { productId: string; quantity: number; note?: string }[],
    method: PanelPaymentMethod,
  ): Promise<{ ok: boolean; completedOrder?: ClosedTable; error?: string }> => {
    if (!token) return { ok: false, error: "Oturum gerekli" }
    if (!currentShift || items.length === 0) return { ok: false, error: "Vardiya açık değil veya sepet boş" }
    try {
      const res = await api.orders.closeCheck(token, {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, ...(i.note?.trim() ? { note: i.note.trim() } : {}) })),
        method,
      })
      const mapped = applyCloseCheckResult(res)
      logActivity({ action: "quick_sale_completed", category: "payment", details: `Elden Satış tamamlandı. Yöntem: ${method}, Net: ${mapped.netAmount}`, metadata: { completedOrderId: mapped.id, method, netAmount: mapped.netAmount, itemCount: items.length } })
      return { ok: true, completedOrder: mapped }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Satış tamamlanamadı"
      showPanelToast(msg, "error")
      return { ok: false, error: msg }
    }
  }, [token, currentShift, applyCloseCheckResult, logActivity])

  const createTableOrder = useCallback(async (
    tableId: string,
    items: { productId: string; quantity: number; note?: string }[],
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!token) return { ok: false, error: "Oturum gerekli" }
    if (!currentShift) return { ok: false, error: "Önce vardiyayı açın" }
    if (items.length === 0) return { ok: false, error: "Sepet boş" }
    const table = tables.find((t) => t.id === tableId)
    if (table?.status === "checkout") return { ok: false, error: "Masa hesap kesiminde. Hesap penceresi kapatılmadan sipariş gönderilemez." }
    try {
      const cleanItems = items.map((i) => ({ productId: i.productId, quantity: i.quantity, ...(i.note?.trim() ? { note: i.note.trim() } : {}) }))
      await api.orders.create(token, { tableId, items: cleanItems })
      logActivity({ action: "table_order_created", category: "order", details: `${table?.name ?? tableId} masasına ${items.length} kalemli sipariş`, metadata: { tableId, itemCount: items.length } })
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sipariş gönderilemedi"
      showPanelToast(msg, "error")
      return { ok: false, error: msg }
    }
  }, [token, currentShift, tables, logActivity])

  const cancelOrderItem = useCallback(async (orderId: string, itemId: string, reason: string): Promise<boolean> => {
    const order = orders.find((o) => o.id === orderId)
    const item = order?.items.find((i) => i.id === itemId)
    const trimmedReason = reason.trim()
    if (!order || !item || !token || !trimmedReason) return false
    try {
      await api.orders.cancelItem(token, { itemId, reason: trimmedReason })
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Ürün iptal edilemedi", "error")
      return false
    }
    const table = tables.find((t) => t.id === order.tableId)
    const cancelled: CancelledItem = {
      id: genId("ci"),
      orderItem: { ...item, status: "cancelled", cancelReason: trimmedReason, cancelledBy: currentUser?.name, cancelledAt: new Date() },
      tableName: table?.name || "?", orderId, reason: trimmedReason, cancelledBy: currentUser?.name || "Sistem", cancelledAt: new Date(),
    }
    setCancelledItems((prev) => [cancelled, ...prev])
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, status: "cancelled" as const, cancelReason: trimmedReason, cancelledBy: currentUser?.name, cancelledAt: new Date() } : i)) } : o)))
    const cancelledAmount = item.price * item.quantity
    setTables((prev) => prev.map((t) => (t.id === order.tableId ? { ...t, totalAmount: Math.max(0, t.totalAmount - cancelledAmount) } : t)))
    logActivity({ action: "order_item_cancelled", category: "order", details: `${table?.name || "Masa"} - ${item.productName} iptal edildi (${trimmedReason})`, metadata: { orderId, itemId, tableId: order.tableId, quantity: item.quantity, price: item.price, reason: trimmedReason } })
    return true
  }, [orders, tables, currentUser, token, setCancelledItems, setOrders, setTables, logActivity])

  const assignItemsToLedger = useCallback(async (lines: { itemId: string; quantity?: number }[], ledgerCustomerId: string): Promise<{ ok: boolean; amount?: number }> => {
    if (!token || lines.length === 0 || !ledgerCustomerId) return { ok: false }
    try {
      const res = await api.orders.assignToLedger(token, { lines, ledgerCustomerId })
      void ledgerRefresh()
      logActivity({ action: "order_items_assigned_to_ledger", category: "payment", details: `${lines.length} kalem müşteri hesabına aktarıldı`, metadata: { ledgerCustomerId, lineCount: lines.length, amount: res.amount } })
      return { ok: true, amount: res.amount }
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Cariye aktarılamadı", "error")
      return { ok: false }
    }
  }, [token, ledgerRefresh, logActivity])

  const revertLedgerOrderItem = useCallback(async (itemId: string): Promise<{ ok: boolean; amount?: number }> => {
    if (!token || !itemId) return { ok: false }
    try {
      const res = await api.orders.revertLedgerItem(token, { itemId })
      void ledgerRefresh()
      logActivity({ action: "ledger_item_reverted_to_order", category: "payment", details: "Müşteri hesabına yazılan kalem adisyona geri alındı", metadata: { itemId, amount: res.amount } })
      return { ok: true, amount: res.amount }
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Cari kalemi geri alınamadı", "error")
      return { ok: false }
    }
  }, [token, ledgerRefresh, logActivity])

  const addSection = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSections((prev) => {
      if (prev.some((s) => s.name === trimmed)) return prev
      setStoredCustomSections([...getStoredCustomSections(), trimmed])
      return [...prev, { id: genId("ps"), name: trimmed }]
    })
    showPanelToast(`Bölüm eklendi: ${trimmed}`, "success")
  }, [setSections])

  const updateSection = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    const oldSec = sections.find((s) => s.id === id)
    if (!trimmed || !oldSec || oldSec.name === trimmed) return
    const sectionTables = tables.filter((t) => t.section === oldSec.name)
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)))
    setTables((prev) => prev.map((t) => (t.section === oldSec.name ? { ...t, section: trimmed } : t)))
    setStoredCustomSections(getStoredCustomSections().map((n) => (n === oldSec.name ? trimmed : n)))
    if (token && sectionTables.length > 0) {
      void Promise.all(sectionTables.map((t) => api.tables.update(token, t.id, { section: trimmed }))).catch((err) => showPanelToast(err instanceof Error ? err.message : "Bölüm masaları güncellenemedi", "error"))
    }
    showPanelToast("Bölüm güncellendi", "success")
  }, [sections, tables, token, setSections, setTables])

  const deleteSection = useCallback((id: string) => {
    const oldSec = sections.find((s) => s.id === id)
    if (!oldSec) return
    const sectionTables = tables.filter((t) => t.section === oldSec.name)
    if (sectionTables.some((t) => t.status === "occupied" || t.orderCount > 0)) {
      showPanelToast("Dolu masası olan bölüm silinemez", "error")
      return
    }
    setSections((prev) => prev.filter((s) => s.id !== id))
    setTables((prev) => prev.filter((t) => t.section !== oldSec.name))
    setStoredCustomSections(getStoredCustomSections().filter((n) => n !== oldSec.name))
    if (token && sectionTables.length > 0) {
      void Promise.all(sectionTables.map((t) => api.tables.delete(token, t.id))).catch((err) => showPanelToast(err instanceof Error ? err.message : "Bölüm masaları silinemedi", "error"))
    }
    showPanelToast("Bölüm silindi", "info")
  }, [sections, tables, token, setSections, setTables])

  const addTable = useCallback((name: string, section: string) => {
    if (!token) return
    api.tables.create(token, { name, section }).then((created) => {
      setTables((prev) => [...prev, { id: created.id, name: created.name, section: created.section, status: "empty", totalAmount: 0, orderCount: 0 }])
      logActivity({ action: "table_created", category: "table", details: `Masa eklendi: ${created.name}`, metadata: { tableId: created.id, section: created.section } })
      showPanelToast(`Masa eklendi: ${created.name}`, "success")
    }).catch((err) => showPanelToast(err instanceof Error ? err.message : "Masa eklenemedi", "error"))
  }, [token, setTables, logActivity])

  const deleteTable = useCallback((id: string) => {
    if (!token) return
    api.tables.delete(token, id).then(() => {
      setTables((prev) => prev.filter((t) => t.id !== id))
      logActivity({ action: "table_deleted", category: "table", details: `Masa silindi: ${id}`, metadata: { tableId: id } })
      showPanelToast("Masa silindi", "info")
    }).catch((err) => showPanelToast(err instanceof Error ? err.message : "Masa silinemedi", "error"))
  }, [token, setTables, logActivity])

  const reprintReceipt = useCallback(async (
    target: string | { orderId: string } | { tableName: string; waiterName?: string; items: { productName: string; quantity: number; price: number; note?: string; productId?: string; categoryId?: string }[]; total: number },
  ) => {
    if (!token) return
    try {
      if (typeof target === "string") await api.orders.printReceipt(token, { tableId: target })
      else if ("orderId" in target) await api.orders.printReceipt(token, { orderId: target.orderId })
      else await api.orders.printReceipt(token, target)
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Fiş yazdırılamadı", "error")
    }
  }, [token])

  const applyDiscount = useCallback(async (tableId: string, discount: { type: PanelDiscountType; value: number; reason: string }) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    const rawTotal = orders.filter((o) => o.tableId === tableId && o.status === "active").reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + i.price * i.quantity, 0), 0)
    const discountAmount = discount.type === "percent" ? Math.round(rawTotal * discount.value) / 100 : discount.type === "amount" ? Math.min(discount.value, rawTotal) : rawTotal
    const nextTotal = Math.max(0, rawTotal - discountAmount)
    setTables((prev) => prev.map((t) => {
      if (t.id !== tableId) return t
      const nextSplit = t.splitInfo?.type === "person" && t.splitInfo.personCount ? { ...t.splitInfo, perPersonAmount: Math.round((nextTotal / t.splitInfo.personCount) * 100) / 100 } : t.splitInfo
      return { ...t, discount: { type: discount.type, value: discount.value, amount: discountAmount, reason: discount.reason }, totalAmount: nextTotal, ...(nextSplit ? { splitInfo: nextSplit } : {}) }
    }))
    if (token) { try { await api.tables.update(token, tableId, { discount }) } catch (err) { showPanelToast(err instanceof Error ? err.message : "İndirim kaydedilemedi", "error") } }
    addAuditLog({ userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "discount_applied", category: "payment", details: `${table.name}: ${discount.type === "percent" ? `%${discount.value}` : discount.type === "complimentary" ? "Tam İkram" : `${discount.value} TL`} indirim uygulandı. Neden: ${discount.reason}` })
  }, [token, tables, orders, currentUser, setTables, addAuditLog])

  const clearDiscount = useCallback(async (tableId: string) => {
    const rawTotal = orders.filter((o) => o.tableId === tableId && o.status === "active").reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + i.price * i.quantity, 0), 0)
    const table = tables.find((t) => t.id === tableId)
    setTables((prev) => prev.map((t) => {
      if (t.id !== tableId) return t
      const nextSplit = t.splitInfo?.type === "person" && t.splitInfo.personCount ? { ...t.splitInfo, perPersonAmount: Math.round((rawTotal / t.splitInfo.personCount) * 100) / 100 } : t.splitInfo
      return { ...t, discount: undefined, totalAmount: rawTotal, ...(nextSplit ? { splitInfo: nextSplit } : {}) }
    }))
    if (token) { try { await api.tables.update(token, tableId, { discount: null }) } catch (err) { showPanelToast(err instanceof Error ? err.message : "İndirim kaldırılamadı", "error") } }
    if (table) addAuditLog({ userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "discount_cleared", category: "payment", details: `${table.name}: İndirim kaldırıldı` })
  }, [token, orders, tables, currentUser, setTables, addAuditLog])

  const splitBillByPerson = useCallback(async (tableId: string, personCount: number) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    const perPersonAmount = Math.round(((table.totalAmount || 0) / personCount) * 100) / 100
    const splitInfo: NonNullable<PanelTable["splitInfo"]> = { type: "person", personCount, perPersonAmount, paidShares: [] }
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo } : t)))
    if (token) { try { await api.tables.update(token, tableId, { splitInfo }) } catch (err) { showPanelToast(err instanceof Error ? err.message : "Hesap bölme kaydedilemedi", "error") } }
    addAuditLog({ userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "bill_split", category: "payment", details: `${table.name}: Hesap ${personCount} kişiye bölündü` })
  }, [token, tables, currentUser, setTables, addAuditLog])

  const splitBillByItems = useCallback(async (tableId: string, itemIds: string[], amounts: Record<string, number>) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    const allItems = orders.filter((o) => o.tableId === tableId && o.status === "active").flatMap((o) => o.items.filter(itemCountsTowardBill))
    const selectedTotal = Math.round(Object.entries(amounts).reduce((sum, [itemId, qty]) => {
      const item = allItems.find((i) => i.id === itemId)
      return sum + (item ? item.price * qty : 0)
    }, 0) * 100) / 100
    const splitInfo: NonNullable<PanelTable["splitInfo"]> = { type: "items", itemIds, amounts, selectedTotal }
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo } : t)))
    if (token) { try { await api.tables.update(token, tableId, { splitInfo }) } catch (err) { showPanelToast(err instanceof Error ? err.message : "Ürün ayırma kaydedilemedi", "error") } }
    addAuditLog({ userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "bill_split_items", category: "payment", details: `${table.name}: ${itemIds.length} ürün ayrı hesaba ayrıldı. Tutar: ${selectedTotal} TL` })
  }, [token, tables, orders, currentUser, setTables, addAuditLog])

  const clearSplitBill = useCallback(async (tableId: string) => {
    const table = tables.find((t) => t.id === tableId)
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo: undefined } : t)))
    if (token) { try { await api.tables.update(token, tableId, { splitInfo: null }) } catch (err) { showPanelToast(err instanceof Error ? err.message : "Hesap bölme kaldırılamadı", "error") } }
    if (table) addAuditLog({ userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "bill_split_cleared", category: "payment", details: `${table.name}: Hesap bölme kaldırıldı` })
  }, [token, tables, currentUser, setTables, addAuditLog])

  const payPersonShare = useCallback(async (
    tableId: string, shareIndex: number, method: CloseCheckSplitMethod, amount: number, opts?: { ledgerCustomerId?: string },
  ): Promise<{ ok: boolean; fullyClosed?: boolean; completedOrder?: ClosedTable; error?: string }> => {
    if (!token) return { ok: false, error: "Oturum gerekli" }
    if (method === "ledger" && !opts?.ledgerCustomerId) return { ok: false, error: "Müşteri hesabı seçilmelidir" }
    const table = tables.find((t) => t.id === tableId)
    if (!table || table.splitInfo?.type !== "person") return { ok: false, error: "Kişi bölüşümü bulunamadı" }
    const personCount = table.splitInfo.personCount ?? 2
    const existingShares = (table.splitInfo.paidShares ?? []).filter((s) => s.shareIndex !== shareIndex)
    const newShare: PanelSplitSharePayment = {
      shareIndex, method, amount: Math.round(amount * 100) / 100,
      ...(opts?.ledgerCustomerId ? { ledgerCustomerId: opts.ledgerCustomerId } : {}), paidAt: new Date().toISOString(),
    }
    const paidShares = [...existingShares, newShare].sort((a, b) => a.shareIndex - b.shareIndex)

    if (paidShares.length >= personCount) {
      const byMethod = new Map<CloseCheckSplitMethod, number>()
      let ledgerCustomerId: string | undefined
      let ledgerDebtAmount = 0
      for (const s of paidShares) {
        byMethod.set(s.method, Math.round(((byMethod.get(s.method) ?? 0) + s.amount) * 100) / 100)
        if (s.method === "ledger" && s.ledgerCustomerId) {
          ledgerCustomerId = s.ledgerCustomerId
          ledgerDebtAmount = Math.round((ledgerDebtAmount + s.amount) * 100) / 100
        }
      }
      const aggregatedSplitDetails = Array.from(byMethod.entries()).map(([m, amt]) => ({ method: m, amount: amt }))
      const closeRes = await closeTableWithPayment(
        tableId, "split",
        table.discount ? { type: table.discount.type, value: table.discount.value, reason: table.discount.reason } : undefined,
        aggregatedSplitDetails, ledgerCustomerId ? { ledgerCustomerId, ledgerDebtAmount } : undefined,
      )
      return { ok: closeRes.ok, fullyClosed: closeRes.ok, completedOrder: closeRes.completedOrder, error: closeRes.error }
    }

    const nextSplitInfo: NonNullable<PanelTable["splitInfo"]> = { ...table.splitInfo, type: "person", personCount, paidShares }
    try {
      await api.tables.update(token, tableId, { splitInfo: nextSplitInfo })
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo: nextSplitInfo } : t)))
      addAuditLog({
        userId: currentUser?.id || "system", userName: currentUser?.name || "Sistem", action: "person_share_paid", category: "payment",
        details: `${table.name}: ${shareIndex + 1}/${personCount}. kişi payı ödendi (${newShare.amount.toFixed(2)} TL - ${method})`,
      })
      return { ok: true, fullyClosed: false }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kişi payı kaydedilemedi"
      showPanelToast(msg, "error")
      return { ok: false, error: msg }
    }
  }, [token, tables, currentUser, setTables, addAuditLog, closeTableWithPayment])

  return {
    getTableOrders, getTableTotal, moveTable, moveOrderItems, closeTableWithPayment, addQuickSale, createTableOrder,
    cancelOrderItem, assignItemsToLedger, revertLedgerOrderItem, addSection, updateSection, deleteSection,
    addTable, deleteTable, reprintReceipt, applyDiscount, clearDiscount, splitBillByPerson, splitBillByItems,
    clearSplitBill, payPersonShare,
  }
}
