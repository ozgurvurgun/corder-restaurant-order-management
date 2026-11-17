import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CreditCard,
  DollarSign,
  Plus,
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
  } = props

  if (!currentShift) {
    return (
      <div className="text-center py-20">
        <Wallet className="w-12 h-12 text-[#d1d1d6] mx-auto mb-3" />
        <p className="text-[14px] text-[#86868b] mb-4">
          Kasa kapalı. İşlem yapabilmek için kasayı açın.
        </p>
        {canOpenShift && (
          <button
            onClick={onOpenShiftModal}
            className="h-[40px] px-6 bg-[#34c759] text-white rounded-xl text-[14px] font-semibold hover:bg-[#2db84e] transition-colors"
          >
            Kasa Aç
          </button>
        )}
        {canViewHistory && closedShifts.length > 0 && (
          <div className="mt-8 max-w-2xl mx-auto">
            <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">
              Önceki Vardiyalar
            </h3>
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
              {closedShifts.slice(0, 5).map((s, idx) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t border-[#f0f0f0]" : ""}`}
                >
                  <div className="text-left">
                    <p className="text-[12px] font-medium text-[#1d1d1f]">
                      {s.openedBy} - {s.closedBy}
                    </p>
                    <p className="text-[10px] text-[#86868b]">
                      {formatIstanbulDateTime(s.openedAt)} -{" "}
                      {s.closedAt ? formatIstanbulTime(s.closedAt) : "-"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-[#e63462]">
                      {"\u20BA"}
                      {formatCurrency(s.totalRevenue)}
                    </p>
                    <p className="text-[10px] text-[#86868b]">
                      {s.transactionCount} işlem
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
        <div className="grid grid-cols-4 gap-3">
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
        <div className="grid grid-cols-3 gap-4 text-[12px]">
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
        <div className="flex gap-3">
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
        <h3 className="text-[13px] font-semibold text-[#1d1d1f] px-4 pt-4 pb-2">
          Son İşlemler
        </h3>
        <div className="max-h-[300px] overflow-auto">
          {shiftTransactions.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-[#86868b]">
              Bu vardiyada henüz işlem bulunmuyor.
            </p>
          ) : (
            shiftTransactions.slice(0, 10).map((tx, idx) => (
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
                          {tx.reference === "credit-card" ? "Kredi Kartı" : "Nakit"}
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
    </>
  )
}

export function CashTransactionsSection(props: {
  cashTransactions: CashTransaction[]
  currentShift: CashShift | null
  canAddTransaction?: boolean
  onOpenAddTransaction: () => void
}) {
  const {
    cashTransactions,
    currentShift,
    canAddTransaction = true,
    onOpenAddTransaction,
  } = props
  const sorted = [...cashTransactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
          Tüm İşlemler
        </h3>
        {currentShift && canAddTransaction && (
          <button
            onClick={onOpenAddTransaction}
            className="h-[28px] px-3 flex items-center gap-1.5 bg-[#e63462]/10 text-[#e63462] rounded-lg text-[11px] font-medium hover:bg-[#e63462]/20"
          >
            <Plus className="w-3 h-3" /> İşlem Ekle
          </button>
        )}
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
            <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
              Saat
            </th>
            <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
              Tür
            </th>
            <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
              Açıklama
            </th>
            <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
              İşleyen
            </th>
            <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
              Tutar
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((tx, idx) => (
            <tr
              key={tx.id}
              className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}
            >
              <td className="px-4 py-2 text-[12px] text-[#86868b]">
                {formatIstanbulTime(tx.createdAt)}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded ${tx.type === "sale" ? "bg-green-50 text-green-600" : tx.type === "expense" ? "bg-red-50 text-red-500" : tx.type === "cash-in" ? "bg-blue-50 text-blue-600" : tx.type === "refund" ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-500"}`}
                >
                  {tx.type === "sale"
                    ? "Satış"
                    : tx.type === "expense"
                      ? tx.reference === "credit-card"
                        ? "Gider · Kart"
                        : "Gider · Nakit"
                      : tx.type === "cash-in"
                        ? "Giriş"
                        : tx.type === "cash-out"
                          ? "Çıkış"
                          : "İade"}
                </span>
              </td>
              <td className="px-4 py-2 text-[12px] text-[#1d1d1f]">
                {tx.description}
              </td>
              <td className="px-4 py-2 text-[12px] text-[#86868b]">
                {tx.createdBy}
              </td>
              <td
                className={`px-4 py-2 text-[12px] text-right font-semibold ${tx.type === "sale" || tx.type === "cash-in" ? "text-green-600" : "text-red-500"}`}
              >
                {tx.type === "sale" || tx.type === "cash-in" ? "+" : "-"}
                {"\u20BA"}
                {formatCurrency(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
