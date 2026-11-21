import { useState, useMemo } from "react"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  ChevronRight,
  CreditCard,
  DollarSign,
  History,
  Receipt,
  UtensilsCrossed,
  Wallet,
} from "lucide-react"
import type { CashShift, CashTransaction } from "@/lib/panel-types"
import type { ShiftTotalsSummary } from "./shift-history-section"
import {
  formatCurrency,
  formatIstanbulDateTime,
  formatIstanbulTime,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/format"

export { CashTransactionsSection } from "./cash-transactions-section"

export function ShiftOverviewSection(props: {
  currentShift: CashShift | null
  shiftTotals: ShiftTotalsSummary
  shiftTransactions: CashTransaction[]
  closedShifts: CashShift[]
  canViewCashTotals?: boolean
  canOpenShift?: boolean
  canTxIn?: boolean
  canTxOut?: boolean
  canViewHistory?: boolean
  onOpenShiftModal: () => void
  onOpenAddTransaction: (type: "expense" | "cash-in" | "cash-out") => void
  onOpenTransactionsTab?: () => void
  onInspectClosedShift?: (shiftId: string) => void
}) {
  const {
    currentShift,
    shiftTotals,
    shiftTransactions,
    closedShifts,
    canViewCashTotals = true,
    canOpenShift = true,
    canTxIn = true,
    canTxOut = true,
    canViewHistory = true,
    onOpenShiftModal,
    onOpenAddTransaction,
    onOpenTransactionsTab,
    onInspectClosedShift,
  } = props

  const [recentFilter, setRecentFilter] = useState<"all" | "manual">("all")

  const manualTransactions = useMemo(
    () => shiftTransactions.filter((tx) => tx.type !== "sale"),
    [shiftTransactions],
  )

  const displayedRecentTransactions = useMemo(
    () =>
      (recentFilter === "manual" ? manualTransactions : shiftTransactions).slice(
        0,
        12,
      ),
    [recentFilter, manualTransactions, shiftTransactions],
  )

  const renderClosedShiftsPreview = () => {
    if (!canViewHistory || closedShifts.length === 0) return null
    return (
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <div className="px-4 py-3 bg-[#f9f9f9] border-b border-[#f0f0f0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#e63462]" />
            <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
              Son Kapanmış Kasalar (Vardiya Geçmişi)
            </h3>
          </div>
          {onInspectClosedShift && closedShifts[0] && (
            <button
              type="button"
              onClick={() => onInspectClosedShift(closedShifts[0].id)}
              className="text-[11px] font-semibold text-[#e63462] hover:underline flex items-center gap-0.5"
            >
              Tüm Geçmiş Kasaları Gör ({closedShifts.length})
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div>
          {closedShifts.slice(0, 5).map((s, idx) => {
            const expMinor =
              toMinorUnits(s.openingBalance || 0) +
              toMinorUnits(s.cashIn || 0) -
              toMinorUnits(s.cashOut || 0)
            const diffMinor =
              s.closingBalance != null
                ? toMinorUnits(s.closingBalance) - expMinor
                : 0
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onInspectClosedShift?.(s.id)}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#f5f5f7] transition-colors text-left ${
                  idx > 0 ? "border-t border-[#f0f0f0]" : ""
                }`}
              >
                <div>
                  <p className="text-[12px] font-semibold text-[#1d1d1f]">
                    {s.openedBy}
                    {s.closedBy ? ` → Kapatan: ${s.closedBy}` : ""}
                  </p>
                  <p className="text-[11px] text-[#86868b]">
                    {formatIstanbulDateTime(s.openedAt)} -{" "}
                    {s.closedAt ? formatIstanbulDateTime(s.closedAt) : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-[#e63462]">
                      Ciro: {"\u20BA"}
                      {formatCurrency(s.totalRevenue)}
                    </p>
                    <p className="text-[10px] text-[#86868b]">
                      Sayılan:{" "}
                      {s.closingBalance != null
                        ? `\u20BA${formatCurrency(s.closingBalance)}`
                        : "-"}{" "}
                      · Fark:{" "}
                      <span
                        className={
                          diffMinor === 0
                            ? "text-green-600 font-semibold"
                            : diffMinor > 0
                              ? "text-blue-600 font-semibold"
                              : "text-red-600 font-semibold"
                        }
                      >
                        {diffMinor === 0
                          ? "Tam"
                          : diffMinor > 0
                            ? `+\u20BA${formatCurrency(fromMinorUnits(diffMinor))}`
                            : `-\u20BA${formatCurrency(fromMinorUnits(Math.abs(diffMinor)))}`}
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#86868b]" />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (!currentShift) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 text-center py-14 px-4">
          <Wallet className="w-12 h-12 text-[#d1d1d6] mx-auto mb-3" />
          <p className="text-[14px] text-[#86868b] mb-4">
            Kasa şu anda kapalı. Satış ve gelir/gider işlemi yapabilmek için kasayı açın.
          </p>
          {canOpenShift && (
            <button
              onClick={onOpenShiftModal}
              className="h-[40px] px-6 bg-[#34c759] text-white rounded-xl text-[14px] font-semibold hover:bg-[#2db84e] transition-colors"
            >
              Kasa Aç
            </button>
          )}
        </div>
        {renderClosedShiftsPreview()}
      </div>
    )
  }

  const expectedCash = fromMinorUnits(
    toMinorUnits(currentShift.openingBalance) +
      toMinorUnits(currentShift.cashIn) -
      toMinorUnits(currentShift.cashOut),
  )

  return (
    <>
      {canViewCashTotals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Toplam Ciro",
              value: shiftTotals.totalRevenue,
              icon: DollarSign,
              color: "#34c759",
            },
            {
              label: "Nakit",
              value: shiftTotals.totalCash,
              icon: Banknote,
              color: "#007aff",
            },
            {
              label: "Kredi Kartı",
              value: shiftTotals.totalCard,
              icon: CreditCard,
              color: "#ff9500",
            },
            {
              label: "Yemek Kartı",
              value: fromMinorUnits(
                toMinorUnits(shiftTotals.totalMealCard) +
                  toMinorUnits(shiftTotals.totalMultinet),
              ),
              icon: UtensilsCrossed,
              color: "#af52de",
            },
          ].map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${card.color}15` }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: card.color }}
                    />
                  </div>
                  <span className="text-[11px] text-[#86868b] font-medium">
                    {card.label}
                  </span>
                </div>
                <p className="text-[20px] font-bold text-[#1d1d1f]">
                  {"\u20BA"}
                  {formatCurrency(card.value)}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">
          Vardiya Bilgisi
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-[12px]">
          <div>
            <span className="text-[#86868b]">Açan: </span>
            <span className="text-[#1d1d1f] font-medium">
              {currentShift.openedBy}
            </span>
          </div>
          <div>
            <span className="text-[#86868b]">Açılış: </span>
            <span className="text-[#1d1d1f] font-medium">
              {formatIstanbulTime(currentShift.openedAt)}
            </span>
          </div>
          <div>
            <span className="text-[#86868b]">Açılış Bakiye: </span>
            <span className="text-[#1d1d1f] font-medium">
              {"\u20BA"}
              {formatCurrency(currentShift.openingBalance)}
            </span>
          </div>
          {canViewCashTotals && (
            <>
              <div>
                <span className="text-[#86868b]">Nakit Giriş: </span>
                <span className="text-green-600 font-medium">
                  +{"\u20BA"}
                  {formatCurrency(currentShift.cashIn)}
                </span>
              </div>
              <div>
                <span className="text-[#86868b]">Nakit Çıkış: </span>
                <span className="text-red-500 font-medium">
                  -{"\u20BA"}
                  {formatCurrency(currentShift.cashOut)}
                </span>
              </div>
              <div>
                <span className="text-[#86868b]">Beklenen Kasa: </span>
                <span className="text-[#1d1d1f] font-bold">
                  {"\u20BA"}
                  {formatCurrency(expectedCash)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {(canTxIn || canTxOut) && (
        <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3">
          {canTxOut && (
            <button
              onClick={() => onOpenAddTransaction("expense")}
              className="flex-1 flex items-center justify-center gap-2 h-[40px] bg-white border border-[#d1d1d6]/60 rounded-xl text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
            >
              <ArrowUpCircle className="w-4 h-4 text-red-500" /> Gider Ekle
            </button>
          )}
          {canTxIn && (
            <button
              onClick={() => onOpenAddTransaction("cash-in")}
              className="flex-1 flex items-center justify-center gap-2 h-[40px] bg-white border border-[#d1d1d6]/60 rounded-xl text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
            >
              <ArrowDownCircle className="w-4 h-4 text-green-500" /> Nakit Giriş
            </button>
          )}
          {canTxOut && (
            <button
              onClick={() => onOpenAddTransaction("cash-out")}
              className="flex-1 flex items-center justify-center gap-2 h-[40px] bg-white border border-[#d1d1d6]/60 rounded-xl text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
            >
              <ArrowUpCircle className="w-4 h-4 text-amber-500" /> Nakit Çıkış
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
              Son İşlemler
            </h3>
            <div className="flex items-center gap-1 bg-[#f5f5f7] p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setRecentFilter("all")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                  recentFilter === "all"
                    ? "bg-white text-[#1d1d1f] shadow-sm"
                    : "text-[#86868b]"
                }`}
              >
                Tümü ({shiftTransactions.length})
              </button>
              <button
                type="button"
                onClick={() => setRecentFilter("manual")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                  recentFilter === "manual"
                    ? "bg-white text-[#e63462] shadow-sm"
                    : "text-[#86868b]"
                }`}
              >
                Sadece Gelir & Gider ({manualTransactions.length})
              </button>
            </div>
          </div>
          {onOpenTransactionsTab && (
            <button
              type="button"
              onClick={onOpenTransactionsTab}
              className="text-[11px] font-semibold text-[#e63462] hover:underline flex items-center gap-0.5"
            >
              Tüm Gelir & Giderleri Gör
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-[300px] overflow-auto">
          {displayedRecentTransactions.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-[#86868b]">
              {recentFilter === "manual"
                ? "Bu vardiyada henüz kaydedilmiş manuel gelir veya gider bulunmuyor."
                : "Bu vardiyada henüz işlem bulunmuyor."}
            </p>
          ) : (
            displayedRecentTransactions.map((tx, idx) => (
              <div
                key={tx.id}
                className={`flex items-center justify-between px-4 py-2.5 ${idx > 0 ? "border-t border-[#f0f0f0]" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${tx.type === "sale" ? "bg-green-50" : tx.type === "expense" || tx.type === "cash-out" ? "bg-red-50" : "bg-blue-50"}`}
                  >
                    {tx.type === "sale" ? (
                      <Receipt className="w-3.5 h-3.5 text-green-600" />
                    ) : tx.type === "expense" ? (
                      <ArrowUpCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : tx.type === "cash-in" ? (
                      <ArrowDownCircle className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <ArrowUpCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] font-medium text-[#1d1d1f]">
                        {tx.description}
                      </p>
                      {tx.type === "expense" && (
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            tx.reference === "credit-card"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {tx.reference === "credit-card"
                            ? "Kredi Kartı"
                            : "Nakit"}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#86868b]">
                      {formatIstanbulTime(tx.createdAt)} - {tx.createdBy}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[13px] font-semibold ${tx.type === "sale" || tx.type === "cash-in" ? "text-green-600" : "text-red-500"}`}
                >
                  {tx.type === "sale" || tx.type === "cash-in" ? "+" : "-"}
                  {"\u20BA"}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {renderClosedShiftsPreview()}
    </>
  )
}
