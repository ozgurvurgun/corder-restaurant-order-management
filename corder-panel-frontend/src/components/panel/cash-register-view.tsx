import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import { api, type LedgerCustomerDto } from "@/lib/api"
import type { CashShift, LedgerCustomer } from "@/lib/panel-types"
import { Plus, Filter } from "lucide-react"
import { AddCashTransactionModal, CloseShiftModal, OpenShiftModal } from "./cash-register/shift-modals"
import { CashTransactionsSection, ShiftOverviewSection } from "./cash-register/open-accounts-section"
import { LedgerCustomersSection } from "./cash-register/ledger-customers-section"
import { DetailReportSection, ZReportSection, type ShiftTotalsSummary } from "./cash-register/shift-history-section"
import { computeDateFilterBounds, formatCurrency, fromMinorUnits, toMinorUnits } from "@/lib/format"
import { CustomDatePicker, CustomSelect } from "@/components/ui/custom-inputs"
import { showPanelToast } from "./panel-toast"

function mapLedgerCustomerDto(c: LedgerCustomerDto): LedgerCustomer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? undefined,
    notes: c.notes ?? undefined,
    balance: Number(c.balance),
    periodNet: c.periodNet != null ? Number(c.periodNet) : undefined,
    createdAt: new Date(c.createdAt),
  }
}

function computeTotalsForShift(
  shift: CashShift | null,
  closedTablesForShift: { netAmount: number; payment?: { method: string; splitDetails?: { method: string; amount: number }[] } }[],
): ShiftTotalsSummary {
  let totalLedgerMinorUnits = 0
  closedTablesForShift.forEach((ct) => {
    const method = ct.payment?.method
    if (method === "ledger") {
      totalLedgerMinorUnits += toMinorUnits(ct.netAmount || 0)
    } else if (method === "split" && ct.payment?.splitDetails) {
      for (const s of ct.payment.splitDetails) {
        if (s.method === "ledger") totalLedgerMinorUnits += toMinorUnits(s.amount || 0)
      }
    }
  })
  return {
    totalRevenue: shift?.totalRevenue || 0,
    totalCash: shift?.totalCash || 0,
    totalCard: shift?.totalCard || 0,
    totalMealCard: shift?.totalMealCard || 0,
    totalMultinet: shift?.totalMultinet || 0,
    totalLedger: fromMinorUnits(totalLedgerMinorUnits),
  }
}

export default function CashRegisterView() {
  const { currentShift, cashShifts, cashTransactions, openShift, closeShift, addCashTransaction, currentUser, tables, closedTables, settings, ledgerCustomers, createLedgerCustomer, addLedgerPayment, ledgerRefresh, hasPermission } = usePanelStore()
  const { token } = usePanelAuth()

  const isBoss = currentUser?.role === "root"
  const canViewCashTotals = isBoss || hasPermission("cash.view", "reports.view_financial")
  const canOpenShift = isBoss || hasPermission("cash.shift_open")
  const canCloseShift = isBoss || hasPermission("cash.shift_close")
  const canTxIn = isBoss || hasPermission("cash.transaction_in")
  const canTxOut = isBoss || hasPermission("cash.transaction_out")
  const canViewHistory = isBoss || hasPermission("cash.view_history", "reports.view_financial")
  const canViewLedger = isBoss || hasPermission("ledger.view", "ledger.manage_customers", "ledger.collect_payment")
  const canManageLedger = isBoss || hasPermission("ledger.manage_customers")
  const canCollectLedger = isBoss || hasPermission("ledger.collect_payment")

  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "ledger" | "z-report" | "detail-report">("overview")
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [filterDate, setFilterDate] = useState("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [ledgerTabCustomers, setLedgerTabCustomers] = useState<LedgerCustomer[] | null>(null)
  const [ledgerTabLoading, setLedgerTabLoading] = useState(false)

  const [openBalance, setOpenBalance] = useState("")
  const [closeBalance, setCloseBalance] = useState("")
  const [closeNotes, setCloseNotes] = useState("")
  const [txType, setTxType] = useState<"expense" | "cash-in" | "cash-out">("expense")
  const [expenseMethod, setExpenseMethod] = useState<"cash" | "credit-card">("cash")
  const [txAmount, setTxAmount] = useState("")
  const [txDesc, setTxDesc] = useState("")
  const [shiftError, setShiftError] = useState("")
  const [shiftLoading, setShiftLoading] = useState(false)
  const [postCloseShift, setPostCloseShift] = useState<CashShift | null>(null)
  const [printingZReport, setPrintingZReport] = useState(false)
  const shiftLoadingRef = useRef(false)

  const openTablesCount = useMemo(() => tables.filter((t) => t.status !== "empty").length, [tables])

  const shiftTransactions = useMemo(() => {
    if (!currentShift) return []
    return cashTransactions
      .filter((t) => t.shiftId === currentShift.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [cashTransactions, currentShift])

  const shiftClosedTables = useMemo(() => {
    if (!currentShift) return []
    const start = new Date(currentShift.openedAt)
    const end = currentShift.closedAt ? new Date(currentShift.closedAt) : new Date()
    return closedTables.filter((ct) => {
      const d = new Date(ct.closedAt)
      return d >= start && d <= end
    })
  }, [currentShift, closedTables])

  const shiftTotals = useMemo(() => computeTotalsForShift(currentShift, shiftClosedTables), [currentShift, shiftClosedTables])

  const closedShifts = useMemo(
    () =>
      cashShifts
        .filter((s) => s.status === "closed")
        .sort((a, b) => new Date(b.closedAt || b.openedAt).getTime() - new Date(a.closedAt || a.openedAt).getTime()),
    [cashShifts],
  )

  const allShiftsSorted = useMemo(() => {
    const list: CashShift[] = []
    if (currentShift) list.push(currentShift)
    for (const s of closedShifts) {
      if (!currentShift || s.id !== currentShift.id) list.push(s)
    }
    return list
  }, [currentShift, closedShifts])

  const [selectedReportShiftId, setSelectedReportShiftId] = useState<string | null>(null)

  const selectedReportShift = useMemo(() => {
    if (selectedReportShiftId) {
      const found = allShiftsSorted.find((s) => s.id === selectedReportShiftId)
      if (found) return found
    }
    return currentShift ?? closedShifts[0] ?? null
  }, [selectedReportShiftId, allShiftsSorted, currentShift, closedShifts])

  const reportShiftClosedTables = useMemo(() => {
    if (!selectedReportShift) return []
    const start = new Date(selectedReportShift.openedAt)
    const end = selectedReportShift.closedAt ? new Date(selectedReportShift.closedAt) : new Date()
    return closedTables.filter((ct) => {
      const d = new Date(ct.closedAt)
      return d >= start && d <= end
    })
  }, [selectedReportShift, closedTables])

  const reportShiftTotals = useMemo(
    () => computeTotalsForShift(selectedReportShift, reportShiftClosedTables),
    [selectedReportShift, reportShiftClosedTables],
  )

  const dateBounds = useMemo(
    () => computeDateFilterBounds(filterDate, customStartDate, customEndDate),
    [filterDate, customStartDate, customEndDate],
  )
  const ledgerBounds = useMemo(
    () => (dateBounds ? { from: dateBounds.from.toISOString(), to: dateBounds.to.toISOString() } : undefined),
    [dateBounds],
  )

  const refetchLedgerTabCustomers = useCallback(async () => {
    if (!token || !ledgerBounds) return
    setLedgerTabLoading(true)
    try {
      const rows = await api.ledgerCustomers.list(token, ledgerBounds)
      setLedgerTabCustomers(rows.map(mapLedgerCustomerDto))
    } catch {
      setLedgerTabCustomers([])
    } finally {
      setLedgerTabLoading(false)
    }
  }, [token, ledgerBounds])

  useEffect(() => {
    if (activeTab !== "ledger" || !token) return
    if (!ledgerBounds) {
      setLedgerTabCustomers(null)
      setLedgerTabLoading(false)
      return
    }
    void refetchLedgerTabCustomers()
  }, [activeTab, token, ledgerBounds, refetchLedgerTabCustomers])

  const filteredClosedTables = useMemo(() => {
    let list = [...closedTables]
    if (dateBounds) {
      list = list.filter((ct) => {
        const d = new Date(ct.closedAt)
        return d >= dateBounds.from && d <= dateBounds.to
      })
    }
    return list.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  }, [closedTables, dateBounds])

  const displayLedgerCustomers = useMemo(
    () => (!ledgerBounds ? ledgerCustomers : (ledgerTabCustomers ?? [])),
    [ledgerBounds, ledgerCustomers, ledgerTabCustomers],
  )

  const handleOpenShift = async () => {
    if (shiftLoading || shiftLoadingRef.current) return
    const bal = parseFloat(openBalance)
    if (!Number.isFinite(bal) || bal < 0) {
      setShiftError("Geçerli bir açılış bakiyesi girin (0 veya üzeri)")
      return
    }
    shiftLoadingRef.current = true
    setShiftError("")
    setShiftLoading(true)
    try {
      await openShift(bal)
      setOpenBalance("")
      setShowOpenShift(false)
    } catch (e) {
      setShiftError(e instanceof Error ? e.message : "Kasa açılamadı")
    } finally {
      shiftLoadingRef.current = false
      setShiftLoading(false)
    }
  }

  const handleCloseShift = async () => {
    if (shiftLoading || shiftLoadingRef.current) return
    if (closeBalance.trim() === "") {
      setShiftError("Lütfen kasadaki fiziksel nakit tutarını girin")
      return
    }
    const bal = parseFloat(closeBalance)
    if (!Number.isFinite(bal) || bal < 0) {
      setShiftError("Geçerli bir kapanış bakiyesi girin (0 veya üzeri)")
      return
    }
    const closingShiftSnapshot = currentShift
      ? {
          ...currentShift,
          status: "closed" as const,
          closingBalance: bal,
          closedAt: new Date(),
          closedBy: currentUser?.name || "Sistem",
          notes: closeNotes.trim() || currentShift.notes,
        }
      : null
    shiftLoadingRef.current = true
    setShiftError("")
    setShiftLoading(true)
    try {
      await closeShift(bal, closeNotes.trim() || undefined)
      if (closingShiftSnapshot) {
        setSelectedReportShiftId(closingShiftSnapshot.id)
        setPostCloseShift(closingShiftSnapshot)
      } else {
        setShowCloseShift(false)
      }
      setCloseBalance("")
      setCloseNotes("")
    } catch (e) {
      setShiftError(e instanceof Error ? e.message : "Kasa kapatılamadı")
    } finally {
      shiftLoadingRef.current = false
      setShiftLoading(false)
    }
  }

  const handlePrintClosedShiftZReport = async (shiftId: string) => {
    if (!token || printingZReport) return
    setPrintingZReport(true)
    try {
      await api.shifts.printReport(token, shiftId)
      showPanelToast("Z Raporu kasa yazıcısına gönderildi", "success")
      setPostCloseShift(null)
      setShowCloseShift(false)
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Z Raporu yazıcıya gönderilemedi", "error")
    } finally {
      setPrintingZReport(false)
    }
  }

  const handleAddTransaction = async () => {
    const amount = parseFloat(txAmount)
    if (!Number.isFinite(amount) || amount <= 0 || !txDesc.trim()) return
    const ok = await addCashTransaction({
      type: txType,
      amount,
      description: txDesc.trim(),
      ...(txType === "expense" ? { reference: expenseMethod } : {}),
      createdBy: currentUser?.name || "Sistem",
    })
    if (ok) {
      setTxAmount("")
      setTxDesc("")
      setExpenseMethod("cash")
      setShowAddTransaction(false)
    }
  }

  const cashRegisterTabs = useMemo(
    () => [
      { id: "overview" as const, label: "Kasa Özeti" },
      ...(canViewCashTotals || canTxIn || canTxOut ? [{ id: "transactions" as const, label: "İşlemler" }] : []),
      ...(canViewLedger ? [{ id: "ledger" as const, label: "Cariler" }] : []),
      ...(canViewHistory
        ? [
            { id: "z-report" as const, label: "X / Z Raporu" },
            { id: "detail-report" as const, label: "Detay Raporu" },
          ]
        : []),
    ],
    [canTxIn, canTxOut, canViewCashTotals, canViewHistory, canViewLedger],
  )

  const filteredNetTotal = useMemo(
    () => fromMinorUnits(filteredClosedTables.reduce((s, ct) => s + toMinorUnits(ct.netAmount), 0)),
    [filteredClosedTables],
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-[#86868b]" />
          <CustomSelect
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 cursor-pointer"
          >
            <option value="today">Bugün</option>
            <option value="yesterday">Dün</option>
            <option value="week">Son 7 Gün</option>
            <option value="month">Son 30 Gün</option>
            <option value="custom">Özel Tarih</option>
            <option value="all">Tümü</option>
          </CustomSelect>
          {filterDate === "custom" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Başlangıç:</span>
                <CustomDatePicker value={customStartDate.slice(0, 10)} onChange={(e) => setCustomStartDate(e.target.value)} className="h-[30px] px-2.5 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Bitiş:</span>
                <CustomDatePicker value={customEndDate.slice(0, 10)} onChange={(e) => setCustomEndDate(e.target.value)} className="h-[30px] px-2.5 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              </div>
            </>
          )}
          <span className="text-[11px] text-[#86868b] ml-2">
            {filteredClosedTables.length} sipariş
            {canViewCashTotals ? ` | \u20BA${formatCurrency(filteredNetTotal)}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {currentShift ? (
            <>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                Kasa Açık - {currentShift.openedBy}
              </span>
              {canCloseShift && (
                <button
                  onClick={() => {
                    setShiftError("")
                    setPostCloseShift(null)
                    setShowCloseShift(true)
                  }}
                  className="h-[30px] px-3 flex items-center gap-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium hover:bg-red-600 transition-colors"
                >
                  Kasa Kapat
                </button>
              )}
            </>
          ) : (
            canOpenShift && (
              <button
                onClick={() => {
                  setShiftError("")
                  setShowOpenShift(true)
                }}
                className="h-[30px] px-3 flex items-center gap-1.5 bg-[#34c759] text-white rounded-lg text-[12px] font-medium hover:bg-[#2db84e] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Kasa Aç
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex gap-1.5">
        {cashRegisterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors ${activeTab === tab.id ? "bg-[#e63462] text-white" : "text-[#86868b] hover:bg-black/[0.04]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="w-full flex flex-col gap-5">
          {activeTab === "overview" && (
            <ShiftOverviewSection
              currentShift={currentShift}
              shiftTotals={shiftTotals}
              shiftTransactions={shiftTransactions}
              closedShifts={closedShifts}
              canViewCashTotals={canViewCashTotals}
              canOpenShift={canOpenShift}
              canTxIn={canTxIn}
              canTxOut={canTxOut}
              canViewHistory={canViewHistory}
              onOpenShiftModal={() => {
                setShiftError("")
                setShowOpenShift(true)
              }}
              onOpenAddTransaction={(t) => {
                setTxType(t)
                setShowAddTransaction(true)
              }}
            />
          )}
          {activeTab === "transactions" && (
            <CashTransactionsSection
              cashTransactions={cashTransactions}
              currentShift={currentShift}
              canAddTransaction={canTxIn || canTxOut}
              onOpenAddTransaction={() => setShowAddTransaction(true)}
            />
          )}
          {activeTab === "ledger" && (
            <LedgerCustomersSection
              token={token}
              ledgerBounds={ledgerBounds}
              ledgerTabLoading={ledgerTabLoading}
              ledgerTabCustomers={ledgerTabCustomers}
              ledgerCustomers={ledgerCustomers}
              displayLedgerCustomers={displayLedgerCustomers}
              canManageLedger={canManageLedger}
              canCollectLedger={canCollectLedger}
              hasOpenShift={Boolean(currentShift)}
              ledgerRefresh={ledgerRefresh}
              refetchLedgerTabCustomers={refetchLedgerTabCustomers}
              createLedgerCustomer={createLedgerCustomer}
              addLedgerPayment={addLedgerPayment}
            />
          )}
          {activeTab === "z-report" && (
            <ZReportSection
              settings={settings}
              selectedShift={selectedReportShift}
              allShifts={allShiftsSorted}
              onSelectShift={setSelectedReportShiftId}
              shiftTotals={reportShiftTotals}
              shiftClosedCount={reportShiftClosedTables.length}
            />
          )}
          {activeTab === "detail-report" && (
            <DetailReportSection filteredClosedTables={filteredClosedTables} />
          )}
        </div>
      </div>

      {showOpenShift && (
        <OpenShiftModal openBalance={openBalance} setOpenBalance={setOpenBalance} shiftError={shiftError} shiftLoading={shiftLoading} onClose={() => setShowOpenShift(false)} onSubmit={() => void handleOpenShift()} />
      )}
      {showCloseShift && (
        <CloseShiftModal
          currentShift={currentShift}
          closedShift={postCloseShift}
          printingReport={printingZReport}
          onPrintZReport={(shiftId) => void handlePrintClosedShiftZReport(shiftId)}
          closeBalance={closeBalance}
          setCloseBalance={setCloseBalance}
          closeNotes={closeNotes}
          setCloseNotes={setCloseNotes}
          shiftError={shiftError}
          shiftLoading={shiftLoading}
          canViewExpected={canViewHistory}
          openTablesCount={openTablesCount}
          onClose={() => { setPostCloseShift(null); setShowCloseShift(false) }}
          onSubmit={() => void handleCloseShift()}
        />
      )}
      {showAddTransaction && (
        <AddCashTransactionModal txType={txType} setTxType={setTxType} expenseMethod={expenseMethod} setExpenseMethod={setExpenseMethod} txAmount={txAmount} setTxAmount={setTxAmount} txDesc={txDesc} setTxDesc={setTxDesc} canTxIn={canTxIn} canTxOut={canTxOut} onClose={() => setShowAddTransaction(false)} onSubmit={handleAddTransaction} />
      )}
    </div>
  )
}
