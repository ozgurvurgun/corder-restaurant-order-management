import { useState, useMemo } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { itemCountsTowardBill, itemIsLedgerLike } from "@/lib/panel-types"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import {
  TrendingUp, ShoppingCart, Ban, Percent, Clock, Receipt, ChevronDown, ChevronUp,
  Calendar, Download, Filter, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }
function formatFullDate(d: Date) { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) }

const PIE_COLORS = ["#e63462", "#34c759", "#007aff", "#ff9500", "#af52de"]
const HEATMAP_COLORS = ["#f5f5f7", "#fce4ec", "#f8bbd0", "#f06292", "#e63462", "#c62828"]

function getHeatColor(value: number, max: number) {
  if (max === 0) return HEATMAP_COLORS[0]
  const idx = Math.min(5, Math.floor((value / max) * 5))
  return HEATMAP_COLORS[idx]
}

type ReportTab = "daily" | "period" | "trends" | "density" | "waiters" | "history"

export default function ReportsView() {
  const {
    dailyReport,
    closedTables,
    cancelledItems,
    ledgerCustomers,
  } = usePanelStore()

  const [activeTab, setActiveTab] = useState<ReportTab>("daily")
  const [showClosedDetail, setShowClosedDetail] = useState(false)
  const [showCancelledDetail, setShowCancelledDetail] = useState(false)
  const [selectedPeriodType, setSelectedPeriodType] = useState<"weekly" | "monthly" | "yearly">("weekly")
  const [selectedTrendProduct, setSelectedTrendProduct] = useState<string>("")
  const [filterDate, setFilterDate] = useState("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  // Filter closed tables by date
  const filteredClosedTables = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30)

    let list = [...closedTables]

    if (filterDate === "today") {
      list = list.filter(ct => new Date(ct.closedAt) >= today)
    } else if (filterDate === "yesterday") {
      list = list.filter(ct => {
        const d = new Date(ct.closedAt)
        return d >= yesterday && d < today
      })
    } else if (filterDate === "week") {
      list = list.filter(ct => new Date(ct.closedAt) >= weekAgo)
    } else if (filterDate === "month") {
      list = list.filter(ct => new Date(ct.closedAt) >= monthAgo)
    } else if (filterDate === "custom" && customStartDate) {
      const start = new Date(customStartDate)
      const end = customEndDate ? new Date(customEndDate) : new Date()
      list = list.filter(ct => {
        const d = new Date(ct.closedAt)
        return d >= start && d <= end
      })
    }

    return list.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  }, [closedTables, filterDate, customStartDate, customEndDate])

  // Compute daily report from filtered data
  const computedDailyReport = useMemo(() => {
    const totalRevenue = filteredClosedTables.reduce((s, ct) => s + ct.netAmount, 0)
    const totalOrders = filteredClosedTables.reduce((s, ct) => s + ct.orders.length, 0)
    const cancelledAmount = filteredClosedTables.reduce((s, ct) => {
      return s + ct.orders.reduce((sum, o) => {
        return sum + o.items.filter((i) => i.status === "cancelled" && !itemIsLedgerLike(i)).reduce((x, item) => x + item.price * item.quantity, 0)
      }, 0)
    }, 0)
    const discountAmount = filteredClosedTables.reduce((s, ct) => s + ct.discountAmount, 0)

    return {
      totalRevenue,
      totalOrders,
      totalTables: filteredClosedTables.length,
      cancelledAmount,
      discountAmount,
    }
  }, [filteredClosedTables])

  const TABS = [
    { id: "daily" as const, label: "Gunluk Rapor" },
    { id: "period" as const, label: "Donem Karsilastirma" },
    { id: "trends" as const, label: "Urun Trendleri" },
    { id: "density" as const, label: "Yogunluk Analizi" },
    { id: "waiters" as const, label: "Garson Performansi" },
    { id: "history" as const, label: "Gecmis Kayitlar" },
  ]

  // All-time closed tables (already backend-fed via completed orders) are
  // transformed on the client into advanced report structures so that every tab
  // works with real historical data.

  type PeriodBucket = {
    period: string
    periodLabel: string
    totalRevenue: number
    totalOrders: number
    totalTables: number
    cancelledAmount: number
    discountAmount: number
    avgOrderValue: number
    comparisonRevenue?: number
    comparisonChange?: number
  }

  const allPeriodReports = useMemo(() => {
    const map = new Map<string, PeriodBucket>()

    const formatKey = (d: Date, mode: "weekly" | "monthly" | "yearly") => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      if (mode === "yearly") return `${year}`
      if (mode === "monthly") return `${year}-${month}`
      // weekly: ISO week number
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      const dayNum = tmp.getUTCDay() || 7
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
      const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      const weekStr = String(week).padStart(2, "0")
      return `${year}-W${weekStr}`
    }

    const ensureBucket = (key: string) => {
      if (!map.has(key)) {
        let label = key
        if (key.includes("-W")) {
          const [y, w] = key.split("-W")
          label = `${w}. Hafta ${y}`
        } else if (key.length === 7) {
          const [y, m] = key.split("-")
          label = `${m}/${y}`
        }
        map.set(key, {
          period: key,
          periodLabel: label,
          totalRevenue: 0,
          totalOrders: 0,
          totalTables: 0,
          cancelledAmount: 0,
          discountAmount: 0,
          avgOrderValue: 0,
        })
      }
      return map.get(key)!
    }

    closedTables.forEach((ct) => {
      const d = new Date(ct.closedAt)
      ;(["weekly", "monthly", "yearly"] as const).forEach((mode) => {
        const key = formatKey(d, mode)
        const bucket = ensureBucket(`${mode}:${key}`)
        bucket.totalRevenue += ct.netAmount || 0
        bucket.totalOrders += ct.orders?.length || 0
        bucket.totalTables += 1
        bucket.discountAmount += ct.discountAmount || 0
      })
    })

    // Cancelled totals per period (by item cancelledAt)
    cancelledItems.forEach((ci) => {
      const d = new Date(ci.cancelledAt)
      const amount = ci.orderItem.price * ci.orderItem.quantity
      ;(["weekly", "monthly", "yearly"] as const).forEach((mode) => {
        const key = formatKey(d, mode)
        const bucket = ensureBucket(`${mode}:${key}`)
        bucket.cancelledAmount += amount
      })
    })

    const buildForMode = (mode: "weekly" | "monthly" | "yearly") => {
      const prefix = `${mode}:`
      const entries = Array.from(map.values())
        .filter((r) => r.period.startsWith(prefix))
        .map((r) => ({
          ...r,
          period: r.period.slice(prefix.length),
        }))
        .sort((a, b) => a.period.localeCompare(b.period))

      // Comparison vs previous period
      for (let i = 0; i < entries.length; i++) {
        const prev = entries[i - 1]
        if (!prev) continue
        entries[i].comparisonRevenue = prev.totalRevenue
        if (prev.totalRevenue > 0) {
          const diff = ((entries[i].totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 100
          entries[i].comparisonChange = Math.round(diff)
        } else {
          entries[i].comparisonChange = undefined
        }
      }
      // derive avg order value per bucket
      entries.forEach((e) => {
        e.avgOrderValue = e.totalOrders > 0 ? e.totalRevenue / e.totalOrders : 0
      })
      return entries
    }

    return {
      weekly: buildForMode("weekly"),
      monthly: buildForMode("monthly"),
      yearly: buildForMode("yearly"),
    }
  }, [closedTables, cancelledItems])

  const filteredPeriodReports = useMemo(() => {
    if (selectedPeriodType === "weekly") return allPeriodReports.weekly
    if (selectedPeriodType === "monthly") return allPeriodReports.monthly
    return allPeriodReports.yearly
  }, [allPeriodReports, selectedPeriodType])

  const productTrends = useMemo(() => {
    const productMap = new Map<string, Map<string, { period: string; quantity: number; revenue: number }>>()

    closedTables.forEach((ct) => {
      const d = new Date(ct.closedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      ct.orders?.forEach((o) => {
        o.items
          .filter(itemCountsTowardBill)
          .forEach((i) => {
            if (!productMap.has(i.productName)) {
              productMap.set(i.productName, new Map())
            }
            const bucketMap = productMap.get(i.productName)!
            if (!bucketMap.has(key)) {
              bucketMap.set(key, { period: key, quantity: 0, revenue: 0 })
            }
            const bucket = bucketMap.get(key)!
            bucket.quantity += i.quantity
            bucket.revenue += i.price * i.quantity
          })
      })
    })

    return Array.from(productMap.entries()).map(([productName, bucketMap]) => ({
      productName,
      data: Array.from(bucketMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
    }))
  }, [closedTables])

  // Default selected trend product when trends available
  const selectedTrend = useMemo(() => {
    if (!selectedTrendProduct && productTrends.length > 0) {
      return productTrends[0]
    }
    return productTrends.find((t) => t.productName === selectedTrendProduct) || productTrends[0]
  }, [productTrends, selectedTrendProduct])

  const hourlyDensity = useMemo(() => {
    const templateHours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`)
    const days: Array<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"> = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]
    const rows = templateHours.map((hour) => {
      const row: any = { hour }
      days.forEach((d) => { row[d] = 0 })
      row.average = 0
      return row
    })

    closedTables.forEach((ct) => {
      const d = new Date(ct.closedAt)
      const hour = `${String(d.getHours()).padStart(2, "0")}:00`
      const weekdayIndex = (d.getDay() + 6) % 7 // 0=Sun -> 6, 1=Mon ->0
      const dayKey = days[weekdayIndex]
      const row = rows.find((r) => r.hour === hour)
      if (!row) return
      row[dayKey] += ct.orders?.length || 0
    })

    rows.forEach((row) => {
      const sum = days.reduce((s, d) => s + (row[d] || 0), 0)
      row.average = days.length ? Math.round(sum / days.length) : 0
    })

    return rows
  }, [closedTables])

  const summaryCards = [
    { label: "Toplam Ciro", value: `\u20BA${formatCurrency(computedDailyReport.totalRevenue)}`, icon: TrendingUp, color: "#34c759" },
    { label: "Siparis Sayisi", value: computedDailyReport.totalOrders.toString(), icon: ShoppingCart, color: "#007aff" },
    { label: "Kapanan Masa", value: computedDailyReport.totalTables.toString(), icon: Receipt, color: "#e63462" },
    { label: "Iptal Tutari", value: `\u20BA${formatCurrency(computedDailyReport.cancelledAmount)}`, icon: Ban, color: "#ff3b30" },
    { label: "Indirim Tutari", value: `\u20BA${formatCurrency(computedDailyReport.discountAmount)}`, icon: Percent, color: "#ff9500" },
  ]

  // Waiter metrics
  const waiterMetrics = useMemo(() => {
    return dailyReport.waiterPerformance.map((w) => ({
      ...w,
      avgOrderValue: w.orders > 0 ? Math.round(w.revenue / w.orders) : 0,
      cancelRate: 0,
    }))
  }, [dailyReport])

  // Density heatmap max
  const densityMax = useMemo(() => {
    let max = 0
    hourlyDensity.forEach((h) => {
      const vals = [h.monday, h.tuesday, h.wednesday, h.thursday, h.friday, h.saturday, h.sunday]
      vals.forEach((v) => { if (v > max) max = v })
    })
    return max
  }, [hourlyDensity])

  const DAYS = [
    { key: "monday" as const, label: "Pzt" },
    { key: "tuesday" as const, label: "Sal" },
    { key: "wednesday" as const, label: "Car" },
    { key: "thursday" as const, label: "Per" },
    { key: "friday" as const, label: "Cum" },
    { key: "saturday" as const, label: "Cmt" },
    { key: "sunday" as const, label: "Paz" },
  ]

  const handleExport = (type: "pdf" | "excel") => {
    // In a real app, this would generate and download a file
    const data = JSON.stringify({
      dailyReport,
      closedTables: closedTables.map((ct) => ({
        table: ct.tableName, waiter: ct.waiter, total: ct.totalAmount,
        net: ct.netAmount, method: ct.payment.method, closedAt: ct.closedAt,
      })),
      cancelledItems: cancelledItems.map((ci) => ({
        product: ci.orderItem.productName, table: ci.tableName,
        reason: ci.reason, by: ci.cancelledBy, amount: ci.orderItem.price * ci.orderItem.quantity,
      })),
    }, null, 2)
    const blob = new Blob([data], { type: type === "excel" ? "application/json" : "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rapor-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "json" : "json"}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Raporlar</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
              <Clock className="w-3.5 h-3.5" />
              {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div className="h-4 w-px bg-[#d1d1d6]/60" />
            <button onClick={() => handleExport("excel")} className="h-[28px] px-2.5 flex items-center gap-1.5 text-[11px] font-medium text-[#86868b] hover:bg-black/[0.04] rounded-md transition-colors">
              <Download className="w-3 h-3" /> Excel
            </button>
            <button onClick={() => handleExport("pdf")} className="h-[28px] px-2.5 flex items-center gap-1.5 text-[11px] font-medium text-[#86868b] hover:bg-black/[0.04] rounded-md transition-colors">
              <Download className="w-3 h-3" /> PDF
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Filter className="w-3.5 h-3.5 text-[#86868b]" />
          <select 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none pr-7 cursor-pointer"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            <option value="today">Bugun</option>
            <option value="yesterday">Dun</option>
            <option value="week">Son 7 Gun</option>
            <option value="month">Son 30 Gun</option>
            <option value="custom">Ozel Tarih</option>
            <option value="all">Tumu</option>
          </select>
          {filterDate === "custom" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Baslangic:</span>
                <input 
                  type="datetime-local" 
                  value={customStartDate} 
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Bitis:</span>
                <input 
                  type="datetime-local" 
                  value={customEndDate} 
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
              </div>
            </>
          )}
          <span className="text-[11px] text-[#86868b] ml-2">
            {filteredClosedTables.length} siparis | {"\u20BA"}{formatCurrency(computedDailyReport.totalRevenue)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex gap-1.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors flex-shrink-0 ${activeTab === tab.id ? "bg-[#e63462] text-white" : "text-[#86868b] hover:bg-black/[0.04]"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-6xl flex flex-col gap-5">

          {/* ===== DAILY ===== */}
          {activeTab === "daily" && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-5 gap-3">
                {summaryCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <div key={card.label} className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${card.color}15` }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                        </div>
                        <span className="text-[11px] text-[#86868b] font-medium">{card.label}</span>
                      </div>
                      <p className="text-[20px] font-bold text-[#1d1d1f]">{card.value}</p>
                    </div>
                  )
                })}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                  <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Saatlik Ciro</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={dailyReport.hourlyRevenue}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e63462" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#e63462" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#86868b" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#86868b" }} />
                      <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`, "Ciro"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                      <Area type="monotone" dataKey="revenue" stroke="#e63462" strokeWidth={2} fill="url(#areaGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                  <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Odeme Yontemi Dagilimi</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={dailyReport.paymentBreakdown} dataKey="total" nameKey="method"
                        cx="50%" cy="50%" outerRadius={75} innerRadius={40}
                        label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false} fontSize={10}>
                        {dailyReport.paymentBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top products */}
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">En Cok Satan Urunler</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyReport.topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#86868b" }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#1d1d1f" }} width={120} />
                    <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`, "Ciro"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                    <Bar dataKey="revenue" fill="#e63462" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>


            </>
          )}

          {/* ===== PERIOD COMPARISON ===== */}
          {activeTab === "period" && (
            <>
              <div className="flex items-center gap-2">
                {(["weekly", "monthly", "yearly"] as const).map((type) => (
                  <button key={type} onClick={() => setSelectedPeriodType(type)}
                    className={`h-[30px] px-3.5 rounded-lg text-[12px] font-medium transition-colors ${selectedPeriodType === type ? "bg-[#e63462] text-white" : "bg-white border border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"}`}>
                    {type === "weekly" ? "Haftalik" : type === "monthly" ? "Aylik" : "Yillik"}
                  </button>
                ))}
              </div>

              {/* Period chart */}
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Ciro Karsilastirmasi</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={filteredPeriodReports}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="periodLabel" tick={{ fontSize: 10, fill: "#86868b" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#86868b" }} />
                    <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                    <Bar dataKey="totalRevenue" fill="#e63462" radius={[4, 4, 0, 0]} barSize={28} name="Ciro" />
                    <Bar dataKey="comparisonRevenue" fill="#d1d1d6" radius={[4, 4, 0, 0]} barSize={28} name="Onceki Donem" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Period table */}
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
                            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              r.comparisonChange > 0 ? "bg-green-50 text-green-600" : r.comparisonChange < 0 ? "bg-red-50 text-red-500" : "bg-[#f5f5f7] text-[#86868b]"
                            }`}>
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
          )}

          {/* ===== PRODUCT TRENDS ===== */}
          {activeTab === "trends" && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                {productTrends.map((t) => (
                  <button key={t.productName} onClick={() => setSelectedTrendProduct(t.productName)}
                    className={`h-[30px] px-3.5 rounded-lg text-[12px] font-medium transition-colors ${selectedTrendProduct === t.productName ? "bg-[#e63462] text-white" : "bg-white border border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"}`}>
                    {t.productName}
                  </button>
                ))}
              </div>

              {selectedTrend && (
                <>
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
                          <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`]}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                          <Area type="monotone" dataKey="revenue" stroke="#34c759" strokeWidth={2} fill="url(#trendGrad)" name="Ciro" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ===== HOURLY DENSITY HEATMAP ===== */}
          {activeTab === "density" && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
              <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-4">Haftalik Yogunluk Haritasi (Siparis Sayisi)</h3>
              <div className="overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-2 text-[11px] font-semibold text-[#86868b] uppercase w-[60px]">Saat</th>
                      {DAYS.map((d) => (
                        <th key={d.key} className="text-center px-1 py-2 text-[11px] font-semibold text-[#86868b] uppercase">{d.label}</th>
                      ))}
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
                              <div className="w-full h-[32px] rounded-md flex items-center justify-center text-[11px] font-semibold transition-colors"
                                style={{ backgroundColor: getHeatColor(val, densityMax), color: val > densityMax * 0.5 ? "#fff" : "#1d1d1f" }}>
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
                {HEATMAP_COLORS.map((color, i) => (
                  <div key={i} className="w-5 h-3 rounded-sm" style={{ backgroundColor: color }} />
                ))}
                <span className="text-[10px] text-[#86868b]">Cok</span>
              </div>
            </div>
          )}

          {/* ===== WAITER PERFORMANCE ===== */}
          {activeTab === "waiters" && (
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

              {/* Waiter revenue chart */}
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Garson Bazli Ciro</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={waiterMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#1d1d1f" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#86868b" }} />
                    <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                    <Bar dataKey="revenue" fill="#e63462" radius={[4, 4, 0, 0]} barSize={36} name="Ciro" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* ===== HISTORY (closed + cancelled) ===== */}
          {activeTab === "history" && (
            <>
              {/* Closed tables */}
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <button onClick={() => setShowClosedDetail(!showClosedDetail)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f9f9fb] transition-colors">
                  <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Kapanmis Masalar ({closedTables.length})</h3>
                  {showClosedDetail ? <ChevronUp className="w-4 h-4 text-[#86868b]" /> : <ChevronDown className="w-4 h-4 text-[#86868b]" />}
                </button>
                {showClosedDetail && (
                  <table className="w-full">
                    <thead>
                      <tr className="border-t border-b border-[#f0f0f0] bg-[#f9f9f9]">
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Masa</th>
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Garson</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tutar</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Indirim</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Net</th>
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Odeme</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Saat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedTables.map((ct, idx) => (
                        <tr key={ct.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                          <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">{ct.tableName}</td>
                          <td className="px-4 py-2 text-[12px] text-[#86868b]">{ct.waiter}</td>
                          <td className="px-4 py-2 text-[12px] text-right text-[#1d1d1f]">{"\u20BA"}{formatCurrency(ct.totalAmount)}</td>
                          <td className="px-4 py-2 text-[12px] text-right text-red-500">{ct.discountAmount > 0 ? `-\u20BA${formatCurrency(ct.discountAmount)}` : "-"}</td>
                          <td className="px-4 py-2 text-[12px] text-right font-semibold text-[#e63462]">{"\u20BA"}{formatCurrency(ct.netAmount)}</td>
                          <td className="px-4 py-2 text-[12px] text-[#86868b] capitalize">
                            {ct.payment.method === "cari"
                              ? (() => {
                                  const n =
                                    ct.payment.ledgerCustomerName?.trim() ||
                                    ledgerCustomers.find((c) => c.id === ct.payment.ledgerCustomerId)?.name?.trim()
                                  return n ? `cari (${n})` : "cari"
                                })()
                              : ct.payment.method.replace("-", " ")}
                          </td>
                          <td className="px-4 py-2 text-[12px] text-right text-[#86868b]">{new Date(ct.closedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Cancelled items */}
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <button onClick={() => setShowCancelledDetail(!showCancelledDetail)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f9f9fb] transition-colors">
                  <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Iptal Edilen Urunler ({cancelledItems.length})</h3>
                  {showCancelledDetail ? <ChevronUp className="w-4 h-4 text-[#86868b]" /> : <ChevronDown className="w-4 h-4 text-[#86868b]" />}
                </button>
                {showCancelledDetail && (
                  <table className="w-full">
                    <thead>
                      <tr className="border-t border-b border-[#f0f0f0] bg-[#f9f9f9]">
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Urun</th>
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Masa</th>
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Sebep</th>
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Iptal Eden</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledItems.map((ci, idx) => (
                        <tr key={ci.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                          <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">{ci.orderItem.productName} x{ci.orderItem.quantity}</td>
                          <td className="px-4 py-2 text-[12px] text-[#86868b]">{ci.tableName}</td>
                          <td className="px-4 py-2 text-[12px] text-[#86868b]">{ci.reason}</td>
                          <td className="px-4 py-2 text-[12px] text-[#86868b]">{ci.cancelledBy}</td>
                          <td className="px-4 py-2 text-[12px] text-right text-red-500">{"\u20BA"}{formatCurrency(ci.orderItem.price * ci.orderItem.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
