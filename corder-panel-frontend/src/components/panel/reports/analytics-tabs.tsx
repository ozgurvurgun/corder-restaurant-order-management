import { useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { itemCountsTowardBill, type CancelledItem, type ClosedTable, type DailyReport, type HourlyDensity, type PeriodReport, type ProductTrend } from "@/lib/panel-types"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }

const HEATMAP_COLORS = ["#f5f5f7", "#fce4ec", "#f8bbd0", "#f06292", "#e63462", "#c62828"]
function getHeatColor(value: number, max: number) {
  if (max === 0) return HEATMAP_COLORS[0]
  return HEATMAP_COLORS[Math.min(5, Math.floor((value / max) * 5))]
}

const DAYS = [
  { key: "monday" as const, label: "Pzt" },
  { key: "tuesday" as const, label: "Sal" },
  { key: "wednesday" as const, label: "Car" },
  { key: "thursday" as const, label: "Per" },
  { key: "friday" as const, label: "Cum" },
  { key: "saturday" as const, label: "Cmt" },
  { key: "sunday" as const, label: "Paz" },
]

export function useReportAnalyticsData(closedTables: ClosedTable[], cancelledItems: CancelledItem[]) {
  const allPeriodReports = useMemo(() => {
    const map = new Map<string, PeriodReport>()
    const formatKey = (d: Date, mode: "weekly" | "monthly" | "yearly") => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      if (mode === "yearly") return `${year}`
      if (mode === "monthly") return `${year}-${month}`
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      const dayNum = tmp.getUTCDay() || 7
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
      const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      return `${year}-W${String(week).padStart(2, "0")}`
    }

    const ensureBucket = (key: string) => {
      if (!map.has(key)) {
        let label = key
        if (key.includes("-W")) { const [y, w] = key.split("-W"); label = `${w}. Hafta ${y}` }
        else if (key.length === 7) { const [y, m] = key.split("-"); label = `${m}/${y}` }
        map.set(key, { period: key, periodLabel: label, totalRevenue: 0, totalOrders: 0, totalTables: 0, cancelledAmount: 0, discountAmount: 0, avgOrderValue: 0 })
      }
      return map.get(key)!
    }

    closedTables.forEach((ct) => {
      const d = new Date(ct.closedAt)
      ;(["weekly", "monthly", "yearly"] as const).forEach((mode) => {
        const bucket = ensureBucket(`${mode}:${formatKey(d, mode)}`)
        bucket.totalRevenue += ct.netAmount || 0
        bucket.totalOrders += ct.orders?.length || 0
        bucket.totalTables += 1
        bucket.discountAmount += ct.discountAmount || 0
      })
    })

    cancelledItems.forEach((ci) => {
      const d = new Date(ci.cancelledAt)
      const amount = ci.orderItem.price * ci.orderItem.quantity
      ;(["weekly", "monthly", "yearly"] as const).forEach((mode) => {
        ensureBucket(`${mode}:${formatKey(d, mode)}`).cancelledAmount += amount
      })
    })

    const buildForMode = (mode: "weekly" | "monthly" | "yearly") => {
      const prefix = `${mode}:`
      const entries = Array.from(map.values()).filter((r) => r.period.startsWith(prefix)).map((r) => ({ ...r, period: r.period.slice(prefix.length) })).sort((a, b) => a.period.localeCompare(b.period))
      for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1]
        entries[i].comparisonRevenue = prev.totalRevenue
        if (prev.totalRevenue > 0) entries[i].comparisonChange = Math.round(((entries[i].totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 100)
      }
      entries.forEach((e) => { e.avgOrderValue = e.totalOrders > 0 ? e.totalRevenue / e.totalOrders : 0 })
      return entries
    }

    return { weekly: buildForMode("weekly"), monthly: buildForMode("monthly"), yearly: buildForMode("yearly") }
  }, [closedTables, cancelledItems])

  const productTrends: ProductTrend[] = useMemo(() => {
    const productMap = new Map<string, Map<string, { period: string; quantity: number; revenue: number }>>()
    closedTables.forEach((ct) => {
      const d = new Date(ct.closedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      ct.orders?.forEach((o) => {
        o.items.filter(itemCountsTowardBill).forEach((i) => {
          if (!productMap.has(i.productName)) productMap.set(i.productName, new Map())
          const bucketMap = productMap.get(i.productName)!
          if (!bucketMap.has(key)) bucketMap.set(key, { period: key, quantity: 0, revenue: 0 })
          const bucket = bucketMap.get(key)!
          bucket.quantity += i.quantity
          bucket.revenue += i.price * i.quantity
        })
      })
    })
    return Array.from(productMap.entries()).map(([productName, bucketMap]) => ({
      productName, data: Array.from(bucketMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
    }))
  }, [closedTables])

  const hourlyDensity: HourlyDensity[] = useMemo(() => {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const
    const rows: HourlyDensity[] = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0, average: 0,
    }))
    closedTables.forEach((ct) => {
      const d = new Date(ct.closedAt)
      const hour = `${String(d.getHours()).padStart(2, "0")}:00`
      const dayKey = days[(d.getDay() + 6) % 7]
      const row = rows.find((r) => r.hour === hour)
      if (row) row[dayKey] += ct.orders?.length || 0
    })
    rows.forEach((row) => { row.average = Math.round(days.reduce((s, d) => s + (row[d] || 0), 0) / days.length) })
    return rows
  }, [closedTables])

  return { allPeriodReports, productTrends, hourlyDensity }
}

export function PeriodComparisonTab(props: { allPeriodReports: { weekly: PeriodReport[]; monthly: PeriodReport[]; yearly: PeriodReport[] } }) {
  const { allPeriodReports } = props
  const [selectedPeriodType, setSelectedPeriodType] = useState<"weekly" | "monthly" | "yearly">("weekly")
  const filteredPeriodReports = selectedPeriodType === "weekly" ? allPeriodReports.weekly : selectedPeriodType === "monthly" ? allPeriodReports.monthly : allPeriodReports.yearly

  return (
    <>
      <div className="flex items-center gap-2">
        {(["weekly", "monthly", "yearly"] as const).map((type) => (
          <button key={type} onClick={() => setSelectedPeriodType(type)} className={`h-[30px] px-3.5 rounded-lg text-[12px] font-medium transition-colors ${selectedPeriodType === type ? "bg-[#e63462] text-white" : "bg-white border border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"}`}>
            {type === "weekly" ? "Haftalik" : type === "monthly" ? "Aylik" : "Yillik"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Ciro Karsilastirmasi</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={filteredPeriodReports}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="periodLabel" tick={{ fontSize: 10, fill: "#86868b" }} />
            <YAxis tick={{ fontSize: 10, fill: "#86868b" }} />
            <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
            <Bar dataKey="totalRevenue" fill="#e63462" radius={[4, 4, 0, 0]} barSize={28} name="Ciro" />
            <Bar dataKey="comparisonRevenue" fill="#d1d1d6" radius={[4, 4, 0, 0]} barSize={28} name="Onceki Donem" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Donem</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Ciro</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Siparis</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Ort. Adisyon</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Iptal</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Degisim</th>
            </tr>
          </thead>
          <tbody>
            {filteredPeriodReports.map((r, idx) => (
              <tr key={r.period} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{r.periodLabel}</td>
                <td className="px-4 py-2.5 text-[13px] text-right font-semibold text-[#e63462]">{"\u20BA"}{formatCurrency(r.totalRevenue)}</td>
                <td className="px-4 py-2.5 text-[13px] text-right text-[#86868b]">{r.totalOrders}</td>
                <td className="px-4 py-2.5 text-[13px] text-right text-[#1d1d1f]">{"\u20BA"}{formatCurrency(r.avgOrderValue)}</td>
                <td className="px-4 py-2.5 text-[13px] text-right text-red-500">{"\u20BA"}{formatCurrency(r.cancelledAmount)}</td>
                <td className="px-4 py-2.5 text-center">
                  {r.comparisonChange != null && (
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.comparisonChange > 0 ? "bg-green-50 text-green-600" : r.comparisonChange < 0 ? "bg-red-50 text-red-500" : "bg-[#f5f5f7] text-[#86868b]"}`}>
                      {r.comparisonChange > 0 ? <ArrowUpRight className="w-3 h-3" /> : r.comparisonChange < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {r.comparisonChange > 0 ? "+" : ""}{r.comparisonChange}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function ProductTrendsTab(props: { productTrends: ProductTrend[] }) {
  const { productTrends } = props
  const [selectedTrendProduct, setSelectedTrendProduct] = useState("")
  const selectedTrend = useMemo(
    () => (!selectedTrendProduct ? productTrends[0] : productTrends.find((t) => t.productName === selectedTrendProduct) || productTrends[0]),
    [productTrends, selectedTrendProduct],
  )

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        {productTrends.map((t) => (
          <button key={t.productName} onClick={() => setSelectedTrendProduct(t.productName)} className={`h-[30px] px-3.5 rounded-lg text-[12px] font-medium transition-colors ${selectedTrend?.productName === t.productName ? "bg-[#e63462] text-white" : "bg-white border border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"}`}>
            {t.productName}
          </button>
        ))}
      </div>

      {selectedTrend && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
            <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">{selectedTrend.productName} - Satis Adedi</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={selectedTrend.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#86868b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#86868b" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                <Line type="monotone" dataKey="quantity" stroke="#007aff" strokeWidth={2} dot={{ fill: "#007aff", r: 3 }} name="Adet" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
            <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">{selectedTrend.productName} - Ciro</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={selectedTrend.data}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34c759" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#34c759" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#86868b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#86868b" }} />
                <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                <Area type="monotone" dataKey="revenue" stroke="#34c759" strokeWidth={2} fill="url(#trendGrad)" name="Ciro" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  )
}

export function HourlyDensityTab(props: { hourlyDensity: HourlyDensity[] }) {
  const { hourlyDensity } = props
  const densityMax = useMemo(() => {
    let max = 0
    hourlyDensity.forEach((h) => [h.monday, h.tuesday, h.wednesday, h.thursday, h.friday, h.saturday, h.sunday].forEach((v) => { if (v > max) max = v }))
    return max
  }, [hourlyDensity])

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
      <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-4">Haftalik Yogunluk Haritasi (Siparis Sayisi)</h3>
      <div className="overflow-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 text-[11px] font-semibold text-[#86868b] uppercase w-[60px]">Saat</th>
              {DAYS.map((d) => <th key={d.key} className="text-center px-1 py-2 text-[11px] font-semibold text-[#86868b] uppercase">{d.label}</th>)}
              <th className="text-center px-2 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Ort.</th>
            </tr>
          </thead>
          <tbody>
            {hourlyDensity.map((row) => (
              <tr key={row.hour}>
                <td className="px-2 py-1 text-[12px] font-medium text-[#1d1d1f]">{row.hour}</td>
                {DAYS.map((d) => {
                  const val = row[d.key]
                  return (
                    <td key={d.key} className="px-1 py-1 text-center">
                      <div className="w-full h-[32px] rounded-md flex items-center justify-center text-[11px] font-semibold transition-colors" style={{ backgroundColor: getHeatColor(val, densityMax), color: val > densityMax * 0.5 ? "#fff" : "#1d1d1f" }}>
                        {val || ""}
                      </div>
                    </td>
                  )
                })}
                <td className="px-2 py-1 text-center text-[12px] font-semibold text-[#e63462]">{row.average}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-4 justify-end">
        <span className="text-[10px] text-[#86868b]">Az</span>
        {HEATMAP_COLORS.map((color, i) => <div key={i} className="w-5 h-3 rounded-sm" style={{ backgroundColor: color }} />)}
        <span className="text-[10px] text-[#86868b]">Cok</span>
      </div>
    </div>
  )
}

export function WaitersTab(props: { dailyReport: DailyReport }) {
  const { dailyReport } = props
  const waiterMetrics = useMemo(() => dailyReport.waiterPerformance.map((w) => ({ ...w, avgOrderValue: w.orders > 0 ? Math.round(w.revenue / w.orders) : 0 })), [dailyReport])

  return (
    <>
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f] px-4 pt-4 pb-2">Garson Performansi</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f0f0f0] bg-[#f9f9f9]">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Garson</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Masa</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Siparis</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Ciro</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Ort. Adisyon</th>
            </tr>
          </thead>
          <tbody>
            {waiterMetrics.map((w, idx) => (
              <tr key={w.name} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                <td className="px-4 py-3 text-[13px] font-medium text-[#1d1d1f] capitalize">{w.name}</td>
                <td className="px-4 py-3 text-[13px] text-right text-[#86868b]">{w.tables}</td>
                <td className="px-4 py-3 text-[13px] text-right text-[#86868b]">{w.orders}</td>
                <td className="px-4 py-3 text-[13px] text-right font-semibold text-[#e63462]">{"\u20BA"}{formatCurrency(w.revenue)}</td>
                <td className="px-4 py-3 text-[13px] text-right text-[#1d1d1f] font-medium">{"\u20BA"}{formatCurrency(w.avgOrderValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Garson Bazli Ciro</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={waiterMetrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#1d1d1f" }} />
            <YAxis tick={{ fontSize: 10, fill: "#86868b" }} />
            <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
            <Bar dataKey="revenue" fill="#e63462" radius={[4, 4, 0, 0]} barSize={36} name="Ciro" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
