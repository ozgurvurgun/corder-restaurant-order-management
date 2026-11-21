import { useState, useMemo, useEffect } from "react"
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronRight, Receipt } from "lucide-react"
import type { CashShift, CashTransaction, ClosedTable, RestaurantSettings } from "@/lib/panel-types"
import type { ShiftTotalsSummary } from "./shift-history-section"
import { formatCurrency, formatIstanbulDateTime, formatIstanbulTime, fromMinorUnits, toMinorUnits } from "@/lib/format"
import { PaginationBar } from "@/components/ui/pagination-bar"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  "credit-card": "Kredi Kartı",
  "meal-card": "Yemek Kartı",
  multinet: "Multinet",
  split: "Parçalı Ödeme",
  ledger: "Cari",
}

const TX_PAGE_SIZE = 10
const TABLES_PAGE_SIZE = 10

export function ShiftFullDetailPanel(props: {
  settings: RestaurantSettings
  selectedShift: CashShift
  shiftTotals: ShiftTotalsSummary
  shiftTransactions: CashTransaction[]
  shiftClosedTables: ClosedTable[]
  loadingDetails?: boolean
}) {
  const { settings, selectedShift, shiftTotals, shiftTransactions, shiftClosedTables, loadingDetails = false } = props
  const [txFilter, setTxFilter] = useState<"all" | "manual" | "sale">("all")
  const [txPage, setTxPage] = useState(1)
  const [tablesPage, setTablesPage] = useState(1)
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null)

  useEffect(() => {
    setTxPage(1)
  }, [selectedShift.id, txFilter])

  useEffect(() => {
    setTablesPage(1)
    setExpandedTableId(null)
  }, [selectedShift.id])

  const isOpenShift = selectedShift.status === "open"
  const reportTitle = isOpenShift ? "X RAPORU (AÇIK KASA ANLIK ÖZETİ)" : "Z RAPORU (KAPANMIŞ KASA DETAY RAPORU)"

  const expectedMinorUnits =
    toMinorUnits(selectedShift.openingBalance || 0) +
    toMinorUnits(selectedShift.cashIn || 0) -
    toMinorUnits(selectedShift.cashOut || 0)
  const expectedCash = fromMinorUnits(expectedMinorUnits)
  const hasClosingBalance = selectedShift.status === "closed" && selectedShift.closingBalance != null
  const closingDiffMinorUnits = hasClosingBalance ? toMinorUnits(selectedShift.closingBalance || 0) - expectedMinorUnits : 0

  const manualStats = useMemo(() => {
    let cashInMinor = 0
    let cashExpenseMinor = 0
    let cardExpenseMinor = 0
    let manualCount = 0
    for (const tx of shiftTransactions) {
      const m = toMinorUnits(tx.amount || 0)
      if (tx.type === "cash-in") { cashInMinor += m; manualCount += 1 }
      else if (tx.type === "expense") {
        manualCount += 1
        if (tx.reference === "credit-card") cardExpenseMinor += m
        else cashExpenseMinor += m
      } else if (tx.type === "cash-out" || tx.type === "refund") {
        manualCount += 1
        cashExpenseMinor += m
      }
    }
    return {
      cashIn: fromMinorUnits(cashInMinor),
      cashExpense: fromMinorUnits(cashExpenseMinor),
      cardExpense: fromMinorUnits(cardExpenseMinor),
      manualCount,
    }
  }, [shiftTransactions])

  const filteredShiftTxs = useMemo(() => {
    return shiftTransactions.filter((tx) => {
      if (txFilter === "manual") return tx.type !== "sale"
      if (txFilter === "sale") return tx.type === "sale"
      return true
    })
  }, [shiftTransactions, txFilter])

  const paginatedShiftTxs = useMemo(
    () => filteredShiftTxs.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE),
    [filteredShiftTxs, txPage],
  )

  const paginatedClosedTables = useMemo(
    () => shiftClosedTables.slice((tablesPage - 1) * TABLES_PAGE_SIZE, tablesPage * TABLES_PAGE_SIZE),
    [shiftClosedTables, tablesPage],
  )

  const totalDiscount = useMemo(
    () => fromMinorUnits(shiftClosedTables.reduce((sum, ct) => sum + toMinorUnits(ct.discountAmount || 0), 0)),
    [shiftClosedTables],
  )

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 sm:p-6">
        <div className="text-center mb-5">
          <h3 className="text-[18px] font-bold text-[#1d1d1f]">{settings.name}</h3>
          {settings.address && <p className="text-[11px] text-[#86868b] mt-1">{settings.address}</p>}
          {settings.taxId && <p className="text-[11px] text-[#86868b]">VKN: {settings.taxId}</p>}
          <div className="mt-3 h-px bg-[#d1d1d6]/40" />
          <div className="mt-3 inline-flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isOpenShift ? "bg-green-50 text-green-700" : "bg-[#f5f5f7] text-[#1d1d1f]"}`}>
              {isOpenShift ? "Açık Vardiya" : "Kapanmış Kasa"}
            </span>
            <p className="text-[14px] font-bold text-[#1d1d1f]">{reportTitle}</p>
          </div>
          <p className="text-[11px] text-[#86868b] mt-1">
            Açılış: {formatIstanbulDateTime(selectedShift.openedAt)} ({selectedShift.openedBy})
          </p>
          {selectedShift.closedAt && (
            <p className="text-[11px] text-[#86868b]">
              Kapanış: {formatIstanbulDateTime(selectedShift.closedAt)} ({selectedShift.closedBy || "-"})
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[13px]">
          <div className="space-y-2">
            <div className="pb-1 border-b border-[#f0f0f0]">
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Satış & Ödeme Dağılımı</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dashed border-[#d1d1d6]">
              <span className="text-[#86868b]">Toplam Net Ciro</span>
              <span className="font-bold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(shiftTotals.totalRevenue || 0)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dashed border-[#d1d1d6]">
              <span className="text-[#86868b]">Kapanan Masa / Adisyon Sayısı</span>
              <span className="font-bold text-[#1d1d1f]">{shiftClosedTables.length || selectedShift.transactionCount || 0}</span>
            </div>
            {[
              { label: "Nakit Satış", value: shiftTotals.totalCash || 0 },
              { label: "Kredi Kartı Satış", value: shiftTotals.totalCard || 0 },
              { label: "Yemek Kartı Satış", value: shiftTotals.totalMealCard || 0 },
              { label: "Multinet Satış", value: shiftTotals.totalMultinet || 0 },
              { label: "Cariye Atılan", value: shiftTotals.totalLedger || 0 },
              ...(totalDiscount > 0 ? [{ label: "Toplam İndirim", value: totalDiscount }] : []),
            ].map((row) => (
              <div key={row.label} className="flex justify-between py-0.5">
                <span className="text-[#86868b]">{row.label}</span>
                <span className="font-medium text-[#1d1d1f]">{"\u20BA"}{formatCurrency(row.value)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="pb-1 border-b border-[#f0f0f0]">
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kasa Nakit Akışı & Gelir / Gider Özeti</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[#86868b]">Açılış Bakiyesi</span>
              <span className="font-medium text-[#1d1d1f]">{"\u20BA"}{formatCurrency(selectedShift.openingBalance || 0)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[#86868b]">Toplam Nakit Giriş (Satış + Manuel Giriş)</span>
              <span className="font-medium text-green-600">+{"\u20BA"}{formatCurrency(selectedShift.cashIn || 0)}</span>
            </div>
            {manualStats.cashIn > 0 && (
              <div className="flex justify-between py-0.5 pl-3 text-[12px]">
                <span className="text-[#86868b]">↳ Manuel Nakit Giriş / Tahsilat</span>
                <span className="text-green-600">+{"\u20BA"}{formatCurrency(manualStats.cashIn)}</span>
              </div>
            )}
            <div className="flex justify-between py-0.5">
              <span className="text-[#86868b]">Toplam Nakit Çıkış & Nakit Gider</span>
              <span className="font-medium text-red-500">-{"\u20BA"}{formatCurrency(selectedShift.cashOut || 0)}</span>
            </div>
            {manualStats.cardExpense > 0 && (
              <div className="flex justify-between py-0.5 text-[12px]">
                <span className="text-[#86868b]">Kredi Kartı Gideri (Kasadan Düşmez)</span>
                <span className="font-medium text-blue-600">-{"\u20BA"}{formatCurrency(manualStats.cardExpense)}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-t border-[#d1d1d6] font-bold">
              <span className="text-[#1d1d1f]">Kasada Beklenen Nakit</span>
              <span className="text-[#e63462]">{"\u20BA"}{formatCurrency(expectedCash)}</span>
            </div>
            {hasClosingBalance && (
              <>
                <div className="flex justify-between py-0.5 font-semibold">
                  <span className="text-[#1d1d1f]">Sayılan Kasa (Kapanış)</span>
                  <span className="text-[#1d1d1f]">{"\u20BA"}{formatCurrency(selectedShift.closingBalance || 0)}</span>
                </div>
                <div className="flex justify-between py-0.5 font-semibold">
                  <span className="text-[#86868b]">Kasa Farkı</span>
                  <span className={closingDiffMinorUnits === 0 ? "text-green-600" : closingDiffMinorUnits > 0 ? "text-blue-600" : "text-red-600"}>
                    {closingDiffMinorUnits === 0
                      ? "Tam (\u20BA0,00)"
                      : closingDiffMinorUnits > 0
                        ? `+\u20BA${formatCurrency(fromMinorUnits(closingDiffMinorUnits))} (Fazla)`
                        : `-\u20BA${formatCurrency(fromMinorUnits(Math.abs(closingDiffMinorUnits)))} (Açık)`}
                  </span>
                </div>
              </>
            )}
            {selectedShift.notes && (
              <div className="mt-2 pt-2 border-t border-dashed border-[#d1d1d6] text-[12px] text-[#86868b]">
                Kapanış Notu: {selectedShift.notes}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Shift Gelir / Gider & Cash Transactions */}
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <div className="px-4 py-3 bg-[#f9f9f9] border-b border-[#f0f0f0] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-[13px] font-semibold text-[#1d1d1f]">
              Vardiya Gelir / Gider ve Kasa Hareketleri ({shiftTransactions.length})
            </h4>
            <p className="text-[11px] text-[#86868b]">
              Bu kasada kaydedilen tüm manuel giderler, nakit giriş/çıkışlar ve nakit masa tahsilatları
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "all", label: `Tümü (${shiftTransactions.length})` },
                { id: "manual", label: `Manuel Gelir & Gider (${manualStats.manualCount})` },
                { id: "sale", label: `Masa Nakit Satış (${shiftTransactions.length - manualStats.manualCount})` },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setTxFilter(pill.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  txFilter === pill.id ? "bg-[#e63462] text-white" : "bg-white border border-[#d1d1d6]/60 text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loadingDetails && shiftTransactions.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-[#86868b]">Vardiya hareketleri yükleniyor...</p>
          ) : filteredShiftTxs.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-[#86868b]">Bu vardiyada seçili filtreye uygun kasa hareketi bulunmuyor.</p>
          ) : (
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="bg-[#fcfcfd] border-b border-[#f0f0f0]">
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b]">Saat</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b]">Tür</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b]">Açıklama</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b]">İşleyen</th>
                  <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b]">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShiftTxs.map((tx, idx) => (
                  <tr key={tx.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                    <td className="px-4 py-2 text-[12px] text-[#86868b]">{formatIstanbulTime(tx.createdAt)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                          tx.type === "sale"
                            ? "bg-green-50 text-green-600"
                            : tx.type === "expense"
                              ? tx.reference === "credit-card" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                              : tx.type === "cash-in" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {tx.type === "sale" ? <Receipt className="w-3 h-3" /> : tx.type === "cash-in" ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
                        {tx.type === "sale"
                          ? "Masa Satışı"
                          : tx.type === "expense"
                            ? tx.reference === "credit-card" ? "Gider · Kart" : "Gider · Nakit"
                            : tx.type === "cash-in" ? "Nakit Giriş" : tx.type === "cash-out" ? "Nakit Çıkış" : "İade"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">{tx.description}</td>
                    <td className="px-4 py-2 text-[12px] text-[#86868b]">{tx.createdBy}</td>
                    <td className={`px-4 py-2 text-[12px] text-right font-bold ${tx.type === "sale" || tx.type === "cash-in" ? "text-green-600" : "text-red-500"}`}>
                      {tx.type === "sale" || tx.type === "cash-in" ? "+" : "-"}
                      {"\u20BA"}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {filteredShiftTxs.length > TX_PAGE_SIZE && (
          <div className="px-4 pb-3">
            <PaginationBar
              currentPage={txPage}
              totalItems={filteredShiftTxs.length}
              pageSize={TX_PAGE_SIZE}
              onPageChange={setTxPage}
              itemLabel="işlem"
            />
          </div>
        )}
      </div>

      {/* Section 3: Closed Tables / Checks in this Shift */}
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <div className="px-4 py-3 bg-[#f9f9f9] border-b border-[#f0f0f0] flex items-center justify-between">
          <div>
            <h4 className="text-[13px] font-semibold text-[#1d1d1f]">
              Bu Vardiyada Kapanan Masalar & Adisyonlar ({shiftClosedTables.length})
            </h4>
            <p className="text-[11px] text-[#86868b]">Adisyon içeriklerini ve ödeme detaylarını görmek için satıra tıklayın</p>
          </div>
        </div>

        <div className="divide-y divide-[#f0f0f0]">
          {shiftClosedTables.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-[#86868b]">Bu vardiya zaman aralığında kapanmış masa adisyonu bulunmuyor.</p>
          ) : (
            paginatedClosedTables.map((ct) => {
              const isExpanded = expandedTableId === ct.id
              const items = ct.orders.flatMap((o) => o.items)
              return (
                <div key={ct.id} className="bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedTableId(isExpanded ? null : ct.id)}
                    className="w-full px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-[#f9f9fb] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-[#86868b]" /> : <ChevronRight className="w-4 h-4 text-[#86868b]" />}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold text-[#1d1d1f]">{ct.tableName}</span>
                          <span className="px-1.5 py-0.5 rounded bg-[#f5f5f7] text-[10px] font-medium text-[#86868b]">{ct.section}</span>
                          <span className="text-[11px] text-[#86868b]">Garson: {ct.waiter} · Kapatan: {ct.closedBy}</span>
                        </div>
                        <div className="text-[11px] text-[#86868b] mt-0.5 flex flex-wrap items-center gap-2">
                          <span>{formatIstanbulTime(ct.openedAt)} - {formatIstanbulTime(ct.closedAt)}</span>
                          <span>·</span>
                          <span className="font-medium text-[#1d1d1f]">{PAYMENT_METHOD_LABELS[ct.payment.method] || ct.payment.method}</span>
                          {ct.payment.method === "split" && ct.payment.splitDetails && ct.payment.splitDetails.length > 0 && (
                            <span>({ct.payment.splitDetails.map((sd) => `${PAYMENT_METHOD_LABELS[sd.method] || sd.method}: \u20BA${formatCurrency(sd.amount)}`).join(" + ")})</span>
                          )}
                          {ct.discountAmount > 0 && (
                            <span className="text-amber-600 font-medium">(İndirim: -{"\u20BA"}{formatCurrency(ct.discountAmount)})</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-[#e63462]">{"\u20BA"}{formatCurrency(ct.netAmount)}</p>
                      <p className="text-[10px] text-[#86868b]">{items.length} kalem</p>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-9 pb-3 pt-1 bg-[#fafafa] border-t border-[#f0f0f0] space-y-1">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-[12px] py-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1d1d1f]">{item.quantity}x</span>
                            <span className={item.status === "cancelled" ? "line-through text-[#86868b]" : "text-[#1d1d1f]"}>{item.productName}</span>
                            {item.status === "cancelled" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">İptal</span>}
                          </div>
                          <span className="font-medium text-[#1d1d1f]">{"\u20BA"}{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
        {shiftClosedTables.length > TABLES_PAGE_SIZE && (
          <div className="px-4 pb-3 border-t border-[#f0f0f0]">
            <PaginationBar
              currentPage={tablesPage}
              totalItems={shiftClosedTables.length}
              pageSize={TABLES_PAGE_SIZE}
              onPageChange={setTablesPage}
              itemLabel="kapanan masa"
            />
          </div>
        )}
      </div>
    </div>
  )
}
