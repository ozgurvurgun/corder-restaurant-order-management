import { useState, useMemo, useEffect } from "react"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CreditCard,
  Plus,
  Receipt,
  Search,
  Wallet,
} from "lucide-react"
import { api } from "@/lib/api"
import { usePanelAuth } from "@/lib/panel-auth"
import { mapCashTransactionDtoToPanel } from "@/lib/mappers/billing.mapper"
import type { CashShift, CashTransaction } from "@/lib/panel-types"
import {
  formatCurrency,
  formatIstanbulDateTime,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/format"
import { CustomSelect } from "@/components/ui/custom-inputs"
import { PaginationBar } from "@/components/ui/pagination-bar"

type TxFilterMode = "manual" | "expense" | "cash-in" | "sale" | "all"

export function CashTransactionsSection(props: {
  cashTransactions: CashTransaction[]
  currentShift: CashShift | null
  allShifts: CashShift[]
  dateBounds?: { from: Date; to: Date } | null
  canAddTransaction?: boolean
  canTxIn?: boolean
  canTxOut?: boolean
  onOpenAddTransaction: (type?: "expense" | "cash-in" | "cash-out") => void
}) {
  const {
    cashTransactions,
    currentShift,
    allShifts,
    dateBounds,
    canAddTransaction = true,
    canTxIn = true,
    canTxOut = true,
    onOpenAddTransaction,
  } = props

  const { token } = usePanelAuth()
  const [filterMode, setFilterMode] = useState<TxFilterMode>("manual")
  const [shiftScope, setShiftScope] = useState<string>("period")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [fetchedTransactions, setFetchedTransactions] = useState<CashTransaction[]>([])
  const pageSize = 15

  useEffect(() => {
    setPage(1)
  }, [filterMode, shiftScope, search, dateBounds])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const specificShiftId =
      shiftScope === "current"
        ? currentShift?.id
        : shiftScope !== "period"
          ? shiftScope
          : undefined
    const queryParams =
      !specificShiftId && dateBounds
        ? {
            from: dateBounds.from.toISOString(),
            to: dateBounds.to.toISOString(),
            limit: 1000,
          }
        : !specificShiftId
          ? { limit: 500 }
          : undefined

    void api.cashTransactions
      .list(token, specificShiftId, queryParams)
      .then((rows) => {
        if (!cancelled && rows) {
          setFetchedTransactions(rows.map(mapCashTransactionDtoToPanel))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [token, shiftScope, currentShift?.id, dateBounds])

  const mergedTransactions = useMemo(() => {
    const map = new Map<string, CashTransaction>()
    for (const tx of cashTransactions) map.set(tx.id, tx)
    for (const tx of fetchedTransactions) map.set(tx.id, tx)
    return Array.from(map.values())
  }, [cashTransactions, fetchedTransactions])

  const scopedTransactions = useMemo(() => {
    return mergedTransactions
      .filter((tx) => {
        if (shiftScope === "current") {
          return currentShift ? tx.shiftId === currentShift.id : false
        }
        if (shiftScope !== "period") {
          return tx.shiftId === shiftScope
        }
        if (dateBounds) {
          const d = new Date(tx.createdAt)
          return d >= dateBounds.from && d <= dateBounds.to
        }
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }, [mergedTransactions, shiftScope, currentShift, dateBounds])

  const kpis = useMemo(() => {
    let manualCashInMinor = 0
    let manualCashInCount = 0
    let cashExpenseOutMinor = 0
    let cashExpenseOutCount = 0
    let cardExpenseMinor = 0
    let cardExpenseCount = 0
    let saleCashMinor = 0
    let saleCashCount = 0

    for (const tx of scopedTransactions) {
      const amtMinor = toMinorUnits(tx.amount || 0)
      if (tx.type === "cash-in") {
        manualCashInMinor += amtMinor
        manualCashInCount += 1
      } else if (tx.type === "expense") {
        if (tx.reference === "credit-card") {
          cardExpenseMinor += amtMinor
          cardExpenseCount += 1
        } else {
          cashExpenseOutMinor += amtMinor
          cashExpenseOutCount += 1
        }
      } else if (tx.type === "cash-out" || tx.type === "refund") {
        cashExpenseOutMinor += amtMinor
        cashExpenseOutCount += 1
      } else if (tx.type === "sale") {
        saleCashMinor += amtMinor
        saleCashCount += 1
      }
    }

    const totalExpenseMinor = cashExpenseOutMinor + cardExpenseMinor
    return {
      manualCashIn: fromMinorUnits(manualCashInMinor),
      manualCashInCount,
      cashExpenseOut: fromMinorUnits(cashExpenseOutMinor),
      cashExpenseOutCount,
      cardExpense: fromMinorUnits(cardExpenseMinor),
      cardExpenseCount,
      totalExpense: fromMinorUnits(totalExpenseMinor),
      totalExpenseCount: cashExpenseOutCount + cardExpenseCount,
      saleCash: fromMinorUnits(saleCashMinor),
      saleCashCount,
      manualCount: manualCashInCount + cashExpenseOutCount + cardExpenseCount,
    }
  }, [scopedTransactions])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR")
    return scopedTransactions.filter((tx) => {
      if (filterMode === "manual" && tx.type === "sale") return false
      if (
        filterMode === "expense" &&
        tx.type !== "expense" &&
        tx.type !== "cash-out" &&
        tx.type !== "refund"
      )
        return false
      if (filterMode === "cash-in" && tx.type !== "cash-in") return false
      if (filterMode === "sale" && tx.type !== "sale") return false
      if (q) {
        const hay =
          `${tx.description} ${tx.createdBy}`.toLocaleLowerCase("tr-TR")
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [scopedTransactions, filterMode, search])

  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-[#86868b]">
              Manuel Nakit Giriş (Gelir)
            </span>
            <ArrowDownCircle className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-[19px] font-bold text-green-600">
            +{"\u20BA"}
            {formatCurrency(kpis.manualCashIn)}
          </p>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            {kpis.manualCashInCount} kayıt
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-[#86868b]">
              Nakit Gider & Çıkış (Kasadan)
            </span>
            <Banknote className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-[19px] font-bold text-red-500">
            -{"\u20BA"}
            {formatCurrency(kpis.cashExpenseOut)}
          </p>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            {kpis.cashExpenseOutCount} kayıt (Beklenen kasadan düşer)
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-[#86868b]">
              Kredi Kartı Gideri
            </span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-[19px] font-bold text-blue-600">
            -{"\u20BA"}
            {formatCurrency(kpis.cardExpense)}
          </p>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            {kpis.cardExpenseCount} kayıt (Nakit kasadan düşmez)
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-[#86868b]">
              Toplam Gider (Nakit + Kart)
            </span>
            <Wallet className="w-4 h-4 text-[#e63462]" />
          </div>
          <p className="text-[19px] font-bold text-[#1d1d1f]">
            {"\u20BA"}
            {formatCurrency(kpis.totalExpense)}
          </p>
          <p className="text-[11px] text-[#86868b] mt-0.5">
            Toplam {kpis.totalExpenseCount} gider / çıkış kaydı
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <div className="p-4 border-b border-[#f0f0f0] flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                Kaydedilen Gelir & Giderler / Kasa Hareketleri
              </h3>
              <p className="text-[11px] text-[#86868b]">
                Manuel eklenen gider, nakit giriş ve nakit çıkış kayıtlarını masa satışlarından ayrı olarak inceleyebilirsiniz.
              </p>
            </div>
            {currentShift && canAddTransaction && (
              <div className="flex flex-wrap items-center gap-1.5">
                {canTxOut && (
                  <button
                    type="button"
                    onClick={() => onOpenAddTransaction("expense")}
                    className="h-[30px] px-3 flex items-center gap-1.5 bg-red-50 text-red-600 rounded-lg text-[11px] font-semibold hover:bg-red-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Gider Ekle
                  </button>
                )}
                {canTxIn && (
                  <button
                    type="button"
                    onClick={() => onOpenAddTransaction("cash-in")}
                    className="h-[30px] px-3 flex items-center gap-1.5 bg-green-50 text-green-700 rounded-lg text-[11px] font-semibold hover:bg-green-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Nakit Giriş
                  </button>
                )}
                {canTxOut && (
                  <button
                    type="button"
                    onClick={() => onOpenAddTransaction("cash-out")}
                    className="h-[30px] px-3 flex items-center gap-1.5 bg-amber-50 text-amber-700 rounded-lg text-[11px] font-semibold hover:bg-amber-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Nakit Çıkış
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  {
                    id: "manual",
                    label: `Gelir & Giderler (${kpis.manualCount})`,
                  },
                  {
                    id: "expense",
                    label: `Sadece Gider / Çıkış (${kpis.totalExpenseCount})`,
                  },
                  {
                    id: "cash-in",
                    label: `Nakit Girişler (${kpis.manualCashInCount})`,
                  },
                  {
                    id: "sale",
                    label: `Masa Nakit Satışları (${kpis.saleCashCount})`,
                  },
                  {
                    id: "all",
                    label: `Tümü (${scopedTransactions.length})`,
                  },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setFilterMode(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    filterMode === pill.id
                      ? "bg-[#e63462] text-white"
                      : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CustomSelect
                value={shiftScope}
                onChange={(e) => setShiftScope(e.target.value)}
                className="h-[32px] px-2.5 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
              >
                <option value="period">Seçili Tarih Aralığı (Tüm Kasalar)</option>
                {currentShift && (
                  <option value="current">
                    Aktif Açık Kasa ({currentShift.openedBy})
                  </option>
                )}
                {allShifts
                  .filter((s) => s.status === "closed")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      Kapalı Kasa: {formatIstanbulDateTime(s.openedAt)} ({s.openedBy})
                    </option>
                  ))}
              </CustomSelect>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Açıklama veya kişi ara..."
                  className="h-[32px] w-[180px] pl-8 pr-3 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Tarih / Saat
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Tür
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Açıklama
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  İşleyen
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Tutar
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-[12px] text-[#86868b]"
                  >
                    Seçili filtreye uygun gelir / gider veya kasa hareketi bulunmuyor.
                  </td>
                </tr>
              ) : (
                paginated.map((tx, idx) => (
                  <tr
                    key={tx.id}
                    className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-[12px] text-[#86868b] whitespace-nowrap">
                      {formatIstanbulDateTime(tx.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                          tx.type === "sale"
                            ? "bg-green-50 text-green-600"
                            : tx.type === "expense"
                              ? tx.reference === "credit-card"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-red-50 text-red-600"
                              : tx.type === "cash-in"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {tx.type === "sale" ? (
                          <Receipt className="w-3 h-3" />
                        ) : tx.type === "cash-in" ? (
                          <ArrowDownCircle className="w-3 h-3" />
                        ) : (
                          <ArrowUpCircle className="w-3 h-3" />
                        )}
                        {tx.type === "sale"
                          ? "Masa Satışı (Nakit)"
                          : tx.type === "expense"
                            ? tx.reference === "credit-card"
                              ? "Gider · Kredi Kartı"
                              : "Gider · Nakit"
                            : tx.type === "cash-in"
                              ? "Nakit Giriş (Gelir)"
                              : tx.type === "cash-out"
                                ? "Nakit Çıkış"
                                : "İade"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-medium text-[#1d1d1f]">
                      {tx.description}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#86868b]">
                      {tx.createdBy}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-[12px] text-right font-bold whitespace-nowrap ${
                        tx.type === "sale" || tx.type === "cash-in"
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {tx.type === "sale" || tx.type === "cash-in" ? "+" : "-"}
                      {"\u20BA"}
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <PaginationBar
            currentPage={page}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="kayıt"
          />
        </div>
      </div>
    </div>
  )
}
