import { useEffect, useMemo, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import { bossApi } from "@/lib/api"
import type { AuditCategory, AuditLogDto } from "@/lib/types"
import { formatIstanbulDateTime, formatMoney } from "@/lib/format"
import { AUDIT_CATEGORY_LABELS } from "@/lib/permission-labels"
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
  "cash",
  "stock",
  "product",
  "staff",
  "system",
]

export function AnalyticsAuditTab() {
  const {
    overview,
    selectedBranchId,
    effectiveBranchId,
    effectiveBranch,
  } = useBossStore()

  const [auditCategory, setAuditCategory] = useState<AuditCategory | "ALL">("ALL")
  const [branchAudits, setBranchAudits] = useState<AuditLogDto[] | null>(null)
  const [loadingAudits, setLoadingAudits] = useState(false)

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
        limit: 60,
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
  }, [effectiveBranchId, selectedBranchId, auditCategory])

  const hourly = overview?.hourlySales ?? []
  const topProducts = overview?.topProducts ?? []
  const staffPerf = overview?.staffPerformance ?? []

  const audits = useMemo(() => {
    if (selectedBranchId !== "ALL" && branchAudits) {
      return branchAudits.map((a) => ({
        ...a,
        branchName: a.branchName || effectiveBranch?.name || "",
      }))
    }
    const base = overview?.recentAudits ?? []
    if (auditCategory === "ALL") return base
    return base.filter((a) => a.category === auditCategory)
  }, [selectedBranchId, branchAudits, effectiveBranch?.name, overview?.recentAudits, auditCategory])

  return (
    <div className="space-y-4">
      {/* Hourly Sales Chart */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-[#e63462]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              Saatlik Satış Yoğunluğu (Bugün)
            </h3>
            <p className="text-[11px] text-[#86868b]">
              Saat dilimlerine göre kapanan adisyon ciro dağılımı (Türkiye Saati)
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
              {topProducts.map((p, idx) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-xl bg-[#f9f9fb] px-3 py-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#e63462]/10 text-[11px] font-bold text-[#e63462]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#1d1d1f]">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-[#86868b]">{p.quantity} adet satıldı</p>
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-[#1d1d1f] tabular-nums">
                    ₺{formatMoney(p.revenue)}
                  </span>
                </div>
              ))}
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
                  key={s.name}
                  className="flex items-center justify-between rounded-xl bg-[#f9f9fb] px-3 py-2"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">
                      {s.name}
                    </p>
                    <p className="text-[11px] text-[#86868b]">
                      {s.ordersCount} adisyon • İskonto: ₺{formatMoney(s.discountGiven)}
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
          <div className="divide-y divide-[#f0f0f0]">
            {audits.map((a) => (
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
        )}
      </div>
    </div>
  )
}
