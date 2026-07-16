import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"
import type { LedgerCustomerDto } from "@/lib/api"
import type { LedgerCustomer, LedgerEntry } from "@/lib/panel-types"
import {
  DollarSign, CreditCard, Banknote, UtensilsCrossed, ArrowDownCircle, ArrowUpCircle,
  X, Plus, Receipt, Wallet, AlertTriangle, Printer, Filter,
  BookUser, Loader2,
} from "lucide-react"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }
function formatTime(d: Date) { return new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) }
function formatFullDate(d: Date) { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) }

function parseYmdLocal(s: string) {
  const p = s.trim().split("-").map(Number)
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return new Date(NaN)
  const [y, m, d] = p
  return new Date(y, m - 1, d)
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/** ISO range aligned with the register header date filter; undefined for `All`. */
function kasaLedgerDateBounds(
  filterDate: string,
  customStartDate: string,
  customEndDate: string,
): { from: string; to: string } | undefined {
  if (filterDate === "all") return undefined
  const now = new Date()
  const today = startOfLocalDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)
  /** Do not use `now` for `to`: it freezes inside useMemo; new lines after collection fall outside the range. */
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
    id: c.id,
    name: c.name,
    phone: c.phone ?? undefined,
    notes: c.notes ?? undefined,
    balance: Number(c.balance),
    periodNet: c.periodNet !== undefined && c.periodNet !== null ? Number(c.periodNet) : undefined,
    createdAt: new Date(c.createdAt),
  }
}

export default function KasaView() {
  const {
    currentShift, cashShifts, cashTransactions,
    openShift, closeShift, addCashTransaction,
    currentUser, closedTables, settings,
    ledgerCustomers, createLedgerCustomer, addLedgerPayment, ledgerRefresh,
  } = usePanelStore()
  const { token } = usePanelAuth()

  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "ledger" | "z-report" | "detail-report">("overview")
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [showAddLedger, setShowAddLedger] = useState(false)
  const [ledgerDetailId, setLedgerDetailId] = useState<string | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [ledgerEntriesLoading, setLedgerEntriesLoading] = useState(false)
  const [ledgerPayAmount, setLedgerPayAmount] = useState("")
  const [ledgerPayBusy, setLedgerPayBusy] = useState(false)
  const [filterDate, setFilterDate] = useState("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [ledgerTabCustomers, setLedgerTabCustomers] = useState<LedgerCustomer[] | null>(null)
  const [ledgerTabLoading, setLedgerTabLoading] = useState(false)
  const zReportRef = useRef<HTMLDivElement>(null)

  // Open shift form
  const [openBalance, setOpenBalance] = useState("")

  // Close shift form
  const [closeBalance, setCloseBalance] = useState("")
  const [closeNotes, setCloseNotes] = useState("")

  // Transaction form
  const [txType, setTxType] = useState<"expense" | "cash-in" | "cash-out">("expense")
  const [txAmount, setTxAmount] = useState("")
  const [txDesc, setTxDesc] = useState("")

  const [lcName, setLcName] = useState("")
  const [lcPhone, setLcPhone] = useState("")
  const [lcNotes, setLcNotes] = useState("")
  const [lcSaving, setLcSaving] = useState(false)

  useEffect(() => {
    if (!showAddLedger) return
    setLcName("")
    setLcPhone("")
    setLcNotes("")
  }, [showAddLedger])

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
    let totalRevenue = 0
    let totalNakit = 0
    let totalKart = 0
    let totalYemekKarti = 0
    let totalMultinet = 0
    let totalCari = 0

    shiftClosedTables.forEach((ct) => {
      const amount = ct.netAmount || 0
      totalRevenue += amount
      const method = ct.payment?.method
      if (method === "nakit") totalNakit += amount
      else if (method === "kredi-karti") totalKart += amount
      else if (method === "yemek-karti") totalYemekKarti += amount
      else if (method === "multinet") totalMultinet += amount
      else if (method === "cari") totalCari += amount
    })

    return { totalRevenue, totalNakit, totalKart, totalYemekKarti, totalMultinet, totalCari }
  }, [shiftClosedTables])

  const closedShifts = useMemo(() =>
    cashShifts.filter((s) => s.status === "closed").sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime()), [cashShifts])

  const ledgerWithBalance = ledgerCustomers.filter((c) => c.balance > 0.009)

  const ledgerBounds = useMemo(
    () => kasaLedgerDateBounds(filterDate, customStartDate, customEndDate),
    [filterDate, customStartDate, customEndDate],
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

  useEffect(() => {
    if (!ledgerDetailId || !token) {
      setLedgerEntries([])
      return
    }
    setLedgerEntriesLoading(true)
    const req = ledgerBounds
      ? api.ledgerCustomers.entries(token, ledgerDetailId, ledgerBounds)
      : api.ledgerCustomers.entries(token, ledgerDetailId)
    void req
      .then((rows) => {
        setLedgerEntries(
          rows.map((e) => ({
            id: e.id,
            entryType: e.entryType,
            amount: Number(e.amount),
            description: e.description,
            tableId: e.tableId ?? undefined,
            tableName: e.tableName ?? undefined,
            completedOrderId: e.completedOrderId ?? undefined,
            receivedBy: e.receivedBy ?? undefined,
            receivedByUserId: e.receivedByUserId ?? undefined,
            createdAt: new Date(e.createdAt),
          })),
        )
      })
      .catch(() => setLedgerEntries([]))
      .finally(() => setLedgerEntriesLoading(false))
  }, [ledgerDetailId, token, ledgerBounds])

  // Filtered closed tables based on date filter
  const filteredClosedTables = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30)

    let list = [...closedTables]

    if (filterDate === "today") {
      list = list.filter(ct => new Date(ct.closedAt) >= today)
    } else if (filterDate === "yesterday") {
      list = list.filter(ct => {
        const d = new Date(ct.closedAt)
        return d >= yesterday && d < today
      })
    } else if (filterDate === "week") {
      list = list.filter(ct => new Date(ct.closedAt) >= weekAgo)
    } else if (filterDate === "month") {
      list = list.filter(ct => new Date(ct.closedAt) >= monthAgo)
    } else if (filterDate === "custom" && customStartDate) {
      const start = new Date(customStartDate)
      const end = customEndDate ? new Date(customEndDate) : new Date()
      list = list.filter(ct => {
        const d = new Date(ct.closedAt)
        return d >= start && d <= end
      })
    }

    return list.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  }, [closedTables, filterDate, customStartDate, customEndDate])

  const displayLedgerCustomers = useMemo(() => {
    if (!ledgerBounds) return ledgerCustomers
    return ledgerTabCustomers ?? []
  }, [ledgerBounds, ledgerCustomers, ledgerTabCustomers])

  // Z-Report data
  const todaysClosed = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return closedTables.filter((ct) => new Date(ct.closedAt) >= today)
  }, [closedTables])

  // Print Z-Report
  const handlePrintZReport = () => {
    if (!zReportRef.current) return
    const printContent = zReportRef.current.innerHTML
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Z Raporu</title>
            <style>
              body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .border-b { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
              .flex { display: flex; justify-content: space-between; padding: 4px 0; }
              .text-sm { font-size: 12px; }
              .text-lg { font-size: 16px; }
              .mt-2 { margin-top: 8px; }
              .mb-2 { margin-bottom: 8px; }
              @media print { body { margin: 0; padding: 10px; } }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  // Group items by payment method for detail report
  const groupedByPaymentMethod = useMemo(() => {
    const groups: Record<string, typeof filteredClosedTables> = {
      nakit: [],
      "kredi-karti": [],
      "yemek-karti": [],
      multinet: [],
      coklu: [],
      cari: [],
    }
    filteredClosedTables.forEach(ct => {
      if (groups[ct.payment.method]) {
        groups[ct.payment.method].push(ct)
      }
    })
    return groups
  }, [filteredClosedTables])

  const [shiftError, setShiftError] = useState("")
  const [shiftLoading, setShiftLoading] = useState(false)

  const handleOpenShift = async () => {
    if (!openBalance) return
    setShiftError("")
    setShiftLoading(true)
    try {
      await openShift(parseFloat(openBalance))
      setOpenBalance("")
      setShowOpenShift(false)
    } catch (e) {
      setShiftError(e instanceof Error ? e.message : "Kasa açılamadı")
    } finally {
      setShiftLoading(false)
    }
  }

  const handleCloseShift = async () => {
    setShiftError("")
    setShiftLoading(true)
    try {
      await closeShift(parseFloat(closeBalance) || 0, closeNotes || undefined)
      setCloseBalance("")
      setCloseNotes("")
      setShowCloseShift(false)
    } catch (e) {
      setShiftError(e instanceof Error ? e.message : "Kasa kapatılamadı")
    } finally {
      setShiftLoading(false)
    }
  }

  const handleAddTransaction = () => {
    if (!txAmount || !txDesc) return
    addCashTransaction({ type: txType, amount: parseFloat(txAmount), description: txDesc, createdBy: currentUser?.name || "Sistem" })
    setTxAmount(""); setTxDesc(""); setShowAddTransaction(false)
  }

  const handleSaveLedgerCustomer = async () => {
    if (!lcName.trim()) return
    setLcSaving(true)
    try {
      const c = await createLedgerCustomer({
        name: lcName.trim(),
        phone: lcPhone.trim() || undefined,
        notes: lcNotes.trim() || undefined,
      })
      if (c) {
        setShowAddLedger(false)
        if (ledgerBounds) void refetchLedgerTabCustomers()
      }
    } finally {
      setLcSaving(false)
    }
  }

  const handleLedgerTahsilat = async () => {
    if (!ledgerDetailId || !ledgerPayAmount) return
    setLedgerPayBusy(true)
    try {
      const ok = await addLedgerPayment(ledgerDetailId, parseFloat(String(ledgerPayAmount).replace(",", ".")))
      if (ok) {
        setLedgerPayAmount("")
        void ledgerRefresh()
        if (token) {
          setLedgerEntriesLoading(true)
          try {
            const rows = ledgerBounds
              ? await api.ledgerCustomers.entries(token, ledgerDetailId, ledgerBounds)
              : await api.ledgerCustomers.entries(token, ledgerDetailId)
            setLedgerEntries(
              rows.map((e) => ({
                id: e.id,
                entryType: e.entryType,
                amount: Number(e.amount),
                description: e.description,
                tableId: e.tableId ?? undefined,
                tableName: e.tableName ?? undefined,
                completedOrderId: e.completedOrderId ?? undefined,
                receivedBy: e.receivedBy ?? undefined,
                receivedByUserId: e.receivedByUserId ?? undefined,
                createdAt: new Date(e.createdAt),
              })),
            )
          } finally {
            setLedgerEntriesLoading(false)
          }
        }
        if (ledgerBounds) void refetchLedgerTabCustomers()
      }
    } finally {
      setLedgerPayBusy(false)
    }
  }

  const kasaTabs = useMemo(() => {
    const ledgerLabel = !ledgerBounds
      ? `Cariler (${ledgerWithBalance.length})`
      : ledgerTabLoading
        ? "Cariler (…)"
        : `Cariler (${(ledgerTabCustomers ?? []).length})`
    return [
      { id: "overview" as const, label: "Kasa Ozeti" },
      { id: "transactions" as const, label: "Islemler" },
      { id: "ledger" as const, label: ledgerLabel },
      { id: "z-report" as const, label: "Z Raporu" },
      { id: "detail-report" as const, label: "Detay Raporu" },
    ]
  }, [ledgerBounds, ledgerTabLoading, ledgerTabCustomers, ledgerWithBalance.length])

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Kasa</h2>
          <div className="flex items-center gap-3">
            {currentShift ? (
              <>
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">Kasa Acik - {currentShift.openedBy}</span>
                <button onClick={() => setShowCloseShift(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium hover:bg-red-600 transition-colors">
                  Kasa Kapat
                </button>
              </>
            ) : (
              <button onClick={() => setShowOpenShift(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#34c759] text-white rounded-lg text-[12px] font-medium hover:bg-[#2db84e] transition-colors">
                <Plus className="w-3.5 h-3.5" /> Kasa Ac
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Filter className="w-3.5 h-3.5 text-[#86868b]" />
          <select 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none pr-7 cursor-pointer"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            <option value="today">Bugun</option>
            <option value="yesterday">Dun</option>
            <option value="week">Son 7 Gun</option>
            <option value="month">Son 30 Gun</option>
            <option value="custom">Ozel Tarih</option>
            <option value="all">Tumu</option>
          </select>
          {filterDate === "custom" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Baslangic:</span>
                <input 
                  type="datetime-local" 
                  value={customStartDate} 
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Bitis:</span>
                <input 
                  type="datetime-local" 
                  value={customEndDate} 
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
              </div>
            </>
          )}
          <span className="text-[11px] text-[#86868b] ml-2">
            {filteredClosedTables.length} siparis | {"\u20BA"}{formatCurrency(filteredClosedTables.reduce((s, ct) => s + ct.netAmount, 0))}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex gap-1.5">
        {kasaTabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors ${activeTab === tab.id ? "bg-[#e63462] text-white" : "text-[#86868b] hover:bg-black/[0.04]"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-5xl flex flex-col gap-5">

          {/* ===== OVERVIEW ===== */}
          {activeTab === "overview" && currentShift && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Toplam Ciro", value: shiftTotals.totalRevenue, icon: DollarSign, color: "#34c759" },
                  { label: "Nakit", value: shiftTotals.totalNakit, icon: Banknote, color: "#007aff" },
                  { label: "Kredi Karti", value: shiftTotals.totalKart, icon: CreditCard, color: "#ff9500" },
                  { label: "Yemek Karti", value: shiftTotals.totalYemekKarti + shiftTotals.totalMultinet, icon: UtensilsCrossed, color: "#af52de" },
                ].map((card) => {
                  const Icon = card.icon
                  return (
                    <div key={card.label} className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${card.color}15` }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                        </div>
                        <span className="text-[11px] text-[#86868b] font-medium">{card.label}</span>
                      </div>
                      <p className="text-[20px] font-bold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(card.value)}</p>
                    </div>
                  )
                })}
              </div>

              {/* Shift info */}
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Vardiya Bilgisi</h3>
                <div className="grid grid-cols-3 gap-4 text-[12px]">
                  <div><span className="text-[#86868b]">Acan: </span><span className="text-[#1d1d1f] font-medium">{currentShift.openedBy}</span></div>
                  <div><span className="text-[#86868b]">Acilis: </span><span className="text-[#1d1d1f] font-medium">{formatTime(currentShift.openedAt)}</span></div>
                  <div><span className="text-[#86868b]">Acilis Bakiye: </span><span className="text-[#1d1d1f] font-medium">{"\u20BA"}{formatCurrency(currentShift.openingBalance)}</span></div>
                  <div><span className="text-[#86868b]">Nakit Giris: </span><span className="text-green-600 font-medium">+{"\u20BA"}{formatCurrency(currentShift.cashIn)}</span></div>
                  <div><span className="text-[#86868b]">Nakit Cikis: </span><span className="text-red-500 font-medium">-{"\u20BA"}{formatCurrency(currentShift.cashOut)}</span></div>
                  <div><span className="text-[#86868b]">Beklenen Kasa: </span><span className="text-[#1d1d1f] font-bold">{"\u20BA"}{formatCurrency(currentShift.openingBalance + currentShift.cashIn - currentShift.cashOut)}</span></div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex gap-3">
                <button onClick={() => { setShowAddTransaction(true); setTxType("expense") }}
                  className="flex-1 flex items-center justify-center gap-2 h-[40px] bg-white border border-[#d1d1d6]/60 rounded-xl text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors">
                  <ArrowUpCircle className="w-4 h-4 text-red-500" /> Gider Ekle
                </button>
                <button onClick={() => { setShowAddTransaction(true); setTxType("cash-in") }}
                  className="flex-1 flex items-center justify-center gap-2 h-[40px] bg-white border border-[#d1d1d6]/60 rounded-xl text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors">
                  <ArrowDownCircle className="w-4 h-4 text-green-500" /> Nakit Giris
                </button>
                <button onClick={() => { setShowAddTransaction(true); setTxType("cash-out") }}
                  className="flex-1 flex items-center justify-center gap-2 h-[40px] bg-white border border-[#d1d1d6]/60 rounded-xl text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors">
                  <ArrowUpCircle className="w-4 h-4 text-amber-500" /> Nakit Cikis
                </button>
              </div>

              {/* Recent transactions */}
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] px-4 pt-4 pb-2">Son Islemler</h3>
                <div className="max-h-[300px] overflow-auto">
                  {shiftTransactions.slice(0, 10).map((tx, idx) => (
                    <div key={tx.id} className={`flex items-center justify-between px-4 py-2.5 ${idx > 0 ? "border-t border-[#f0f0f0]" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          tx.type === "sale" ? "bg-green-50" : tx.type === "expense" || tx.type === "cash-out" ? "bg-red-50" : "bg-blue-50"
                        }`}>
                          {tx.type === "sale" ? <Receipt className="w-3.5 h-3.5 text-green-600" /> :
                           tx.type === "expense" ? <ArrowUpCircle className="w-3.5 h-3.5 text-red-500" /> :
                           tx.type === "cash-in" ? <ArrowDownCircle className="w-3.5 h-3.5 text-blue-500" /> :
                           <ArrowUpCircle className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                        <div>
                          <p className="text-[12px] font-medium text-[#1d1d1f]">{tx.description}</p>
                          <p className="text-[10px] text-[#86868b]">{formatTime(tx.createdAt)} - {tx.createdBy}</p>
                        </div>
                      </div>
                      <span className={`text-[13px] font-semibold ${
                        tx.type === "sale" || tx.type === "cash-in" ? "text-green-600" : "text-red-500"
                      }`}>
                        {tx.type === "sale" || tx.type === "cash-in" ? "+" : "-"}{"\u20BA"}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "overview" && !currentShift && (
            <div className="text-center py-20">
              <Wallet className="w-12 h-12 text-[#d1d1d6] mx-auto mb-3" />
              <p className="text-[14px] text-[#86868b] mb-4">Kasa kapalii. Islem yapabilmek icin kasayi acin.</p>
              <button onClick={() => setShowOpenShift(true)} className="h-[40px] px-6 bg-[#34c759] text-white rounded-xl text-[14px] font-semibold hover:bg-[#2db84e] transition-colors">
                Kasa Ac
              </button>
              {closedShifts.length > 0 && (
                <div className="mt-8 max-w-2xl mx-auto">
                  <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Onceki Vardiyalar</h3>
                  <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                    {closedShifts.slice(0, 5).map((s, idx) => (
                      <div key={s.id} className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t border-[#f0f0f0]" : ""}`}>
                        <div>
                          <p className="text-[12px] font-medium text-[#1d1d1f]">{s.openedBy} - {s.closedBy}</p>
                          <p className="text-[10px] text-[#86868b]">{formatTime(s.openedAt)} - {s.closedAt ? formatTime(s.closedAt) : "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-bold text-[#e63462]">{"\u20BA"}{formatCurrency(s.totalRevenue)}</p>
                          <p className="text-[10px] text-[#86868b]">{s.transactionCount} islem</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== TRANSACTIONS ===== */}
          {activeTab === "transactions" && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Tum Islemler</h3>
                {currentShift && (
                  <button onClick={() => setShowAddTransaction(true)} className="h-[28px] px-3 flex items-center gap-1.5 bg-[#e63462]/10 text-[#e63462] rounded-lg text-[11px] font-medium hover:bg-[#e63462]/20">
                    <Plus className="w-3 h-3" /> Islem Ekle
                  </button>
                )}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Saat</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tur</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Aciklama</th>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Isleyen</th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {cashTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((tx, idx) => (
                    <tr key={tx.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                      <td className="px-4 py-2 text-[12px] text-[#86868b]">{formatTime(tx.createdAt)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                          tx.type === "sale" ? "bg-green-50 text-green-600" :
                          tx.type === "expense" ? "bg-red-50 text-red-500" :
                          tx.type === "cash-in" ? "bg-blue-50 text-blue-600" :
                          tx.type === "refund" ? "bg-amber-50 text-amber-600" :
                          "bg-gray-50 text-gray-500"
                        }`}>
                          {tx.type === "sale" ? "Satis" : tx.type === "expense" ? "Gider" : tx.type === "cash-in" ? "Giris" : tx.type === "cash-out" ? "Cikis" : "Iade"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[12px] text-[#1d1d1f]">{tx.description}</td>
                      <td className="px-4 py-2 text-[12px] text-[#86868b]">{tx.createdBy}</td>
                      <td className={`px-4 py-2 text-[12px] text-right font-semibold ${
                        tx.type === "sale" || tx.type === "cash-in" ? "text-green-600" : "text-red-500"
                      }`}>
                        {tx.type === "sale" || tx.type === "cash-in" ? "+" : "-"}{"\u20BA"}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ===== LEDGERS ===== */}
          {activeTab === "ledger" && (
            <>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      await ledgerRefresh()
                      if (ledgerBounds && token) await refetchLedgerTabCustomers()
                    })()
                  }}
                  className="h-[30px] px-3 flex items-center gap-1.5 border border-[#d1d1d6]/60 rounded-lg text-[12px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
                >
                  Yenile
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLedger(true)}
                  className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Cari Ekle
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {ledgerBounds && ledgerTabLoading && ledgerTabCustomers === null ? (
                  <div className="flex items-center justify-center py-16 text-[#86868b] gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-[14px]">Yukleniyor…</span>
                  </div>
                ) : (
                  displayLedgerCustomers
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
                    .map((c) => {
                      const showPeriod = Boolean(ledgerBounds && c.periodNet !== undefined)
                      const net = showPeriod ? (c.periodNet ?? 0) : c.balance
                      return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setLedgerDetailId(c.id)
                        setLedgerPayAmount("")
                      }}
                      className="text-left bg-white rounded-xl border border-[#d1d1d6]/60 p-4 hover:border-[#e63462]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <BookUser className="w-4 h-4 text-[#e63462] flex-shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-[14px] font-semibold text-[#1d1d1f] truncate">{c.name}</h4>
                            {c.phone && <p className="text-[11px] text-[#86868b]">{c.phone}</p>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {showPeriod ? (
                            <>
                              <p className={`text-[13px] font-bold ${net > 0.009 ? "text-red-600" : net < -0.009 ? "text-green-600" : "text-[#86868b]"}`}>
                                Donem neti
                              </p>
                              <p className={`text-[14px] font-semibold ${net > 0.009 ? "text-red-600" : net < -0.009 ? "text-green-600" : "text-[#1d1d1f]"}`}>
                                {net > 0.009 ? "+" : net < -0.009 ? "\u2212" : ""}
                                {"\u20BA"}{formatCurrency(Math.abs(net))}
                              </p>
                              <p className="text-[10px] text-[#86868b] mt-0.5">
                                Guncel: {"\u20BA"}{formatCurrency(Math.abs(c.balance))}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className={`text-[13px] font-bold ${c.balance > 0.009 ? "text-red-600" : c.balance < -0.009 ? "text-green-600" : "text-[#86868b]"}`}>
                                {c.balance > 0.009 ? "Borc" : c.balance < -0.009 ? "Alacak" : "Bakiye"}
                              </p>
                              <p className="text-[14px] font-semibold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(Math.abs(c.balance))}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                      )
                    })
                )}
                {!ledgerBounds && ledgerCustomers.length === 0 && (
                  <div className="text-center py-16 text-[#86868b] text-[14px]">Kayitli cari yok. Yukaridan cari ekleyin.</div>
                )}
                {ledgerBounds && !ledgerTabLoading && displayLedgerCustomers.length === 0 && (
                  <div className="text-center py-16 text-[#86868b] text-[14px]">Bu tarih araliginda cari hareketi yok.</div>
                )}
              </div>
            </>
          )}

          {/* ===== Z REPORT ===== */}
          {activeTab === "z-report" && (
            <>
              {/* Action buttons */}
              <div className="flex items-center gap-3 mb-4">
                <button 
                  onClick={handlePrintZReport}
                  className="h-[34px] px-4 flex items-center gap-2 bg-[#1d1d1f] text-white rounded-lg text-[12px] font-medium hover:bg-[#3a3a3c] transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Z Raporu Yazdir
                </button>
              </div>

              <div ref={zReportRef} className="bg-white rounded-xl border border-[#d1d1d6]/60 p-6">
                <div className="text-center mb-6">
                  <h3 className="text-[18px] font-bold text-[#1d1d1f]">{settings.name}</h3>
                  <p className="text-[11px] text-[#86868b] mt-1">{settings.address}</p>
                  <p className="text-[11px] text-[#86868b]">VKN: {settings.taxId}</p>
                  <div className="mt-3 h-px bg-[#d1d1d6]/40" />
                  <p className="text-[14px] font-bold text-[#1d1d1f] mt-3">Z RAPORU</p>
                  <p className="text-[12px] text-[#86868b]">{new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>

              <div className="flex flex-col gap-3 text-[13px]">
                <div className="flex justify-between py-1.5 border-b border-dashed border-[#d1d1d6]">
                  <span className="text-[#86868b]">Toplam Satis</span>
                  <span className="font-bold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(shiftTotals.totalRevenue || 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-[#d1d1d6]">
                  <span className="text-[#86868b]">Kapanan Masa Sayisi</span>
                  <span className="font-bold text-[#1d1d1f]">{todaysClosed.length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-[#d1d1d6]">
                  <span className="text-[#86868b]">Islem Sayisi</span>
                  <span className="font-bold text-[#1d1d1f]">{currentShift?.transactionCount || 0}</span>
                </div>

                <div className="mt-2 mb-1"><span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Odeme Dagilimi</span></div>
                {[
                  { label: "Nakit", value: shiftTotals.totalNakit || 0 },
                  { label: "Kredi Karti", value: shiftTotals.totalKart || 0 },
                  { label: "Yemek Karti", value: shiftTotals.totalYemekKarti || 0 },
                  { label: "Multinet", value: shiftTotals.totalMultinet || 0 },
                  { label: "Cariye atilan", value: shiftTotals.totalCari || 0 },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between py-1">
                    <span className="text-[#86868b]">{row.label}</span>
                    <span className="font-medium text-[#1d1d1f]">{"\u20BA"}{formatCurrency(row.value)}</span>
                  </div>
                ))}

                <div className="mt-2 h-px bg-[#d1d1d6]/40" />
                <div className="mt-2 mb-1"><span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kasa Hareketi</span></div>
                <div className="flex justify-between py-1">
                  <span className="text-[#86868b]">Acilis Bakiye</span>
                  <span className="font-medium text-[#1d1d1f]">{"\u20BA"}{formatCurrency(currentShift?.openingBalance || 0)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#86868b]">Nakit Giris</span>
                  <span className="font-medium text-green-600">+{"\u20BA"}{formatCurrency(currentShift?.cashIn || 0)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#86868b]">Nakit Cikis</span>
                  <span className="font-medium text-red-500">-{"\u20BA"}{formatCurrency(currentShift?.cashOut || 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-t border-[#d1d1d6] font-bold">
                  <span className="text-[#1d1d1f]">Kasada Beklenen</span>
                  <span className="text-[#e63462]">{"\u20BA"}{formatCurrency((currentShift?.openingBalance || 0) + (currentShift?.cashIn || 0) - (currentShift?.cashOut || 0))}</span>
                </div>


              </div>
              </div>
            </>
          )}

          {/* ===== DETAIL REPORT ===== */}
          {activeTab === "detail-report" && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
              <div className="px-4 py-3 bg-[#f9f9f9] border-b border-[#f0f0f0]">
                <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Detay Raporu - Odeme Yontemine Gore</h3>
                <p className="text-[11px] text-[#86868b] mt-0.5">{filteredClosedTables.length} siparis listeleniyor</p>
              </div>

              {/* Cash */}
              {groupedByPaymentMethod.nakit.length > 0 && (
                <div className="border-b border-[#f0f0f0]">
                  <div className="px-4 py-2.5 bg-green-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-green-600" />
                      <span className="text-[13px] font-semibold text-green-700">Nakit</span>
                      <span className="text-[11px] text-green-600">({groupedByPaymentMethod.nakit.length} siparis)</span>
                    </div>
                    <span className="text-[14px] font-bold text-green-700">
                      {"\u20BA"}{formatCurrency(groupedByPaymentMethod.nakit.reduce((s, ct) => s + ct.netAmount, 0))}
                    </span>
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    {groupedByPaymentMethod.nakit.map((ct, idx) => (
                      <div key={ct.id} className={`flex items-center justify-between px-4 py-2 text-[12px] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[#1d1d1f] font-medium">{ct.tableName}</span>
                          <span className="text-[#86868b]">{ct.waiter}</span>
                          <span className="text-[#aeaeb2]">{formatFullDate(ct.closedAt)} {formatTime(ct.closedAt)}</span>
                        </div>
                        <span className="font-semibold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(ct.netAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Credit Card */}
              {groupedByPaymentMethod["kredi-karti"].length > 0 && (
                <div className="border-b border-[#f0f0f0]">
                  <div className="px-4 py-2.5 bg-blue-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span className="text-[13px] font-semibold text-blue-700">Kredi Karti</span>
                      <span className="text-[11px] text-blue-600">({groupedByPaymentMethod["kredi-karti"].length} siparis)</span>
                    </div>
                    <span className="text-[14px] font-bold text-blue-700">
                      {"\u20BA"}{formatCurrency(groupedByPaymentMethod["kredi-karti"].reduce((s, ct) => s + ct.netAmount, 0))}
                    </span>
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    {groupedByPaymentMethod["kredi-karti"].map((ct, idx) => (
                      <div key={ct.id} className={`flex items-center justify-between px-4 py-2 text-[12px] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[#1d1d1f] font-medium">{ct.tableName}</span>
                          <span className="text-[#86868b]">{ct.waiter}</span>
                          <span className="text-[#aeaeb2]">{formatFullDate(ct.closedAt)} {formatTime(ct.closedAt)}</span>
                        </div>
                        <span className="font-semibold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(ct.netAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meal Card */}
              {groupedByPaymentMethod["yemek-karti"].length > 0 && (
                <div className="border-b border-[#f0f0f0]">
                  <div className="px-4 py-2.5 bg-purple-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="w-4 h-4 text-purple-600" />
                      <span className="text-[13px] font-semibold text-purple-700">Yemek Karti</span>
                      <span className="text-[11px] text-purple-600">({groupedByPaymentMethod["yemek-karti"].length} siparis)</span>
                    </div>
                    <span className="text-[14px] font-bold text-purple-700">
                      {"\u20BA"}{formatCurrency(groupedByPaymentMethod["yemek-karti"].reduce((s, ct) => s + ct.netAmount, 0))}
                    </span>
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    {groupedByPaymentMethod["yemek-karti"].map((ct, idx) => (
                      <div key={ct.id} className={`flex items-center justify-between px-4 py-2 text-[12px] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[#1d1d1f] font-medium">{ct.tableName}</span>
                          <span className="text-[#86868b]">{ct.waiter}</span>
                          <span className="text-[#aeaeb2]">{formatFullDate(ct.closedAt)} {formatTime(ct.closedAt)}</span>
                        </div>
                        <span className="font-semibold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(ct.netAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Multinet */}
              {groupedByPaymentMethod.multinet.length > 0 && (
                <div className="border-b border-[#f0f0f0]">
                  <div className="px-4 py-2.5 bg-amber-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-600" />
                      <span className="text-[13px] font-semibold text-amber-700">Multinet</span>
                      <span className="text-[11px] text-amber-600">({groupedByPaymentMethod.multinet.length} siparis)</span>
                    </div>
                    <span className="text-[14px] font-bold text-amber-700">
                      {"\u20BA"}{formatCurrency(groupedByPaymentMethod.multinet.reduce((s, ct) => s + ct.netAmount, 0))}
                    </span>
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    {groupedByPaymentMethod.multinet.map((ct, idx) => (
                      <div key={ct.id} className={`flex items-center justify-between px-4 py-2 text-[12px] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[#1d1d1f] font-medium">{ct.tableName}</span>
                          <span className="text-[#86868b]">{ct.waiter}</span>
                          <span className="text-[#aeaeb2]">{formatFullDate(ct.closedAt)} {formatTime(ct.closedAt)}</span>
                        </div>
                        <span className="font-semibold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(ct.netAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Split Payment */}
              {groupedByPaymentMethod.coklu.length > 0 && (
                <div className="border-b border-[#f0f0f0]">
                  <div className="px-4 py-2.5 bg-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-gray-600" />
                      <span className="text-[13px] font-semibold text-gray-700">Coklu Odeme</span>
                      <span className="text-[11px] text-gray-600">({groupedByPaymentMethod.coklu.length} siparis)</span>
                    </div>
                    <span className="text-[14px] font-bold text-gray-700">
                      {"\u20BA"}{formatCurrency(groupedByPaymentMethod.coklu.reduce((s, ct) => s + ct.netAmount, 0))}
                    </span>
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    {groupedByPaymentMethod.coklu.map((ct, idx) => (
                      <div key={ct.id} className={`flex items-center justify-between px-4 py-2 text-[12px] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[#1d1d1f] font-medium">{ct.tableName}</span>
                          <span className="text-[#86868b]">{ct.waiter}</span>
                          <span className="text-[#aeaeb2]">{formatFullDate(ct.closedAt)} {formatTime(ct.closedAt)}</span>
                        </div>
                        <span className="font-semibold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(ct.netAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {groupedByPaymentMethod.cari.length > 0 && (
                <div className="border-b border-[#f0f0f0]">
                  <div className="px-4 py-2.5 bg-rose-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookUser className="w-4 h-4 text-rose-600" />
                      <span className="text-[13px] font-semibold text-rose-800">Cari</span>
                      <span className="text-[11px] text-rose-600">({groupedByPaymentMethod.cari.length} siparis)</span>
                    </div>
                    <span className="text-[14px] font-bold text-rose-800">
                      {"\u20BA"}{formatCurrency(groupedByPaymentMethod.cari.reduce((s, ct) => s + ct.netAmount, 0))}
                    </span>
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    {groupedByPaymentMethod.cari.map((ct, idx) => (
                      <div key={ct.id} className={`flex items-center justify-between px-4 py-2 text-[12px] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[#1d1d1f] font-medium">{ct.tableName}</span>
                          <span className="text-[#86868b]">{ct.waiter}</span>
                          <span className="text-[#aeaeb2]">{formatFullDate(ct.closedAt)} {formatTime(ct.closedAt)}</span>
                        </div>
                        <span className="font-semibold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(ct.netAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredClosedTables.length === 0 && (
                <div className="py-10 text-center text-[13px] text-[#86868b]">Secilen tarihte siparis bulunmuyor</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== MODALS ===== */}
      {showOpenShift && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Kasa Ac</h3>
              <button onClick={() => setShowOpenShift(false)} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"><X className="w-3.5 h-3.5 text-[#86868b]" /></button>
            </div>
            <div className="px-6 py-5">
              {shiftError && <p className="text-[13px] text-red-500 mb-3">{shiftError}</p>}
              <label className="text-[12px] font-medium text-[#86868b] mb-1.5 block">Acilis Bakiyesi</label>
              <input type="number" value={openBalance} onChange={(e) => setOpenBalance(e.target.value)} placeholder="0.00" autoFocus disabled={shiftLoading}
                className="w-full h-[40px] px-3 text-[15px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
            </div>
            <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
              <button onClick={() => setShowOpenShift(false)} disabled={shiftLoading} className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b]">Vazgec</button>
              <button onClick={handleOpenShift} disabled={shiftLoading} className="flex-1 h-[38px] rounded-xl bg-[#34c759] text-white text-[13px] font-semibold hover:bg-[#2db84e] disabled:opacity-50">{shiftLoading ? "Aciliyor…" : "Kasayi Ac"}</button>
            </div>
          </div>
        </div>
      )}

      {showCloseShift && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Kasa Kapat</h3>
              <button onClick={() => setShowCloseShift(false)} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"><X className="w-3.5 h-3.5 text-[#86868b]" /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3">
              <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-[12px] text-amber-700">
                  <p className="font-semibold mb-0.5">Beklenen bakiye: {"\u20BA"}{formatCurrency((currentShift?.openingBalance || 0) + (currentShift?.cashIn || 0) - (currentShift?.cashOut || 0))}</p>
                  <p>Kasadaki fiziksel tutari girin.</p>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#86868b] mb-1.5 block">Kapanis Bakiyesi</label>
                <input type="number" value={closeBalance} onChange={(e) => setCloseBalance(e.target.value)} placeholder="0.00" autoFocus
                  className="w-full h-[40px] px-3 text-[15px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#86868b] mb-1.5 block">Not (opsiyonel)</label>
                <input type="text" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Aciklama..." disabled={shiftLoading}
                  className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              </div>
              {shiftError && <p className="text-[13px] text-red-500">{shiftError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
              <button onClick={() => setShowCloseShift(false)} disabled={shiftLoading} className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b]">Vazgec</button>
              <button onClick={handleCloseShift} disabled={shiftLoading} className="flex-1 h-[38px] rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 disabled:opacity-50">{shiftLoading ? "Kapatiliyor…" : "Kasayi Kapat"}</button>
            </div>
          </div>
        </div>
      )}

      {showAddTransaction && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Islem Ekle</h3>
              <button onClick={() => setShowAddTransaction(false)} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"><X className="w-3.5 h-3.5 text-[#86868b]" /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3">
              <div className="flex gap-2">
                {(["expense", "cash-in", "cash-out"] as const).map((t) => (
                  <button key={t} onClick={() => setTxType(t)}
                    className={`flex-1 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors ${txType === t ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]" : "border-[#d1d1d6]/60 text-[#86868b]"}`}>
                    {t === "expense" ? "Gider" : t === "cash-in" ? "Nakit Giris" : "Nakit Cikis"}
                  </button>
                ))}
              </div>
              <input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="Tutar" autoFocus
                className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              <input type="text" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} placeholder="Aciklama"
                className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
            </div>
            <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
              <button onClick={() => setShowAddTransaction(false)} className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b]">Vazgec</button>
              <button onClick={handleAddTransaction} className="flex-1 h-[38px] rounded-xl bg-[#e63462] text-white text-[13px] font-semibold hover:bg-[#d42d56]">Ekle</button>
            </div>
          </div>
        </div>
      )}

      {showAddLedger && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Cari Musteri Ekle</h3>
              <button type="button" onClick={() => setShowAddLedger(false)} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
                <X className="w-3.5 h-3.5 text-[#86868b]" />
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3">
              <input
                type="text"
                value={lcName}
                onChange={(e) => setLcName(e.target.value)}
                placeholder="Unvan / Ad Soyad"
                autoFocus
                className="h-[40px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
              />
              <input
                type="tel"
                value={lcPhone}
                onChange={(e) => setLcPhone(e.target.value)}
                placeholder="Telefon (opsiyonel)"
                className="h-[40px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
              />
              <textarea
                value={lcNotes}
                onChange={(e) => setLcNotes(e.target.value)}
                placeholder="Not (opsiyonel)"
                rows={2}
                className="px-3 py-2 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 resize-none"
              />
            </div>
            <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
              <button type="button" onClick={() => setShowAddLedger(false)} className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b]">
                Vazgec
              </button>
              <button
                type="button"
                disabled={lcSaving || !lcName.trim()}
                onClick={() => void handleSaveLedgerCustomer()}
                className="flex-1 h-[38px] rounded-xl bg-[#e63462] text-white text-[13px] font-semibold hover:bg-[#d42d56] disabled:opacity-50"
              >
                {lcSaving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ledgerDetailId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0] flex-shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  {displayLedgerCustomers.find((c) => c.id === ledgerDetailId)?.name
                    || ledgerCustomers.find((c) => c.id === ledgerDetailId)?.name
                    || "Cari"}
                </h3>
                <p className="text-[12px] text-[#86868b] mt-0.5">
                  Guncel bakiye:{" "}
                  <span className="font-semibold text-[#1d1d1f]">
                    {"\u20BA"}
                    {formatCurrency(ledgerCustomers.find((c) => c.id === ledgerDetailId)?.balance ?? 0)}
                  </span>
                </p>
                {ledgerBounds && (
                  <p className="text-[11px] text-[#aeaeb2] mt-1">Hareketler kasa tarih filtresine gore listelenir.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLedgerDetailId(null)}
                className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
              >
                <X className="w-3.5 h-3.5 text-[#86868b]" />
              </button>
            </div>
            <div className="px-6 py-4 flex-1 overflow-y-auto">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Hareketler</p>
              {ledgerEntriesLoading ? (
                <div className="flex items-center justify-center py-12 text-[#86868b] gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-[13px]">Yukleniyor…</span>
                </div>
              ) : ledgerEntries.length === 0 ? (
                <p className="text-[13px] text-[#86868b] py-6 text-center">Hareket yok</p>
              ) : (
                <ul className="space-y-2 border border-[#f0f0f0] rounded-xl overflow-hidden">
                  {ledgerEntries.map((e) => (
                    <li key={e.id} className="px-3 py-2.5 border-b border-[#f0f0f0] last:border-0 text-[12px]">
                      <div className="flex justify-between gap-2">
                        <span className="text-[#1d1d1f] font-medium">{e.description}</span>
                        <span
                          className={
                            e.entryType === "debt"
                              ? "text-red-600 font-semibold"
                              : e.entryType === "credit"
                                ? "text-amber-800 font-semibold"
                                : "text-green-600 font-semibold"
                          }
                        >
                          {e.entryType === "debt" ? "+" : e.entryType === "credit" ? "\u2212" : "-"}
                          {"\u20BA"}
                          {formatCurrency(e.amount)}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#86868b] mt-1 flex flex-wrap gap-x-2">
                        <span>
                          {e.entryType === "debt" ? "Borc" : e.entryType === "credit" ? "Adisyon geri al" : "Tahsilat"}
                        </span>
                        <span>
                          {formatFullDate(e.createdAt)} {formatTime(e.createdAt)}
                        </span>
                        {e.tableName && <span>Masa: {e.tableName}</span>}
                        {e.receivedBy && (
                          <span>
                            {e.entryType === "payment" ? "Kasiyer:" : "İşlem yapan:"} {e.receivedBy}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#f0f0f0] flex-shrink-0 space-y-3">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tahsilat</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={ledgerPayAmount}
                  onChange={(e) => setLedgerPayAmount(e.target.value)}
                  placeholder="Tutar"
                  className="flex-1 h-[40px] px-3 text-[14px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
                <button
                  type="button"
                  disabled={ledgerPayBusy || !ledgerPayAmount || !token}
                  onClick={() => void handleLedgerTahsilat()}
                  className="h-[40px] px-4 rounded-lg bg-[#34c759] text-white text-[13px] font-semibold hover:bg-[#2db84e] disabled:opacity-50"
                >
                  {ledgerPayBusy ? "…" : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
