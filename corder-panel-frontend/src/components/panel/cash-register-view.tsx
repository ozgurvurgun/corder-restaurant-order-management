import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import { api, type LedgerCustomerDto } from "@/lib/api"
import type { LedgerCustomer } from "@/lib/panel-types"
import { Plus, Filter } from "lucide-react"
import { AddCashTransactionModal, CloseShiftModal, OpenShiftModal } from "./cash-register/shift-modals"
import { CashTransactionsSection, ShiftOverviewSection } from "./cash-register/open-accounts-section"
import { LedgerCustomersSection } from "./cash-register/ledger-customers-section"
import { DetailReportSection, ZReportSection } from "./cash-register/shift-history-section"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }

function parseYmdLocal(s: string) {
  const p = s.trim().split("-").map(Number)
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return new Date(NaN)
  const [y, m, d] = p
  return new Date(y, m - 1, d)
}

function startOfLocalDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function endOfLocalDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) }

function cashRegisterDateBounds(filterDate: string, customStartDate: string, customEndDate: string): { from: string; to: string } | undefined {
  if (filterDate === "all") return undefined
  const now = new Date()
  const today = startOfLocalDay(now)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30)
  const endToday = endOfLocalDay(today)
  if (filterDate === "today") return { from: today.toISOString(), to: endToday.toISOString() }
  if (filterDate === "yesterday") return { from: yesterday.toISOString(), to: endOfLocalDay(yesterday).toISOString() }
  if (filterDate === "week") return { from: weekAgo.toISOString(), to: endToday.toISOString() }
  if (filterDate === "month") return { from: monthAgo.toISOString(), to: endToday.toISOString() }
  if (filterDate === "custom" && customStartDate.trim()) {
    const start = startOfLocalDay(parseYmdLocal(customStartDate))
    const endDay = customEndDate.trim() ? parseYmdLocal(customEndDate) : today
    const end = customEndDate.trim() ? endOfLocalDay(endDay) : endToday
    return { from: start.toISOString(), to: end.toISOString() }
  }
  return undefined
}

function mapLedgerCustomerDto(c: LedgerCustomerDto): LedgerCustomer {
  return {
    id: c.id, name: c.name, phone: c.phone ?? undefined, notes: c.notes ?? undefined,
    balance: Number(c.balance), periodNet: c.periodNet != null ? Number(c.periodNet) : undefined,
    createdAt: new Date(c.createdAt),
  }
}

export default function CashRegisterView() {
  const {
    currentShift, cashShifts, cashTransactions, openShift, closeShift,
    addCashTransaction, currentUser, closedTables, settings,
    ledgerCustomers, createLedgerCustomer, addLedgerPayment, ledgerRefresh,
  } = usePanelStore()
  const { token } = usePanelAuth()

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
  const [txAmount, setTxAmount] = useState("")
  const [txDesc, setTxDesc] = useState("")
  const [shiftError, setShiftError] = useState("")
  const [shiftLoading, setShiftLoading] = useState(false)
  const shiftLoadingRef = useRef(false)

  const shiftTransactions = useMemo(() => {
    if (!currentShift) return []
    return cashTransactions.filter((t) => t.shiftId === currentShift.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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

  const shiftTotals = useMemo(() => {
    let totalLedgerKurus = 0
    shiftClosedTables.forEach((ct) => {
      const method = ct.payment?.method
      if (method === "ledger") totalLedgerKurus += Math.round((ct.netAmount || 0) * 100)
      else if (method === "split" && ct.payment?.splitDetails) {
        for (const s of ct.payment.splitDetails) {
          if (s.method === "ledger") totalLedgerKurus += Math.round((s.amount || 0) * 100)
        }
      }
    })
    return {
      totalRevenue: currentShift?.totalRevenue || 0,
      totalCash: currentShift?.totalCash || 0,
      totalCard: currentShift?.totalCard || 0,
      totalMealCard: currentShift?.totalMealCard || 0,
      totalMultinet: currentShift?.totalMultinet || 0,
      totalLedger: totalLedgerKurus / 100,
    }
  }, [currentShift, shiftClosedTables])

  const closedShifts = useMemo(
    () => cashShifts.filter((s) => s.status === "closed").sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime()),
    [cashShifts],
  )

  const ledgerWithBalance = ledgerCustomers.filter((c) => c.balance > 0.009)
  const ledgerBounds = useMemo(() => cashRegisterDateBounds(filterDate, customStartDate, customEndDate), [filterDate, customStartDate, customEndDate])

  const refetchLedgerTabCustomers = useCallback(async () => {
    if (!token || !ledgerBounds) return
    setLedgerTabLoading(true)
    try {
      const rows = await api.ledgerCustomers.list(token, ledgerBounds)
      setLedgerTabCustomers(rows.map(mapLedgerCustomerDto))
    } catch { setLedgerTabCustomers([]) } finally { setLedgerTabLoading(false) }
  }, [token, ledgerBounds])

  useEffect(() => {
    if (activeTab !== "ledger" || !token) return
    if (!ledgerBounds) { setLedgerTabCustomers(null); setLedgerTabLoading(false); return }
    void refetchLedgerTabCustomers()
  }, [activeTab, token, ledgerBounds, refetchLedgerTabCustomers])

  const filteredClosedTables = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30)

    let list = [...closedTables]
    if (filterDate === "today") list = list.filter((ct) => new Date(ct.closedAt) >= today)
    else if (filterDate === "yesterday") list = list.filter((ct) => { const d = new Date(ct.closedAt); return d >= yesterday && d < today })
    else if (filterDate === "week") list = list.filter((ct) => new Date(ct.closedAt) >= weekAgo)
    else if (filterDate === "month") list = list.filter((ct) => new Date(ct.closedAt) >= monthAgo)
    else if (filterDate === "custom" && customStartDate) {
      const start = new Date(customStartDate)
      const end = customEndDate ? new Date(customEndDate) : new Date()
      list = list.filter((ct) => { const d = new Date(ct.closedAt); return d >= start && d <= end })
    }
    return list.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  }, [closedTables, filterDate, customStartDate, customEndDate])

  const displayLedgerCustomers = useMemo(() => (!ledgerBounds ? ledgerCustomers : (ledgerTabCustomers ?? [])), [ledgerBounds, ledgerCustomers, ledgerTabCustomers])
  const todaysClosed = useMemo(() => { const today = new Date(); today.setHours(0, 0, 0, 0); return closedTables.filter((ct) => new Date(ct.closedAt) >= today) }, [closedTables])

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
    const bal = closeBalance.trim() === "" ? 0 : parseFloat(closeBalance)
    if (!Number.isFinite(bal) || bal < 0) {
      setShiftError("Geçerli bir kapanış bakiyesi girin (0 veya üzeri)")
      return
    }
    shiftLoadingRef.current = true
    setShiftError("")
    setShiftLoading(true)
    try {
      await closeShift(bal, closeNotes.trim() || undefined)
      setCloseBalance("")
      setCloseNotes("")
      setShowCloseShift(false)
    } catch (e) {
      setShiftError(e instanceof Error ? e.message : "Kasa kapatılamadı")
    } finally {
      shiftLoadingRef.current = false
      setShiftLoading(false)
    }
  }

  const handleAddTransaction = async () => {
    const amount = parseFloat(txAmount)
    if (!Number.isFinite(amount) || amount <= 0 || !txDesc.trim()) return
    const ok = await addCashTransaction({
      type: txType,
      amount,
      description: txDesc.trim(),
      createdBy: currentUser?.name || "Sistem",
    })
    if (ok) {
      setTxAmount("")
      setTxDesc("")
      setShowAddTransaction(false)
    }
  }

  const cashRegisterTabs = useMemo(() => {
    const ledgerLabel = !ledgerBounds ? `Cariler (${ledgerWithBalance.length})` : ledgerTabLoading ? "Cariler (…)" : `Cariler (${(ledgerTabCustomers ?? []).length})`
    return [
      { id: "overview" as const, label: "Kasa Özeti" },
      { id: "transactions" as const, label: "İşlemler" },
      { id: "ledger" as const, label: ledgerLabel },
      { id: "z-report" as const, label: "Z Raporu" },
      { id: "detail-report" as const, label: "Detay Raporu" },
    ]
  }, [ledgerBounds, ledgerTabLoading, ledgerTabCustomers, ledgerWithBalance.length])

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Kasa</h2>
          <div className="flex items-center gap-3">
            {currentShift ? (
              <>
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">Kasa Açık - {currentShift.openedBy}</span>
                <button onClick={() => setShowCloseShift(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium hover:bg-red-600 transition-colors">Kasa Kapat</button>
              </>
            ) : (
              <button onClick={() => setShowOpenShift(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#34c759] text-white rounded-lg text-[12px] font-medium hover:bg-[#2db84e] transition-colors">
                <Plus className="w-3.5 h-3.5" /> Kasa Aç
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Filter className="w-3.5 h-3.5 text-[#86868b]" />
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none pr-7 cursor-pointer">
            <option value="today">Bugün</option>
            <option value="yesterday">Dün</option>
            <option value="week">Son 7 Gün</option>
            <option value="month">Son 30 Gün</option>
            <option value="custom">Özel Tarih</option>
            <option value="all">Tümü</option>
          </select>
          {filterDate === "custom" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Başlangıç:</span>
                <input type="datetime-local" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Bitiş:</span>
                <input type="datetime-local" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              </div>
            </>
          )}
          <span className="text-[11px] text-[#86868b] ml-2">
            {filteredClosedTables.length} sipariş | {"\u20BA"}{formatCurrency(filteredClosedTables.reduce((s, ct) => s + ct.netAmount, 0))}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex gap-1.5">
        {cashRegisterTabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors ${activeTab === tab.id ? "bg-[#e63462] text-white" : "text-[#86868b] hover:bg-black/[0.04]"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-5xl flex flex-col gap-5">
          {activeTab === "overview" && (
            <ShiftOverviewSection
              currentShift={currentShift}
              shiftTotals={shiftTotals}
              shiftTransactions={shiftTransactions}
              closedShifts={closedShifts}
              onOpenShiftModal={() => setShowOpenShift(true)}
              onOpenAddTransaction={(t) => { setTxType(t); setShowAddTransaction(true) }}
            />
          )}
          {activeTab === "transactions" && (
            <CashTransactionsSection cashTransactions={cashTransactions} currentShift={currentShift} onOpenAddTransaction={() => setShowAddTransaction(true)} />
          )}
          {activeTab === "ledger" && (
            <LedgerCustomersSection
              token={token} ledgerBounds={ledgerBounds} ledgerTabLoading={ledgerTabLoading} ledgerTabCustomers={ledgerTabCustomers}
              ledgerCustomers={ledgerCustomers} displayLedgerCustomers={displayLedgerCustomers}
              ledgerRefresh={ledgerRefresh} refetchLedgerTabCustomers={refetchLedgerTabCustomers}
              createLedgerCustomer={createLedgerCustomer} addLedgerPayment={addLedgerPayment}
            />
          )}
          {activeTab === "z-report" && (
            <ZReportSection settings={settings} currentShift={currentShift} shiftTotals={shiftTotals} todaysClosedCount={todaysClosed.length} />
          )}
          {activeTab === "detail-report" && (
            <DetailReportSection filteredClosedTables={filteredClosedTables} />
          )}
        </div>
      </div>

      {showOpenShift && <OpenShiftModal openBalance={openBalance} setOpenBalance={setOpenBalance} shiftError={shiftError} shiftLoading={shiftLoading} onClose={() => setShowOpenShift(false)} onSubmit={() => void handleOpenShift()} />}
      {showCloseShift && <CloseShiftModal currentShift={currentShift} closeBalance={closeBalance} setCloseBalance={setCloseBalance} closeNotes={closeNotes} setCloseNotes={setCloseNotes} shiftError={shiftError} shiftLoading={shiftLoading} onClose={() => setShowCloseShift(false)} onSubmit={() => void handleCloseShift()} />}
      {showAddTransaction && <AddCashTransactionModal txType={txType} setTxType={setTxType} txAmount={txAmount} setTxAmount={setTxAmount} txDesc={txDesc} setTxDesc={setTxDesc} onClose={() => setShowAddTransaction(false)} onSubmit={handleAddTransaction} />}
    </div>
  )
}
