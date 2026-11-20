import { useCallback } from "react"
import {
  itemCountsTowardBill,
  type AuditLog,
  type CloseCheckSplitMethod,
  type ClosedTable,
  type PanelDiscountType,
  type PanelOrder,
  type PanelPaymentMethod,
  type PanelSection,
  type PanelSplitSharePayment,
  type PanelTable,
  type PanelUser,
} from "../panel-types"
import { api } from "../api"
import { computeDiscountMinorUnits, formatTitleCase, fromMinorUnits, toMinorUnits } from "../format"
import { showPanelToast } from "@/components/panel/panel-toast"
import { genId, getStoredCustomSections, setStoredCustomSections } from "./panel-local-storage"
import type { LogActivityFn } from "./panel-store-context"

export function useTableSettlementActions(params: {
  token: string | null
  restaurantId?: string | null
  currentUser: PanelUser | null
  tables: PanelTable[]
  orders: PanelOrder[]
  sections: PanelSection[]
  setTables: (v: PanelTable[] | ((prev: PanelTable[]) => PanelTable[])) => void
  setSections: (v: PanelSection[] | ((prev: PanelSection[]) => PanelSection[])) => void
  logActivity: LogActivityFn
  addAuditLog: (log: Omit<AuditLog, "id" | "createdAt">) => void
  closeTableWithPayment: (
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
  ) => Promise<{
    ok: boolean
    completedOrder?: ClosedTable
    tableFullyClosed?: boolean
    error?: string
  }>
}) {
  const { token, restaurantId, currentUser, tables, orders, sections, setTables, setSections, logActivity, addAuditLog, closeTableWithPayment } = params

  const addSection = useCallback(
    (name: string) => {
      const trimmed = formatTitleCase(name)
      if (!trimmed) return
      setSections((prev) => {
        if (prev.some((s) => s.name === trimmed)) return prev
        setStoredCustomSections([...getStoredCustomSections(restaurantId), trimmed], restaurantId)
        return [...prev, { id: genId("ps"), name: trimmed }]
      })
      showPanelToast(`Bölüm eklendi: ${trimmed}`, "success")
    },
    [restaurantId, setSections],
  )

  const updateSection = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      const trimmed = formatTitleCase(name)
      const oldSec = sections.find((s) => s.id === id)
      if (!trimmed || !oldSec || oldSec.name === trimmed) return false
      const sectionTables = tables.filter((t) => t.section === oldSec.name)
      if (token && sectionTables.length > 0) {
        try {
          await Promise.all(sectionTables.map((t) => api.tables.update(token, t.id, { section: trimmed })))
        } catch (err) {
          showPanelToast(err instanceof Error ? err.message : "Bölüm masaları güncellenemedi", "error")
          return false
        }
      }
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)))
      setTables((prev) => prev.map((t) => (t.section === oldSec.name ? { ...t, section: trimmed } : t)))
      setStoredCustomSections(
        getStoredCustomSections(restaurantId).map((n) => (formatTitleCase(n) === oldSec.name ? trimmed : formatTitleCase(n))),
        restaurantId,
      )
      showPanelToast("Bölüm güncellendi", "success")
      return true
    },
    [sections, tables, token, restaurantId, setSections, setTables],
  )

  const deleteSection = useCallback(
    async (id: string): Promise<boolean> => {
      const oldSec = sections.find((s) => s.id === id)
      if (!oldSec) return false
      const sectionTables = tables.filter((t) => t.section === oldSec.name)
      if (sectionTables.some((t) => t.status !== "empty" || t.orderCount > 0)) {
        showPanelToast("Dolu masası olan bölüm silinemez", "error")
        return false
      }
      if (token && sectionTables.length > 0) {
        try {
          await Promise.all(sectionTables.map((t) => api.tables.delete(token, t.id)))
        } catch (err) {
          showPanelToast(err instanceof Error ? err.message : "Bölüm masaları silinemedi", "error")
          return false
        }
      }
      setSections((prev) => prev.filter((s) => s.id !== id))
      setTables((prev) => prev.filter((t) => t.section !== oldSec.name))
      setStoredCustomSections(
        getStoredCustomSections(restaurantId).filter((n) => n !== oldSec.name),
        restaurantId,
      )
      showPanelToast("Bölüm silindi", "info")
      return true
    },
    [sections, tables, token, restaurantId, setSections, setTables],
  )

  const addTable = useCallback(
    (name: string, section: string) => {
      if (!token) return
      api.tables
        .create(token, { name, section })
        .then((created) => {
          const formattedName = formatTitleCase(created.name)
          const formattedSection = formatTitleCase(created.section)
          setTables((prev) => [
            ...prev,
            {
              id: created.id,
              name: formattedName,
              section: formattedSection,
              status: "empty",
              ...(created.qrToken ? { qrToken: created.qrToken } : {}),
              ...(created.capacity != null ? { capacity: Number(created.capacity) } : {}),
              totalAmount: 0,
              orderCount: 0,
            },
          ])
          logActivity({
            action: "table_created",
            category: "table",
            details: `Masa eklendi: ${formattedName}`,
            metadata: { tableId: created.id, section: formattedSection },
          })
          showPanelToast(`Masa eklendi: ${formattedName}`, "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Masa eklenemedi", "error"))
    },
    [token, setTables, logActivity],
  )

  const bulkCreateTables = useCallback(
    async (body: {
      section: string
      prefix: string
      startNumber: number
      count: number
      capacity?: number
    }): Promise<PanelTable[]> => {
      if (!token) return []
      const sectionName = formatTitleCase(body.section)
      if (!sectionName) return []
      try {
        const createdList = await api.tables.bulkCreate(token, { ...body, section: sectionName })
        const mapped: PanelTable[] = createdList.map((c) => ({
          id: c.id,
          name: formatTitleCase(c.name),
          section: formatTitleCase(c.section),
          status: "empty",
          ...(c.qrToken ? { qrToken: c.qrToken } : {}),
          ...(c.capacity != null ? { capacity: Number(c.capacity) } : {}),
          totalAmount: 0,
          orderCount: 0,
        }))
        setSections((prev) => {
          if (prev.some((s) => s.name === sectionName)) return prev
          setStoredCustomSections([...getStoredCustomSections(restaurantId), sectionName], restaurantId)
          return [...prev, { id: genId("ps"), name: sectionName }]
        })
        setTables((prev) => {
          const existingIds = new Set(prev.map((t) => t.id))
          return [...prev, ...mapped.filter((m) => !existingIds.has(m.id))]
        })
        logActivity({
          action: "tables_bulk_created",
          category: "table",
          details: `${sectionName} bölgesine ${mapped.length} masa toplu oluşturuldu`,
          metadata: { section: sectionName, count: mapped.length, prefix: body.prefix },
        })
        showPanelToast(`${mapped.length} masa oluşturuldu`, "success")
        return mapped
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Çoklu masa oluşturulamadı", "error")
        return []
      }
    },
    [token, restaurantId, setSections, setTables, logActivity],
  )

  const deleteTable = useCallback(
    (id: string) => {
      if (!token) return
      api.tables
        .delete(token, id)
        .then(() => {
          setTables((prev) => prev.filter((t) => t.id !== id))
          logActivity({
            action: "table_deleted",
            category: "table",
            details: `Masa silindi: ${id}`,
            metadata: { tableId: id },
          })
          showPanelToast("Masa silindi", "info")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Masa silinemedi", "error"))
    },
    [token, setTables, logActivity],
  )

  const reprintReceipt = useCallback(
    async (
      target:
        | string
        | { orderId: string }
        | { completedOrderId: string }
        | {
            tableName: string
            waiterName?: string
            items: { productName: string; quantity: number; price: number; note?: string; productId?: string; categoryId?: string }[]
            total: number
          },
    ): Promise<boolean> => {
      if (!token) return false
      try {
        if (typeof target === "string") await api.orders.printReceipt(token, { tableId: target })
        else if ("orderId" in target) await api.orders.printReceipt(token, { orderId: target.orderId })
        else if ("completedOrderId" in target) await api.orders.printReceipt(token, { completedOrderId: target.completedOrderId })
        else await api.orders.printReceipt(token, target)
        return true
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Fiş yazdırılamadı", "error")
        return false
      }
    },
    [token],
  )

  const applyDiscount = useCallback(
    async (tableId: string, discount: { type: PanelDiscountType; value: number; reason: string }): Promise<boolean> => {
      if (!token) return false
      const table = tables.find((t) => t.id === tableId)
      if (!table) return false
      const appliedBy = currentUser?.name || "Sistem"
      const discountPayload = { ...discount, appliedBy }
      try {
        await api.tables.update(token, tableId, { discount: discountPayload })
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "İndirim kaydedilemedi", "error")
        return false
      }
      const rawMinorUnits = orders
        .filter((o) => o.tableId === tableId && o.status === "active")
        .reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + toMinorUnits(i.price) * i.quantity, 0), 0)
      const discountMinorUnits = computeDiscountMinorUnits(rawMinorUnits, discount)
      const nextMinorUnits = Math.max(0, rawMinorUnits - discountMinorUnits)
      const discountAmount = fromMinorUnits(discountMinorUnits)
      const nextTotal = fromMinorUnits(nextMinorUnits)
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t
          const nextSplit =
            t.splitInfo?.type === "person" && t.splitInfo.personCount
              ? { ...t.splitInfo, perPersonAmount: fromMinorUnits(Math.round(nextMinorUnits / t.splitInfo.personCount)) }
              : t.splitInfo
          return {
            ...t,
            discount: { type: discount.type, value: discount.value, amount: discountAmount, reason: discount.reason, appliedBy },
            totalAmount: nextTotal,
            ...(nextSplit ? { splitInfo: nextSplit } : {}),
          }
        }),
      )
      addAuditLog({
        userId: currentUser?.id || "system",
        userName: currentUser?.name || "Sistem",
        action: "discount_applied",
        category: "payment",
        details: `${table.name}: ${discount.type === "percent" ? `%${discount.value}` : discount.type === "complimentary" ? "Tam İkram" : `${discount.value} TL`} indirim uygulandı. Neden: ${discount.reason}`,
      })
      return true
    },
    [token, tables, orders, currentUser, setTables, addAuditLog],
  )

  const clearDiscount = useCallback(
    async (tableId: string): Promise<boolean> => {
      if (!token) return false
      const table = tables.find((t) => t.id === tableId)
      try {
        await api.tables.update(token, tableId, { discount: null })
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "İndirim kaldırılamadı", "error")
        return false
      }
      const rawMinorUnits = orders
        .filter((o) => o.tableId === tableId && o.status === "active")
        .reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + toMinorUnits(i.price) * i.quantity, 0), 0)
      const rawTotal = fromMinorUnits(rawMinorUnits)
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t
          const nextSplit =
            t.splitInfo?.type === "person" && t.splitInfo.personCount
              ? { ...t.splitInfo, perPersonAmount: fromMinorUnits(Math.round(rawMinorUnits / t.splitInfo.personCount)) }
              : t.splitInfo
          return { ...t, discount: undefined, totalAmount: rawTotal, ...(nextSplit ? { splitInfo: nextSplit } : {}) }
        }),
      )
      if (table) {
        addAuditLog({
          userId: currentUser?.id || "system",
          userName: currentUser?.name || "Sistem",
          action: "discount_cleared",
          category: "payment",
          details: `${table.name}: İndirim kaldırıldı`,
        })
      }
      return true
    },
    [token, orders, tables, currentUser, setTables, addAuditLog],
  )

  const splitBillByPerson = useCallback(
    async (tableId: string, personCount: number): Promise<boolean> => {
      if (!token) return false
      const table = tables.find((t) => t.id === tableId)
      if (!table) return false
      const totalMinorUnits = toMinorUnits(table.totalAmount || 0)
      const perPersonAmount = fromMinorUnits(Math.round(totalMinorUnits / personCount))
      const splitInfo: NonNullable<PanelTable["splitInfo"]> = { type: "person", personCount, perPersonAmount, paidShares: [] }
      try {
        await api.tables.update(token, tableId, { splitInfo })
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Hesap bölme kaydedilemedi", "error")
        return false
      }
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo } : t)))
      addAuditLog({
        userId: currentUser?.id || "system",
        userName: currentUser?.name || "Sistem",
        action: "bill_split",
        category: "payment",
        details: `${table.name}: Hesap ${personCount} kişiye bölündü`,
      })
      return true
    },
    [token, tables, currentUser, setTables, addAuditLog],
  )

  const splitBillByItems = useCallback(
    async (tableId: string, itemIds: string[], amounts: Record<string, number>): Promise<boolean> => {
      if (!token) return false
      const table = tables.find((t) => t.id === tableId)
      if (!table) return false
      const allItems = orders.filter((o) => o.tableId === tableId && o.status === "active").flatMap((o) => o.items.filter(itemCountsTowardBill))
      const selectedMinorUnits = Object.entries(amounts).reduce((sum, [itemId, qty]) => {
        const item = allItems.find((i) => i.id === itemId)
        return sum + (item ? toMinorUnits(item.price) * qty : 0)
      }, 0)
      const selectedTotal = fromMinorUnits(selectedMinorUnits)
      const splitInfo: NonNullable<PanelTable["splitInfo"]> = { type: "items", itemIds, amounts, selectedTotal }
      try {
        await api.tables.update(token, tableId, { splitInfo })
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Ürün ayırma kaydedilemedi", "error")
        return false
      }
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo } : t)))
      addAuditLog({
        userId: currentUser?.id || "system",
        userName: currentUser?.name || "Sistem",
        action: "bill_split_items",
        category: "payment",
        details: `${table.name}: ${itemIds.length} ürün ayrı hesaba ayrıldı. Tutar: ${selectedTotal} TL`,
      })
      return true
    },
    [token, tables, orders, currentUser, setTables, addAuditLog],
  )

  const clearSplitBill = useCallback(
    async (tableId: string): Promise<boolean> => {
      if (!token) return false
      const table = tables.find((t) => t.id === tableId)
      try {
        await api.tables.update(token, tableId, { splitInfo: null })
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Hesap bölme kaldırılamadı", "error")
        return false
      }
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo: undefined } : t)))
      if (table) {
        addAuditLog({
          userId: currentUser?.id || "system",
          userName: currentUser?.name || "Sistem",
          action: "bill_split_cleared",
          category: "payment",
          details: `${table.name}: Hesap bölme kaldırıldı`,
        })
      }
      return true
    },
    [token, tables, currentUser, setTables, addAuditLog],
  )

  const payPersonShare = useCallback(
    async (
      tableId: string,
      shareIndex: number,
      method: CloseCheckSplitMethod,
      amount: number,
      opts?: { ledgerCustomerId?: string },
    ): Promise<{ ok: boolean; fullyClosed?: boolean; completedOrder?: ClosedTable; error?: string }> => {
      if (!token) return { ok: false, error: "Oturum gerekli" }
      if (method === "ledger" && !opts?.ledgerCustomerId) return { ok: false, error: "Müşteri hesabı seçilmelidir" }
      const table = tables.find((t) => t.id === tableId)
      if (!table || table.splitInfo?.type !== "person") return { ok: false, error: "Kişi bölüşümü bulunamadı" }
      const personCount = table.splitInfo.personCount ?? 2
      const existingShares = (table.splitInfo.paidShares ?? []).filter((s) => s.shareIndex !== shareIndex)
      const newShare: PanelSplitSharePayment = {
        shareIndex,
        method,
        amount: fromMinorUnits(toMinorUnits(amount)),
        ...(opts?.ledgerCustomerId ? { ledgerCustomerId: opts.ledgerCustomerId } : {}),
        paidAt: new Date().toISOString(),
      }
      const paidShares = [...existingShares, newShare].sort((a, b) => a.shareIndex - b.shareIndex)

      if (paidShares.length >= personCount) {
        const byMethodMinorUnits = new Map<CloseCheckSplitMethod, number>()
        let ledgerCustomerId: string | undefined
        let ledgerDebtMinorUnits = 0
        for (const s of paidShares) {
          byMethodMinorUnits.set(s.method, (byMethodMinorUnits.get(s.method) ?? 0) + toMinorUnits(s.amount))
          if (s.method === "ledger" && s.ledgerCustomerId) {
            ledgerCustomerId = s.ledgerCustomerId
            ledgerDebtMinorUnits += toMinorUnits(s.amount)
          }
        }
        const aggregatedSplitDetails = Array.from(byMethodMinorUnits.entries()).map(([m, k]) => ({ method: m, amount: fromMinorUnits(k) }))
        const closeRes = await closeTableWithPayment(
          tableId,
          "split",
          table.discount ? { type: table.discount.type, value: table.discount.value, reason: table.discount.reason } : undefined,
          aggregatedSplitDetails,
          ledgerCustomerId ? { ledgerCustomerId, ledgerDebtAmount: fromMinorUnits(ledgerDebtMinorUnits) } : undefined,
        )
        return { ok: closeRes.ok, fullyClosed: closeRes.ok, completedOrder: closeRes.completedOrder, error: closeRes.error }
      }

      const nextSplitInfo: NonNullable<PanelTable["splitInfo"]> = { ...table.splitInfo, type: "person", personCount, paidShares }
      try {
        await api.tables.update(token, tableId, { splitInfo: nextSplitInfo })
        setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, splitInfo: nextSplitInfo } : t)))
        addAuditLog({
          userId: currentUser?.id || "system",
          userName: currentUser?.name || "Sistem",
          action: "person_share_paid",
          category: "payment",
          details: `${table.name}: ${shareIndex + 1}/${personCount}. kişi payı ödendi (${newShare.amount.toFixed(2)} TL - ${method})`,
        })
        return { ok: true, fullyClosed: false }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Kişi payı kaydedilemedi"
        showPanelToast(msg, "error")
        return { ok: false, error: msg }
      }
    },
    [token, tables, currentUser, setTables, addAuditLog, closeTableWithPayment],
  )

  return { addSection, updateSection, deleteSection, addTable, bulkCreateTables, deleteTable, reprintReceipt, applyDiscount, clearDiscount, splitBillByPerson, splitBillByItems, clearSplitBill, payPersonShare }
}
