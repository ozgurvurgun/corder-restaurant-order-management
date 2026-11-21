import { useState, useEffect, useRef, useMemo } from "react"
import { BookUser, Loader2, Plus, TrendingUp, Users, Wallet } from "lucide-react"
import { api } from "@/lib/api"
import type { LedgerCustomer, LedgerEntry } from "@/lib/panel-types"
import { formatCurrency, formatTitleCase, fromMinorUnits, toMinorUnits } from "@/lib/format"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { AddLedgerCustomerModal, LedgerCustomerDetailModal, type CollectionMethod } from "./ledger-customer-modals"

const LEDGER_PAGE_SIZE = 10

export function LedgerCustomersSection(props: {
  token: string | null
  ledgerBounds?: { from: string; to: string }
  ledgerTabLoading: boolean
  ledgerTabCustomers: LedgerCustomer[] | null
  ledgerCustomers: LedgerCustomer[]
  displayLedgerCustomers: LedgerCustomer[]
  canManageLedger?: boolean
  canCollectLedger?: boolean
  hasOpenShift?: boolean
  ledgerRefresh: () => Promise<void>
  refetchLedgerTabCustomers: () => Promise<void>
  createLedgerCustomer: (body: { name: string; phone?: string; notes?: string }) => Promise<LedgerCustomer | null>
  addLedgerPayment: (customerId: string, amount: number, paymentMethod?: CollectionMethod) => Promise<boolean>
}) {
  const { token, ledgerBounds, ledgerTabLoading, ledgerTabCustomers, ledgerCustomers, displayLedgerCustomers, canManageLedger = true, canCollectLedger = true, hasOpenShift = true, ledgerRefresh, refetchLedgerTabCustomers, createLedgerCustomer, addLedgerPayment } = props

  const [showAddLedger, setShowAddLedger] = useState(false)
  const [ledgerDetailId, setLedgerDetailId] = useState<string | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [ledgerEntriesLoading, setLedgerEntriesLoading] = useState(false)
  const [ledgerPayAmount, setLedgerPayAmount] = useState("")
  const [ledgerPayMethod, setLedgerPayMethod] =
    useState<CollectionMethod>("cash")
  const [ledgerPayBusy, setLedgerPayBusy] = useState(false)
  const [lcName, setLcName] = useState("")
  const [lcPhone, setLcPhone] = useState("")
  const [lcNotes, setLcNotes] = useState("")
  const [lcSaving, setLcSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const busyRef = useRef(false)

  useEffect(() => {
    setCurrentPage(1)
  }, [ledgerBounds, displayLedgerCustomers.length])

  useEffect(() => {
    if (!showAddLedger) return
    setLcName("")
    setLcPhone("")
    setLcNotes("")
  }, [showAddLedger])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || lcSaving || ledgerPayBusy || busyRef.current)
        return
      if (showAddLedger) setShowAddLedger(false)
      else if (ledgerDetailId) setLedgerDetailId(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showAddLedger, ledgerDetailId, lcSaving, ledgerPayBusy])

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
      .then((rows) =>
        setLedgerEntries(
          rows.map((e) => ({
            id: e.id,
            entryType: e.entryType,
            amount: Number(e.amount),
            description: formatTitleCase(e.description, "tr"),
            tableId: e.tableId ?? undefined,
            tableName: e.tableName ? formatTitleCase(e.tableName, "tr") : undefined,
            completedOrderId: e.completedOrderId ?? undefined,
            receivedBy: e.receivedBy ? formatTitleCase(e.receivedBy, "tr") : undefined,
            receivedByUserId: e.receivedByUserId ?? undefined,
            createdAt: new Date(e.createdAt),
          })),
        ),
      )
      .catch(() => setLedgerEntries([]))
      .finally(() => setLedgerEntriesLoading(false))
  }, [ledgerDetailId, token, ledgerBounds])

  const handleSaveLedgerCustomer = async () => {
    if (!lcName.trim() || lcSaving || busyRef.current) return
    busyRef.current = true
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
      busyRef.current = false
      setLcSaving(false)
    }
  }

  const handleLedgerCollection = async () => {
    const amountVal = parseFloat(String(ledgerPayAmount).replace(",", "."))
    if (!ledgerDetailId || !Number.isFinite(amountVal) || amountVal <= 0 || ledgerPayBusy || busyRef.current) return
    busyRef.current = true
    setLedgerPayBusy(true)
    try {
      const ok = await addLedgerPayment(ledgerDetailId, amountVal, ledgerPayMethod)
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
      busyRef.current = false
      setLedgerPayBusy(false)
    }
  }

  const summary = useMemo(() => {
    const totalCount = ledgerCustomers.length
    const debtorCount = ledgerCustomers.filter((c) => c.balance > 0.009).length
    const totalReceivableMinor = ledgerCustomers.reduce(
      (sum, c) => sum + (c.balance > 0.009 ? toMinorUnits(c.balance) : 0),
      0,
    )
    const periodSource = ledgerBounds ? displayLedgerCustomers : ledgerCustomers
    const periodNetMinor = periodSource.reduce((sum, c) => {
      const val =
        ledgerBounds && c.periodNet !== undefined ? c.periodNet : c.balance
      return sum + toMinorUnits(val || 0)
    }, 0)

    return {
      totalCount,
      debtorCount,
      totalReceivable: fromMinorUnits(totalReceivableMinor),
      periodNet: fromMinorUnits(periodNetMinor),
    }
  }, [ledgerCustomers, displayLedgerCustomers, ledgerBounds])

  const sortedCustomers = useMemo(
    () =>
      displayLedgerCustomers
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [displayLedgerCustomers],
  )

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * LEDGER_PAGE_SIZE
    return sortedCustomers.slice(start, start + LEDGER_PAGE_SIZE)
  }, [sortedCustomers, currentPage])

  const selectedCustomer = useMemo(
    () =>
      displayLedgerCustomers.find((c) => c.id === ledgerDetailId) ||
      ledgerCustomers.find((c) => c.id === ledgerDetailId),
    [displayLedgerCustomers, ledgerCustomers, ledgerDetailId],
  )

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-[#007aff]/10 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-[#007aff]" />
            </div>
            <span className="text-[11px] font-medium text-[#86868b]">
              Toplam Cari Kaydı
            </span>
          </div>
          <p className="text-[20px] font-bold text-[#1d1d1f]">
            {summary.totalCount} Cari
          </p>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            Bakiyesi açık borçlu:{" "}
            <span className="font-semibold text-[#e63462]">
              {summary.debtorCount} cari
            </span>
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-[#e63462]/10 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-[#e63462]" />
            </div>
            <span className="text-[11px] font-medium text-[#86868b]">
              Toplam Alınacak (Açık Cari Bakiye)
            </span>
          </div>
          <p className="text-[20px] font-bold text-[#e63462]">
            {"\u20BA"}
            {formatCurrency(summary.totalReceivable)}
          </p>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            Tahsil bekleyen toplam cari alacak
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-[#34c759]/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-[#34c759]" />
            </div>
            <span className="text-[11px] font-medium text-[#86868b]">
              Seçili Dönem Net Hareket
            </span>
          </div>
          <p
            className={`text-[20px] font-bold ${
              summary.periodNet > 0.009
                ? "text-red-600"
                : summary.periodNet < -0.009
                  ? "text-green-600"
                  : "text-[#1d1d1f]"
            }`}
          >
            {summary.periodNet > 0.009
              ? "+"
              : summary.periodNet < -0.009
                ? "\u2212"
                : ""}
            {"\u20BA"}
            {formatCurrency(Math.abs(summary.periodNet))}
          </p>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            {ledgerBounds
              ? "Seçili tarih aralığındaki net cari değişimi"
              : "Tüm dönemler toplam net bakiye"}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() =>
            void (async () => {
              await ledgerRefresh()
              if (ledgerBounds && token) await refetchLedgerTabCustomers()
            })()
          }
          className="h-[30px] px-3 flex items-center gap-1.5 border border-[#d1d1d6]/60 rounded-lg text-[12px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
        >
          Yenile
        </button>
        {canManageLedger && (
          <button
            type="button"
            onClick={() => setShowAddLedger(true)}
            className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Cari Ekle
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {ledgerBounds && ledgerTabLoading && ledgerTabCustomers === null ? (
          <div className="flex items-center justify-center py-16 text-[#86868b] gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[14px]">Yükleniyor…</span>
          </div>
        ) : (
          paginatedCustomers.map((c) => {
            const showPeriod = Boolean(
              ledgerBounds && c.periodNet !== undefined,
            )
            const net = showPeriod ? (c.periodNet ?? 0) : c.balance
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setLedgerDetailId(c.id)
                  setLedgerPayAmount("")
                  setLedgerPayMethod("cash")
                }}
                className="text-left bg-white rounded-xl border border-[#d1d1d6]/60 p-4 hover:border-[#e63462]/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookUser className="w-4 h-4 text-[#e63462] flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-semibold text-[#1d1d1f] truncate">
                        {c.name}
                      </h4>
                      {c.phone && (
                        <p className="text-[11px] text-[#86868b]">{c.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {showPeriod ? (
                      <>
                        <p
                          className={`text-[13px] font-bold ${net > 0.009 ? "text-red-600" : net < -0.009 ? "text-green-600" : "text-[#86868b]"}`}
                        >
                          Dönem neti
                        </p>
                        <p
                          className={`text-[14px] font-semibold ${net > 0.009 ? "text-red-600" : net < -0.009 ? "text-green-600" : "text-[#1d1d1f]"}`}
                        >
                          {net > 0.009 ? "+" : net < -0.009 ? "\u2212" : ""}
                          {"\u20BA"}
                          {formatCurrency(Math.abs(net))}
                        </p>
                        <p className="text-[10px] text-[#86868b] mt-0.5">
                          Güncel: {"\u20BA"}
                          {formatCurrency(Math.abs(c.balance))}
                        </p>
                      </>
                    ) : (
                      <>
                        <p
                          className={`text-[13px] font-bold ${c.balance > 0.009 ? "text-red-600" : c.balance < -0.009 ? "text-green-600" : "text-[#86868b]"}`}
                        >
                          {c.balance > 0.009
                            ? "Borç"
                            : c.balance < -0.009
                              ? "Alacak"
                              : "Bakiye"}
                        </p>
                        <p className="text-[14px] font-semibold text-[#1d1d1f]">
                          {"\u20BA"}
                          {formatCurrency(Math.abs(c.balance))}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
        {!ledgerBounds && ledgerCustomers.length === 0 && (
          <div className="text-center py-16 text-[#86868b] text-[14px]">
            Kayıtlı Cari yok. Yukarıdan Cari ekleyin.
          </div>
        )}
        {ledgerBounds &&
          !ledgerTabLoading &&
          displayLedgerCustomers.length === 0 && (
            <div className="text-center py-16 text-[#86868b] text-[14px]">
              Bu tarih aralığında Cari hareketi yok.
            </div>
          )}

        <PaginationBar
          currentPage={currentPage}
          totalItems={sortedCustomers.length}
          pageSize={LEDGER_PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="cari"
        />
      </div>

      {showAddLedger && (
        <AddLedgerCustomerModal
          lcName={lcName}
          setLcName={setLcName}
          lcPhone={lcPhone}
          setLcPhone={setLcPhone}
          lcNotes={lcNotes}
          setLcNotes={setLcNotes}
          lcSaving={lcSaving}
          onClose={() => setShowAddLedger(false)}
          onSave={() => void handleSaveLedgerCustomer()}
        />
      )}

      {ledgerDetailId && (
        <LedgerCustomerDetailModal
          customer={selectedCustomer}
          ledgerBounds={ledgerBounds}
          ledgerEntries={ledgerEntries}
          ledgerEntriesLoading={ledgerEntriesLoading}
          canCollectLedger={canCollectLedger}
          hasOpenShift={hasOpenShift}
          ledgerPayAmount={ledgerPayAmount}
          setLedgerPayAmount={setLedgerPayAmount}
          ledgerPayMethod={ledgerPayMethod}
          setLedgerPayMethod={setLedgerPayMethod}
          ledgerPayBusy={ledgerPayBusy}
          hasToken={Boolean(token)}
          onClose={() => setLedgerDetailId(null)}
          onCollect={() => void handleLedgerCollection()}
        />
      )}
    </>
  )
}
