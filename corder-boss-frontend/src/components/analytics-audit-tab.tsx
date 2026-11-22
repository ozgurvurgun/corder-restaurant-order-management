import { useEffect, useMemo, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import { bossApi } from "@/lib/api"
import type { AuditCategory, AuditLogDto } from "@/lib/types"
import { formatIstanbulDateTime, formatMoney } from "@/lib/format"
import { AUDIT_CATEGORY_LABELS } from "@/lib/permission-labels"
import { PaginationBar } from "./ui/pagination-bar"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  BarChart3,
  Award,
  Users,
  ShieldAlert,
  Clock,
  Building2,
} from "lucide-react"

const AUDIT_CATEGORIES: Array<AuditCategory | "ALL"> = [
  "ALL",
  "order",
  "table",
  "payment",
  "cash-register",
  "shift",
  "stock",
  "product",
  "user",
  "settings",
  "auth",
]

export function AnalyticsAuditTab() {
  const {
    overview,
    selectedBranchId,
    effectiveBranchId,
    effectiveBranch,
    dateFilterBounds,
  } = useBossStore()

  const [auditCategory, setAuditCategory] = useState<AuditCategory | "ALL">("ALL")
  const [branchAudits, setBranchAudits] = useState<AuditLogDto[] | null>(null)
  const [loadingAudits, setLoadingAudits] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const auditPageSize = 10

  useEffect(() => {
    setAuditPage(1)
  }, [auditCategory, selectedBranchId, effectiveBranchId, dateFilterBounds.from, dateFilterBounds.to])

  useEffect(() => {
    if (!effectiveBranchId || selectedBranchId === "ALL") {
      setBranchAudits(null)
      return
    }
    let cancelled = false
    setLoadingAudits(true)
    bossApi.auditLogs
      .list(effectiveBranchId, {
        category: auditCategory === "ALL" ? undefined : auditCategory,
        limit: 120,
        from: dateFilterBounds.from,
        to: dateFilterBounds.to,
      })
      .then((res) => {
        if (!cancelled) setBranchAudits(res)
      })
      .catch(() => {
        if (!cancelled) setBranchAudits(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingAudits(false)
      })
    return () => {
      cancelled = true
    }
  }, [effectiveBranchId, selectedBranchId, auditCategory, dateFilterBounds.from, dateFilterBounds.to])

  const hourly = overview?.hourlySales ?? []
  const topProducts = overview?.topProducts ?? []
  const staffPerf = overview?.waiterPerformance ?? []
  const shiftSummaries = overview?.shiftSummaries ?? []

  const audits = useMemo(() => {
    if (selectedBranchId !== "ALL" && branchAudits) {
      return branchAudits.map((a) => ({
        ...a,
        branchName: a.branchName || effectiveBranch?.name || "",
      }))
    }
    const base = overview?.recentAudits ?? []
    if (auditCategory === "ALL") return base
    return base.filter(
      (a) =>
        a.category === auditCategory ||
        (auditCategory === "cash-register" && a.category === "register"),
    )
  }, [selectedBranchId, branchAudits, effectiveBranch?.name, overview?.recentAudits, auditCategory])

  const pagedAudits = useMemo(() => {
    const start = (auditPage - 1) * auditPageSize
    return audits.slice(start, start + auditPageSize)
  }, [audits, auditPage])

  return (
    <div className="space-y-4">
      {/* Hourly Sales Chart */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-[#e63462]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              Saatlik Satış Yoğunluğu ({dateFilterBounds.label})
            </h3>
            <p className="text-[11px] text-[#86868b]">
              Seçili dönemdeki kapanan adisyonların saat dilimlerine göre ciro dağılımı (Türkiye Saati)
            </p>
          </div>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: "#86868b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#86868b" }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip
                formatter={(value: number) => [`₺${formatMoney(value)}`, "Ciro"]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e5ea",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="revenue" fill="#e63462" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products & Staff Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              En Çok Satan Ürünler (Bu Ay)
            </h3>
          </div>
          {topProducts.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#86868b]">
              Henüz satış verisi bulunmuyor.
            </p>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, idx) => {
                const label = p.productName || `Ürün #${idx + 1}`
                return (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl bg-[#f9f9fb] px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#e63462]/10 text-[11px] font-bold text-[#e63462]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#1d1d1f]">
                          {label}
                        </p>
                        <p className="text-[11px] text-[#86868b]">{p.quantity} adet satıldı</p>
                      </div>
                    </div>
                    <span className="text-[13px] font-bold text-[#1d1d1f] tabular-nums">
                      ₺{formatMoney(p.revenue)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Staff Performance */}
        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              Personel Satış &amp; İskonto Karnesi
            </h3>
          </div>
          {staffPerf.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#86868b]">
              Henüz personel performans verisi yok.
            </p>
          ) : (
            <div className="space-y-2.5">
              {staffPerf.map((s) => (
                <div
                  key={s.waiterName}
                  className="flex items-center justify-between rounded-xl bg-[#f9f9fb] px-3 py-2"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">
                      {s.waiterName}
                    </p>
                    <p className="text-[11px] text-[#86868b]">
                      {s.ordersCount} adisyon • İskonto: ₺{formatMoney(s.discountGiven ?? 0)}
                    </p>
                  </div>
                  <span className="text-[13px] font-bold text-[#34c759] tabular-nums">
                    ₺{formatMoney(s.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cash Shifts Summary on Reports & Audit Tab */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#e63462]" />
            <div>
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                Kasa Vardiyaları &amp; Z Raporu Özeti ({shiftSummaries.length})
              </h3>
              <p className="text-[11px] text-[#86868b]">
                Seçili dönemdeki ({dateFilterBounds.label}) açık ve kapanmış kasa vardiyaları
              </p>
            </div>
          </div>
        </div>
        {shiftSummaries.length === 0 ? (
          <p className="py-5 text-center text-[12px] text-[#86868b]">
            Seçili tarih aralığında kasa vardiyası kaydı bulunmuyor.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {shiftSummaries.slice(0, 12).map((sh) => {
              const diff = sh.cashDifference ?? sh.difference ?? 0
              return (
                <div
                  key={sh.id}
                  className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3 text-[12px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#1d1d1f] truncate">
                      {sh.branchName ? `${sh.branchName} • ` : ""}Açan: {sh.openedBy}
                    </span>
                    <span className="font-black text-[#e63462] tabular-nums">
                      Ciro: ₺{formatMoney(sh.totalRevenue ?? 0)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-[#86868b]">
                    {formatIstanbulDateTime(sh.openedAt)}
                    {sh.closedAt ? ` → ${formatIstanbulDateTime(sh.closedAt)}` : " • Açık Vardiya"}
                    {sh.isAutoClosed ? " (Otomatik Gün Sonu)" : ""}
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-1.5 border-t border-[#e5e5ea] pt-2 text-center text-[10.5px]">
                    <div>
                      <span className="text-[#86868b] block">Açılış</span>
                      <strong className="text-[#1d1d1f]">₺{formatMoney(sh.openingBalance)}</strong>
                    </div>
                    <div>
                      <span className="text-[#86868b] block">Beklenen</span>
                      <strong className="text-[#1d1d1f]">₺{formatMoney(sh.expectedCash ?? sh.openingBalance)}</strong>
                    </div>
                    <div>
                      <span className="text-[#86868b] block">Sayılan</span>
                      <strong className="text-[#1d1d1f]">
                        {sh.closingBalance != null ? `₺${formatMoney(sh.closingBalance)}` : "-"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#86868b] block">Fark</span>
                      <strong className={diff < 0 ? "text-red-600" : diff > 0 ? "text-amber-600" : "text-emerald-600"}>
                        ₺{formatMoney(diff)}
                      </strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Audit & Critical Operation Logs */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#e63462]" />
            <div>
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                Denetim &amp; Kritik İşlem Kayıtları (Audit Log)
              </h3>
              <p className="text-[11px] text-[#86868b]">
                Masa taşıma, ürün iptali, iskonto ve fiyat değişimi hareketleri
              </p>
            </div>
          </div>
          {loadingAudits && (
            <span className="text-[11px] font-medium text-[#86868b]">
              Yükleniyor…
            </span>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {AUDIT_CATEGORIES.map((cat) => {
            const active = auditCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setAuditCategory(cat)}
                className={`flex-shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-[#e63462] text-white"
                    : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                {AUDIT_CATEGORY_LABELS[cat] ?? cat}
              </button>
            )
          })}
        </div>

        {audits.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[#86868b]">
            Bu kategoride kayıtlı denetim hareketi bulunmuyor.
          </p>
        ) : (
          <>
            <div className="divide-y divide-[#f0f0f0]">
              {pagedAudits.map((a) => (
                <div key={a.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] font-bold text-[#1d1d1f]">
                        {a.action}
                      </span>
                      <span className="rounded bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-medium text-[#86868b]">
                        {a.userName}
                      </span>
                      {a.category && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                          {AUDIT_CATEGORY_LABELS[a.category as AuditCategory] ?? a.category}
                        </span>
                      )}
                      {a.branchName && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-[#fef3f5] px-1.5 py-0.5 text-[10px] font-medium text-[#e63462]">
                          <Building2 className="h-2.5 w-2.5" /> {a.branchName}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#86868b]">{a.details}</p>
                  </div>
                  <span className="flex items-center gap-1 flex-shrink-0 text-[10px] text-[#86868b] tabular-nums">
                    <Clock className="h-3 w-3" />
                    {formatIstanbulDateTime(a.createdAt)}
                  </span>
                </div>
              ))}
            </div>
            <PaginationBar
              currentPage={auditPage}
              totalItems={audits.length}
              pageSize={auditPageSize}
              onPageChange={setAuditPage}
              itemLabel="denetim kaydı"
            />
          </>
        )}
      </div>
    </div>
  )
}
