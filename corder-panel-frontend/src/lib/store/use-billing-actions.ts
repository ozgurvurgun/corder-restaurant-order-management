import { useCallback } from "react"
import type {
  CashShift,
  CashTransaction,
  ClosedTable,
  LedgerCustomer,
  OpenAccount,
  OpenAccountCreateLine,
  PanelUser,
  StockMaterial,
  StockMovement,
} from "../panel-types"
import {
  api,
  type CloseCheckResponseDto,
  type CompletedOrderUpdateBody,
} from "../api"
import {
  mapCashTransactionDtoToPanel,
  mapCompletedOrderDtoToClosedTable,
  mapLedgerCustomerDtoToPanel,
  mapOpenAccountDtoToPanel,
  mapShiftDtoToPanel,
} from "../mappers/billing.mapper"
import { mapStockMovementDtoToPanel } from "../mappers/catalog-inventory.mapper"
import { showPanelToast } from "@/components/panel/panel-toast"
import type { LogActivityFn } from "./panel-store-context"

export function useBillingActions(params: {
  token: string | null
  currentUser: PanelUser | null
  currentShift: CashShift | null
  ledgerCustomers: LedgerCustomer[]
  setCashShifts: (v: CashShift[] | ((prev: CashShift[]) => CashShift[])) => void
  setCashTransactions: (v: CashTransaction[] | ((prev: CashTransaction[]) => CashTransaction[])) => void
  setClosedTables: (v: ClosedTable[] | ((prev: ClosedTable[]) => ClosedTable[])) => void
  setStockMovements: (v: StockMovement[] | ((prev: StockMovement[]) => StockMovement[])) => void
  setStockMaterials: (v: StockMaterial[] | ((prev: StockMaterial[]) => StockMaterial[])) => void
  setOpenAccounts: (v: OpenAccount[] | ((prev: OpenAccount[]) => OpenAccount[])) => void
  setLedgerCustomers: (v: LedgerCustomer[] | ((prev: LedgerCustomer[]) => LedgerCustomer[])) => void
  logActivity: LogActivityFn
}) {
  const {
    token,
    currentShift,
    ledgerCustomers,
    setCashShifts,
    setCashTransactions,
    setClosedTables,
    setStockMovements,
    setStockMaterials,
    setOpenAccounts,
    setLedgerCustomers,
    logActivity,
  } = params

  const refreshCurrentShiftAndTx = useCallback(async () => {
    if (!token) return
    const freshShift = await api.shifts.getCurrent(token).catch(() => null)
    if (freshShift) {
      const mappedShift = mapShiftDtoToPanel(freshShift)
      setCashShifts((prev) =>
        prev.some((s) => s.id === mappedShift.id)
          ? prev.map((s) => (s.id === mappedShift.id ? mappedShift : s))
          : [mappedShift, ...prev],
      )
      const cashTxRes = await api.cashTransactions
        .list(token, freshShift.id)
        .catch(() => null)
      if (cashTxRes) {
        setCashTransactions(cashTxRes.map(mapCashTransactionDtoToPanel))
      }
    }
  }, [token, setCashShifts, setCashTransactions])

  const applyCloseCheckResult = useCallback(
    (res: CloseCheckResponseDto): ClosedTable => {
      const mapped = mapCompletedOrderDtoToClosedTable(res.completedOrder)
      setClosedTables((prev) => [mapped, ...prev.filter((x) => x.id !== mapped.id)])
      const nextShift = mapShiftDtoToPanel(res.shift)
      setCashShifts((prev) =>
        prev.some((s) => s.id === nextShift.id)
          ? prev.map((s) => (s.id === nextShift.id ? nextShift : s))
          : [nextShift, ...prev],
      )
      if (res.cashTransaction) {
        const tx = mapCashTransactionDtoToPanel(res.cashTransaction)
        setCashTransactions((prev) => [tx, ...prev.filter((x) => x.id !== tx.id)])
      }
      if (res.stockMovements.length > 0) {
        const mappedMvs = res.stockMovements.map(mapStockMovementDtoToPanel)
        setStockMovements((prev) => [...mappedMvs, ...prev])
        const stockByMaterial = new Map(
          res.stockMovements.map((mv) => [
            mv.materialId,
            { newStock: Number(mv.newStock), createdAt: new Date(mv.createdAt) },
          ]),
        )
        setStockMaterials((prev) =>
          prev.map((sm) => {
            const hit = stockByMaterial.get(sm.id)
            if (!hit) return sm
            return { ...sm, currentStock: hit.newStock, lastUpdated: hit.createdAt }
          }),
        )
      }
      return mapped
    },
    [setClosedTables, setCashShifts, setCashTransactions, setStockMovements, setStockMaterials],
  )

  const openShift = useCallback(
    async (openingBalance: number) => {
      if (!token) return
      try {
        const res = await api.shifts.open(token, openingBalance)
        const mappedShift = mapShiftDtoToPanel(res)
        setCashShifts((prev) => [
          mappedShift,
          ...prev.filter((s) => s.id !== mappedShift.id),
        ])
        setCashTransactions([])
        logActivity({
          action: "shift_opened",
          category: "cash-register",
          details: `Vardiya açıldı. Açılış bakiyesi: ${openingBalance}`,
          metadata: { shiftId: res.id, openingBalance },
        })
        showPanelToast("Kasa açıldı", "success")
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Kasa açılamadı", "error")
        throw err
      }
    },
    [token, setCashShifts, setCashTransactions, logActivity],
  )

  const closeShift = useCallback(
    async (closingBalance: number, notes?: string) => {
      if (!token || !currentShift) return
      try {
        const res = await api.shifts.close(token, currentShift.id, closingBalance, notes)
        setCashShifts((prev) =>
          prev.map((s) => (s.id === currentShift.id ? mapShiftDtoToPanel(res) : s)),
        )
        logActivity({
          action: "shift_closed",
          category: "cash-register",
          details: `Vardiya kapatıldı. Kapanış bakiyesi: ${closingBalance}${notes ? ` (${notes})` : ""}`,
          metadata: { shiftId: currentShift.id, closingBalance, notes },
        })
        showPanelToast("Kasa kapatıldı", "success")
      } catch (err) {
        showPanelToast(err instanceof Error ? err.message : "Kasa kapatılamadı", "error")
        throw err
      }
    },
    [token, currentShift, setCashShifts, logActivity],
  )

  const addCashTransaction = useCallback(
    async (t: {
      type: "expense" | "cash-in" | "cash-out" | "refund"
      amount: number
      description: string
      reference?: string
      createdBy?: string
    }): Promise<boolean> => {
      if (!currentShift || !token) return false
      try {
        const res = await api.cashTransactions.create(token, {
          type: t.type,
          amount: t.amount,
          description: t.description.trim(),
          ...(t.reference?.trim() ? { reference: t.reference.trim() } : {}),
        })
        const tx = mapCashTransactionDtoToPanel(res.transaction)
        setCashTransactions((prev) => [tx, ...prev.filter((x) => x.id !== tx.id)])
        setCashShifts((prev) =>
          prev.map((s) => (s.id === res.shift.id ? mapShiftDtoToPanel(res.shift) : s)),
        )
        logActivity({
          action: "cash_transaction_created",
          category: "cash-register",
          details: `${t.type} işlemi: ${t.amount} - ${t.description}`,
          metadata: {
            shiftId: res.shift.id,
            type: t.type,
            amount: t.amount,
            reference: t.reference,
          },
        })
        showPanelToast("Kasa işlemi kaydedildi", "success")
        return true
      } catch (err) {
        showPanelToast(
          err instanceof Error ? err.message : "Kasa işlemi eklenemedi",
          "error",
        )
        return false
      }
    },
    [currentShift, token, setCashTransactions, setCashShifts, logActivity],
  )

  const ledgerRefresh = useCallback(async () => {
    if (!token) return
    try {
      const list = await api.ledgerCustomers.list(token)
      setLedgerCustomers(list.map(mapLedgerCustomerDtoToPanel))
    } catch (err) {
      showPanelToast(
        err instanceof Error ? err.message : "Cari listesi yenilenemedi",
        "error",
      )
    }
  }, [token, setLedgerCustomers])

  const createLedgerCustomer = useCallback(
    async (body: {
      name: string
      phone?: string
      notes?: string
    }): Promise<LedgerCustomer | null> => {
      const name = body.name.trim()
      if (!name || !token) return null
      try {
        const c = await api.ledgerCustomers.create(token, {
          name,
          ...(body.phone?.trim() ? { phone: body.phone.trim() } : {}),
          ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
        })
        const mapped = mapLedgerCustomerDtoToPanel(c)
        setLedgerCustomers((prev) =>
          [...prev.filter((x) => x.id !== mapped.id), mapped].sort((a, b) =>
            a.name.localeCompare(b.name, "tr"),
          ),
        )
        logActivity({
          action: "ledger_customer_created",
          category: "payment",
          details: `Müşteri hesabı oluşturuldu: ${mapped.name}`,
          metadata: { customerId: mapped.id, name: mapped.name, phone: mapped.phone },
        })
        showPanelToast(`Cari hesap oluşturuldu: ${mapped.name}`, "success")
        return mapped
      } catch (err) {
        showPanelToast(
          err instanceof Error ? err.message : "Cari müşteri oluşturulamadı",
          "error",
        )
        return null
      }
    },
    [token, setLedgerCustomers, logActivity],
  )

  const addLedgerPayment = useCallback(
    async (
      customerId: string,
      amount: number,
      paymentMethod: "cash" | "credit-card" | "meal-card" | "multinet" = "cash",
    ): Promise<boolean> => {
      if (!token) return false
      const pay = Number(amount)
      if (!Number.isFinite(pay) || pay <= 0) return false
      try {
        const updated = await api.ledgerCustomers.pay(
          token,
          customerId,
          pay,
          paymentMethod,
        )
        setLedgerCustomers((prev) =>
          prev.map((x) =>
            x.id === customerId ? { ...x, balance: Number(updated.balance) } : x,
          ),
        )
        await refreshCurrentShiftAndTx()
        const customerName =
          ledgerCustomers.find((c) => c.id === customerId)?.name || customerId
        logActivity({
          action: "ledger_payment_added",
          category: "payment",
          details: `${customerName} hesabına ödeme eklendi: ${pay} (${paymentMethod})`,
          metadata: { customerId, amount: pay, paymentMethod },
        })
        showPanelToast("Tahsilat kaydedildi", "success")
        return true
      } catch (err) {
        showPanelToast(
          err instanceof Error ? err.message : "Tahsilat kaydedilemedi",
          "error",
        )
        return false
      }
    },
    [
      token,
      ledgerCustomers,
      setLedgerCustomers,
      refreshCurrentShiftAndTx,
      logActivity,
    ],
  )

  const addOpenAccount = useCallback(
    async (
      a: Omit<
        OpenAccount,
        "id" | "createdAt" | "status" | "paidAt" | "items" | "payments"
      > & {
        items?: OpenAccountCreateLine[]
      },
    ): Promise<boolean> => {
      if (!token) return false
      try {
        const created = await api.openAccounts.create(token, {
          customerName: a.customerName,
          customerPhone: a.customerPhone,
          amount: a.items?.length ? undefined : a.amount,
          description: a.items?.length ? a.description || undefined : a.description,
          createdBy: a.createdBy,
          items: a.items?.length
            ? a.items.map((it) => ({
                productName: it.productName,
                quantity: it.quantity,
                price: it.price,
                productId: it.productId,
                note: it.note,
              }))
            : undefined,
        })
        setOpenAccounts((prev) => [mapOpenAccountDtoToPanel(created), ...prev])
        logActivity({
          action: "open_account_created",
          category: "payment",
          details: `Veresiye hesap oluşturuldu: ${created.customerName}`,
          metadata: { accountId: created.id, amount: created.amount },
        })
        showPanelToast("Veresiye hesap oluşturuldu", "success")
        return true
      } catch (err) {
        showPanelToast(
          err instanceof Error ? err.message : "Veresiye hesap oluşturulamadı",
          "error",
        )
        return false
      }
    },
    [token, setOpenAccounts, logActivity],
  )

  const payOpenAccount = useCallback(
    async (
      id: string,
      amount: number,
      paymentMethod: "cash" | "credit-card" | "meal-card" | "multinet" = "cash",
    ): Promise<boolean> => {
      if (!token) return false
      try {
        const updated = await api.openAccounts.pay(token, id, amount, paymentMethod)
        setOpenAccounts((prev) =>
          prev.map((a) => (a.id === updated.id ? mapOpenAccountDtoToPanel(updated) : a)),
        )
        await refreshCurrentShiftAndTx()
        logActivity({
          action: "open_account_payment_received",
          category: "payment",
          details: `Veresiye tahsilat alındı: ${updated.customerName} - ${amount}`,
          metadata: { accountId: id, amount, paymentMethod },
        })
        showPanelToast("Veresiye tahsilatı alındı", "success")
        return true
      } catch (err) {
        showPanelToast(
          err instanceof Error ? err.message : "Veresiye tahsilatı alınamadı",
          "error",
        )
        return false
      }
    },
    [token, setOpenAccounts, refreshCurrentShiftAndTx, logActivity],
  )

  const updateCompletedOrder = useCallback(
    async (
      completedId: string,
      body: CompletedOrderUpdateBody,
    ): Promise<ClosedTable | null> => {
      if (!token) return null
      try {
        const updated = await api.completedOrders.update(token, completedId, body)
        const mapped = mapCompletedOrderDtoToClosedTable(updated)
        setClosedTables((prev) => prev.map((c) => (c.id === completedId ? mapped : c)))
        await refreshCurrentShiftAndTx()
        return mapped
      } catch (err) {
        showPanelToast(
          err instanceof Error ? err.message : "Tamamlanan sipariş güncellenemedi",
          "error",
        )
        return null
      }
    },
    [token, setClosedTables, refreshCurrentShiftAndTx],
  )

  return {
    applyCloseCheckResult,
    openShift,
    closeShift,
    addCashTransaction,
    ledgerRefresh,
    createLedgerCustomer,
    addLedgerPayment,
    addOpenAccount,
    payOpenAccount,
    updateCompletedOrder,
  }
}
