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
  Clock,
  Layers,
  Users,
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

      {/* Cash Shifts & Cash Reconciliation Summary */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-[#e63462]" />
          <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
            Kasa Vardiyaları &amp; Nakit Mutabakat Özeti
          </h3>
        </div>
        {shiftSummaries.length === 0 ? (
          <p className="py-5 text-center text-[12px] text-[#86868b]">
            Aktif veya kapanmış kasa vardiyası kaydı bulunmuyor.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shiftSummaries.map((sh) => {
              const diff = sh.difference ?? 0
              return (
                <div key={sh.id} className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1d1d1f]">
                      {sh.branchName ? `${sh.branchName} • ` : ""}Açan: {sh.openedBy}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        sh.status === "open" ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {sh.status === "open" ? "Açık Vardiya" : "Kapandı"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-[#86868b]">
                    Açılış: {formatIstanbulDateTime(sh.openedAt)}
                    {sh.closedAt ? ` • Kapanış: ${formatIstanbulDateTime(sh.closedAt)}` : ""}
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-2 border-t border-[#e5e5ea] pt-2 text-center">
                    <div>
                      <p className="text-[10px] text-[#86868b]">Açılış Nakit</p>
                      <p className="font-semibold text-[#1d1d1f] tabular-nums">₺{formatMoney(sh.openingBalance)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#86868b]">Beklenen</p>
                      <p className="font-semibold text-[#1d1d1f] tabular-nums">
                        ₺{formatMoney(sh.expectedCash ?? sh.openingBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#86868b]">Sayılan</p>
                      <p className="font-semibold text-[#1d1d1f] tabular-nums">
                        {sh.closingBalance != null ? `₺${formatMoney(sh.closingBalance)}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#86868b]">Kasa Farkı</p>
                      <p
                        className={`font-bold tabular-nums ${
                          diff < 0 ? "text-red-600" : diff > 0 ? "text-amber-600" : "text-green-600"
                        }`}
                      >
                        ₺{formatMoney(diff)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
