import { useMemo, useState } from "react"
import type {
  CategoryBreakdownDto,
  ShiftSummaryDto,
  WaiterPerformanceDto,
} from "@/lib/types"
import { formatIstanbulDateTime, formatMoney } from "@/lib/format"
import { PaginationBar } from "./ui/pagination-bar"
import {
  Award,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Receipt,
  Users,
  Wallet,
} from "lucide-react"

interface BossAnalyticsSectionsProps {
  hourlySales: Array<{ hour: string; revenue: number; ordersCount: number }>
  categoryBreakdown: CategoryBreakdownDto[]
  topProducts: Array<{ productName: string; quantity: number; revenue: number }>
  waiterPerformance: WaiterPerformanceDto[]
  shiftSummaries: ShiftSummaryDto[]
}

export function BossAnalyticsSections({
  hourlySales,
  categoryBreakdown,
  topProducts,
  waiterPerformance,
  shiftSummaries,
}: BossAnalyticsSectionsProps) {
  const [waiterPage, setWaiterPage] = useState(1)
  const waiterPageSize = 5
  const [shiftPage, setShiftPage] = useState(1)
  const shiftPageSize = 6
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null)

  const pagedShifts = useMemo(() => {
    const start = (shiftPage - 1) * shiftPageSize
    return shiftSummaries.slice(start, start + shiftPageSize)
  }, [shiftSummaries, shiftPage])

  const maxHourlyRev = useMemo(
    () => Math.max(1, ...hourlySales.map((h) => h.revenue)),
    [hourlySales]
  )

  const pagedWaiters = useMemo(() => {
    const start = (waiterPage - 1) * waiterPageSize
    return waiterPerformance.slice(start, start + waiterPageSize)
  }, [waiterPerformance, waiterPage])

  return (
    <>
      {/* Hourly Intensity + Category Breakdown + Top Revenue Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
              Saatlik Yoğunluk &amp; Ciro Analizi
            </h3>
          </div>
          {hourlySales.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#86868b]">Saatlik satış verisi yok.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {hourlySales.map((h) => {
                const widthPct = Math.round((h.revenue / maxHourlyRev) * 100)
                return (
                  <div key={h.hour} className="flex items-center gap-2 text-[11px]">
                    <span className="w-11 font-mono text-[#86868b]">{h.hour}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#f5f5f7] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#e63462]"
                        style={{ width: `${Math.max(widthPct, h.revenue > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <span className="w-24 text-right font-semibold text-[#1d1d1f] tabular-nums">
                      ₺{formatMoney(h.revenue)} ({h.ordersCount})
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
              Kategori Bazlı Satış Dağılımı
            </h3>
          </div>
          {categoryBreakdown.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#86868b]">Kategori verisi bulunmuyor.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.categoryName}
                  className="flex items-center justify-between rounded-xl bg-[#f9f9fb] px-3 py-2 text-[12px]"
                >
                  <div>
                    <p className="font-semibold text-[#1d1d1f]">{cat.categoryName}</p>
                    <p className="text-[10.5px] text-[#86868b]">{cat.quantity} adet ürün</p>
                  </div>
                  <span className="font-bold text-[#1d1d1f] tabular-nums">
                    ₺{formatMoney(cat.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
              En Çok Ciro Getiren Ürünler
            </h3>
          </div>
          {topProducts.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#86868b]">Ürün satış verisi yok.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {topProducts.slice(0, 7).map((p, idx) => (
                <div
                  key={p.productName}
                  className="flex items-center justify-between rounded-xl bg-[#f9f9fb] px-3 py-2 text-[12px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#e63462]/10 text-[10px] font-bold text-[#e63462]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#1d1d1f]">{p.productName}</p>
                      <p className="text-[10.5px] text-[#86868b]">{p.quantity} adet</p>
                    </div>
                  </div>
                  <span className="font-bold text-[#1d1d1f] tabular-nums">
                    ₺{formatMoney(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Waiter Performance & Cancellation Scorecard Table (Paginated) */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-[#e63462]" />
          <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
            Personel / Garson Performans &amp; İptal Karnesi
          </h3>
        </div>
        {waiterPerformance.length === 0 ? (
          <p className="py-5 text-center text-[12px] text-[#86868b]">
            Henüz personel satış veya iptal kaydı bulunmuyor.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[#e5e5ea] text-[11px] font-semibold text-[#86868b]">
                    <th className="pb-2 pr-3">Personel</th>
                    <th className="pb-2 px-3 text-right">Adisyon Adedi</th>
                    <th className="pb-2 px-3 text-right">Ciro Katkısı</th>
                    <th className="pb-2 px-3 text-right">Ort. Adisyon</th>
                    <th className="pb-2 px-3 text-right">İptal Adedi</th>
                    <th className="pb-2 pl-3 text-right">İptal Tutarı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {pagedWaiters.map((w) => {
                    const aov = w.ordersCount > 0 ? w.revenue / w.ordersCount : 0
                    return (
                      <tr key={w.waiterName} className="hover:bg-[#f9f9fb]">
                        <td className="py-2.5 pr-3 font-semibold text-[#1d1d1f]">{w.waiterName}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{w.ordersCount}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#34c759] tabular-nums">
                          ₺{formatMoney(w.revenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">₺{formatMoney(aov)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-red-600 tabular-nums">
                          {w.cancelledCount}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-semibold text-red-600 tabular-nums">
                          ₺{formatMoney(w.cancelledAmount)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              currentPage={waiterPage}
              totalItems={waiterPerformance.length}
              pageSize={waiterPageSize}
              onPageChange={setWaiterPage}
              itemLabel="personel"
            />
          </>
        )}
      </div>

      {/* Cash Shifts & Detailed X/Z Cash Reconciliation Section */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#e63462]" />
            <div>
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                Kasa Vardiyaları, X/Z Rapor Detayları &amp; Nakit/Gider Hareketleri ({shiftSummaries.length})
              </h3>
              <p className="text-[11px] text-[#86868b]">
                Vardiyaya tıklayarak 5 kanal ödeme dağılımını, kasa gelir/giderlerini ve devreden masaları inceleyin
              </p>
            </div>
          </div>
        </div>
        {shiftSummaries.length === 0 ? (
          <p className="py-5 text-center text-[12px] text-[#86868b]">
            Seçili dönemde aktif veya kapanmış kasa vardiyası kaydı bulunmuyor.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {pagedShifts.map((sh) => {
                const diff = sh.cashDifference ?? 0
                const isExpanded = expandedShiftId === sh.id
                const txs = sh.transactions ?? []
                const carried = sh.carriedOverTablesSnapshot ?? []
                return (
                  <div
                    key={sh.id}
                    className="rounded-2xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5 text-[12px] transition-all"
                  >
                    <div
                      onClick={() => setExpandedShiftId(isExpanded ? null : sh.id)}
                      className="flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-[13px] text-[#1d1d1f]">
                            {sh.branchName ? `${sh.branchName} • ` : ""}Açan: {sh.openedBy}
                          </span>
                          {sh.closedBy && (
                            <span className="text-[11px] text-[#636366]">
                              → Kapatan: {sh.closedBy}
                            </span>
                          )}
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              sh.status === "open"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-zinc-200 text-zinc-700"
                            }`}
                          >
                            {sh.status === "open" ? "Açık Vardiya (X)" : "Kapandı (Z)"}
                          </span>
                          {sh.isAutoClosed && (
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              Otomatik Gün Sonu
                            </span>
                          )}
                          {(sh.closedTablesCount ?? 0) > 0 && (
                            <span className="rounded-md bg-white border border-[#e5e5ea] px-2 py-0.5 text-[10px] font-semibold text-[#636366]">
                              {sh.closedTablesCount} Kapanan Masa
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#86868b]">
                          Açılış: {formatIstanbulDateTime(sh.openedAt)}
                          {sh.closedAt ? ` • Kapanış: ${formatIstanbulDateTime(sh.closedAt)}` : " • Devam Ediyor"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-[#86868b]">Vardiya Cirosu</p>
                          <p className="text-[14px] font-black text-[#e63462] tabular-nums">
                            ₺{formatMoney(sh.totalRevenue ?? 0)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-[#e5e5ea] text-[#636366]"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Top Cash Summary Row */}
                    <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-6 gap-2 border-t border-[#e5e5ea] pt-2.5 text-center">
                      <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]/70">
                        <p className="text-[10px] text-[#86868b]">Açılış Nakit</p>
                        <p className="font-bold text-[#1d1d1f] tabular-nums">₺{formatMoney(sh.openingBalance)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]/70">
                        <p className="text-[10px] text-[#86868b]">+ Nakit Giriş</p>
                        <p className="font-bold text-emerald-600 tabular-nums">+₺{formatMoney(sh.cashIn ?? sh.totalCash ?? 0)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]/70">
                        <p className="text-[10px] text-[#86868b]">- Nakit Çıkış</p>
                        <p className="font-bold text-red-600 tabular-nums">-₺{formatMoney(sh.cashOut ?? 0)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]/70">
                        <p className="text-[10px] text-[#86868b]">Beklenen Kasa</p>
                        <p className="font-bold text-[#1d1d1f] tabular-nums">
                          ₺{formatMoney(sh.expectedCash ?? sh.openingBalance)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]/70">
                        <p className="text-[10px] text-[#86868b]">Sayılan Nakit</p>
                        <p className="font-bold text-[#1d1d1f] tabular-nums">
                          {sh.closingBalance != null ? `₺${formatMoney(sh.closingBalance)}` : "-"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]/70">
                        <p className="text-[10px] text-[#86868b]">Kasa Farkı</p>
                        <p
                          className={`font-bold tabular-nums ${
                            diff < 0 ? "text-red-600" : diff > 0 ? "text-amber-600" : "text-emerald-600"
                          }`}
                        >
                          {diff === 0 ? "Tam (₺0,00)" : `${diff > 0 ? "+" : ""}₺${formatMoney(diff)}`}
                        </p>
                      </div>
                    </div>

                    {/* Expanded X/Z Full Shift Breakdown */}
                    {isExpanded && (
                      <div className="mt-3 space-y-3 border-t border-[#e5e5ea] pt-3">
                        {/* 5-Channel Payment Breakdown + Discount */}
                        <div>
                          <p className="text-[11px] font-bold text-[#1d1d1f] mb-1.5 flex items-center gap-1.5">
                            <Wallet className="h-3.5 w-3.5 text-[#e63462]" />
                            Vardiya Tahsilat &amp; Ödeme Kanalı Kırılımı
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                            <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]">
                              <p className="text-[10px] text-[#86868b]">Nakit Satış</p>
                              <p className="font-bold text-[#1d1d1f]">₺{formatMoney(sh.totalCash ?? 0)}</p>
                            </div>
                            <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]">
                              <p className="text-[10px] text-[#86868b]">Kredi Kartı</p>
                              <p className="font-bold text-[#1d1d1f]">₺{formatMoney(sh.totalCard ?? 0)}</p>
                            </div>
                            <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]">
                              <p className="text-[10px] text-[#86868b]">Yemek Kartı</p>
                              <p className="font-bold text-[#1d1d1f]">₺{formatMoney(sh.totalMealCard ?? 0)}</p>
                            </div>
                            <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]">
                              <p className="text-[10px] text-[#86868b]">Multinet</p>
                              <p className="font-bold text-[#1d1d1f]">₺{formatMoney(sh.totalMultinet ?? 0)}</p>
                            </div>
                            <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]">
                              <p className="text-[10px] text-[#86868b]">Cari (Veresiye)</p>
                              <p className="font-bold text-[#1d1d1f]">₺{formatMoney(sh.totalLedger ?? 0)}</p>
                            </div>
                            <div className="rounded-lg bg-white p-2 border border-[#e5e5ea]">
                              <p className="text-[10px] text-[#86868b]">İskonto Toplamı</p>
                              <p className="font-bold text-amber-600">₺{formatMoney(sh.discountTotal ?? 0)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Shift Cash / Card Expense & Cash-In Transactions */}
                        <div>
                          <p className="text-[11px] font-bold text-[#1d1d1f] mb-1.5 flex items-center gap-1.5">
                            <Receipt className="h-3.5 w-3.5 text-[#e63462]" />
                            Kasa Gelir / Gider &amp; Masraf Hareketleri ({txs.length})
                          </p>
                          {txs.length === 0 ? (
                            <p className="rounded-lg bg-white border border-[#e5e5ea] px-3 py-2 text-[11px] text-[#86868b]">
                              Bu vardiyada manuel kasa giriş/çıkış veya masraf kaydı bulunmuyor.
                            </p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {txs.map((tx) => {
                                const isIn = tx.type === "cash-in" || tx.type === "sale"
                                const isCardExp = tx.paymentMethod === "credit-card"
                                return (
                                  <div
                                    key={tx.id}
                                    className="flex items-center justify-between rounded-lg bg-white border border-[#e5e5ea] px-3 py-1.5 text-[11px]"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-semibold text-[#1d1d1f]">{tx.description}</span>
                                        <span
                                          className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                                            isIn
                                              ? "bg-emerald-50 text-emerald-700"
                                              : isCardExp
                                                ? "bg-sky-50 text-sky-700"
                                                : "bg-red-50 text-red-700"
                                          }`}
                                        >
                                          {isIn
                                            ? "Nakit Giriş"
                                            : isCardExp
                                              ? "Kart Gideri (Kasa Nakdini Etkilemez)"
                                              : "Nakit Çıkış / Masraf"}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-[#86868b]">
                                        {tx.createdBy} • {formatIstanbulDateTime(tx.createdAt)}
                                      </p>
                                    </div>
                                    <span
                                      className={`font-bold tabular-nums ${
                                        isIn ? "text-emerald-600" : "text-red-600"
                                      }`}
                                    >
                                      {isIn ? "+" : "-"}₺{formatMoney(tx.amount)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Carried-over open tables snapshot */}
                        {((sh.carriedOverTablesCount ?? 0) > 0 || carried.length > 0) && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5">
                            <p className="text-[11px] font-bold text-amber-900">
                              Yeni Vardiyaya Devreden Açık Masalar: {sh.carriedOverTablesCount || carried.length} Masa (Toplam ₺{formatMoney(sh.carriedOverTablesAmount ?? 0)})
                            </p>
                            {carried.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {carried.map((ct) => (
                                  <span
                                    key={ct.tableId}
                                    className="rounded-md bg-white border border-amber-200 px-2 py-0.5 text-[10.5px] font-semibold text-amber-950"
                                  >
                                    {ct.tableName} ({ct.section}): ₺{formatMoney(ct.openAmount)} ({ct.itemCount} ürün)
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {sh.notes && (
                          <p className="rounded-lg bg-white border border-[#e5e5ea] px-3 py-2 text-[11px] text-[#636366]">
                            <strong className="text-[#1d1d1f]">Vardiya Notu:</strong> {sh.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <PaginationBar
              currentPage={shiftPage}
              totalItems={shiftSummaries.length}
              pageSize={shiftPageSize}
              onPageChange={setShiftPage}
              itemLabel="vardiya"
            />
          </>
        )}
      </div>
    </>
  )
}
