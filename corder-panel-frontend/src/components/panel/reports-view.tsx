import { useState, useMemo } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { itemIsLedgerLike } from "@/lib/panel-types"
import { BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp, ShoppingCart, Ban, Percent, Clock, Receipt, Download, Filter } from "lucide-react"
import { HistoryTab } from "./reports/completed-orders-tab"
import { HourlyDensityTab, PeriodComparisonTab, ProductTrendsTab, useReportAnalyticsData, WaitersTab } from "./reports/analytics-tabs"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }
const PIE_COLORS = ["#e63462", "#34c759", "#007aff", "#ff9500", "#af52de"]
type ReportTab = "daily" | "period" | "trends" | "density" | "waiters" | "history"

export default function ReportsView() {
  const { dailyReport, closedTables, cancelledItems, ledgerCustomers } = usePanelStore()
  const [activeTab, setActiveTab] = useState<ReportTab>("daily")
  const [filterDate, setFilterDate] = useState("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  const { allPeriodReports, productTrends, hourlyDensity } = useReportAnalyticsData(closedTables, cancelledItems)

  const filteredClosedTables = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30)

    let list = [...closedTables]
    if (filterDate === "today") list = list.filter((ct) => new Date(ct.closedAt) >= today)
    else if (filterDate === "yesterday") list = list.filter((ct) => { const d = new Date(ct.closedAt); return d >= yesterday && d < today })
    else if (filterDate === "week") list = list.filter((ct) => new Date(ct.closedAt) >= weekAgo)
    else if (filterDate === "month") list = list.filter((ct) => new Date(ct.closedAt) >= monthAgo)
    else if (filterDate === "custom" && customStartDate) {
      const start = new Date(customStartDate)
      const end = customEndDate ? new Date(customEndDate) : new Date()
      list = list.filter((ct) => { const d = new Date(ct.closedAt); return d >= start && d <= end })
    }
    return list.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  }, [closedTables, filterDate, customStartDate, customEndDate])

  const computedDailyReport = useMemo(() => {
    const totalRevenue = filteredClosedTables.reduce((s, ct) => s + ct.netAmount, 0)
    const totalOrders = filteredClosedTables.reduce((s, ct) => s + ct.orders.length, 0)
    const cancelledAmount = filteredClosedTables.reduce((s, ct) => s + ct.orders.reduce((sum, o) => sum + o.items.filter((i) => i.status === "cancelled" && !itemIsLedgerLike(i)).reduce((x, item) => x + item.price * item.quantity, 0), 0), 0)
    const discountAmount = filteredClosedTables.reduce((s, ct) => s + ct.discountAmount, 0)
    return { totalRevenue, totalOrders, totalTables: filteredClosedTables.length, cancelledAmount, discountAmount }
  }, [filteredClosedTables])

  const TABS = [
    { id: "daily" as const, label: "Gunluk Rapor" },
    { id: "period" as const, label: "Donem Karsilastirma" },
    { id: "trends" as const, label: "Urun Trendleri" },
    { id: "density" as const, label: "Yogunluk Analizi" },
    { id: "waiters" as const, label: "Garson Performansi" },
    { id: "history" as const, label: "Gecmis Kayitlar" },
  ]

  const summaryCards = [
    { label: "Toplam Ciro", value: `\u20BA${formatCurrency(computedDailyReport.totalRevenue)}`, icon: TrendingUp, color: "#34c759" },
    { label: "Siparis Sayisi", value: computedDailyReport.totalOrders.toString(), icon: ShoppingCart, color: "#007aff" },
    { label: "Kapanan Masa", value: computedDailyReport.totalTables.toString(), icon: Receipt, color: "#e63462" },
    { label: "Iptal Tutari", value: `\u20BA${formatCurrency(computedDailyReport.cancelledAmount)}`, icon: Ban, color: "#ff3b30" },
    { label: "Indirim Tutari", value: `\u20BA${formatCurrency(computedDailyReport.discountAmount)}`, icon: Percent, color: "#ff9500" },
  ]

  const handleExport = () => {
    const data = JSON.stringify({
      dailyReport,
      closedTables: closedTables.map((ct) => ({ table: ct.tableName, waiter: ct.waiter, total: ct.totalAmount, net: ct.netAmount, method: ct.payment.method, closedAt: ct.closedAt })),
      cancelledItems: cancelledItems.map((ci) => ({ product: ci.orderItem.productName, table: ci.tableName, reason: ci.reason, by: ci.cancelledBy, amount: ci.orderItem.price * ci.orderItem.quantity })),
    }, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rapor-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Raporlar</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
              <Clock className="w-3.5 h-3.5" />
              {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div className="h-4 w-px bg-[#d1d1d6]/60" />
            <button onClick={handleExport} className="h-[28px] px-2.5 flex items-center gap-1.5 text-[11px] font-medium text-[#86868b] hover:bg-black/[0.04] rounded-md transition-colors">
              <Download className="w-3 h-3" /> Excel
            </button>
            <button onClick={handleExport} className="h-[28px] px-2.5 flex items-center gap-1.5 text-[11px] font-medium text-[#86868b] hover:bg-black/[0.04] rounded-md transition-colors">
              <Download className="w-3 h-3" /> PDF
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Filter className="w-3.5 h-3.5 text-[#86868b]" />
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none pr-7 cursor-pointer">
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
                <input type="datetime-local" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Bitis:</span>
                <input type="datetime-local" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              </div>
            </>
          )}
          <span className="text-[11px] text-[#86868b] ml-2">
            {filteredClosedTables.length} siparis | {"\u20BA"}{formatCurrency(computedDailyReport.totalRevenue)}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex gap-1.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors flex-shrink-0 ${activeTab === tab.id ? "bg-[#e63462] text-white" : "text-[#86868b] hover:bg-black/[0.04]"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-6xl flex flex-col gap-5">
          {activeTab === "daily" && (
            <>
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
                      <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`, "Ciro"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                      <Area type="monotone" dataKey="revenue" stroke="#e63462" strokeWidth={2} fill="url(#areaGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                  <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Odeme Yontemi Dagilimi</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={dailyReport.paymentBreakdown} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={75} innerRadius={40} label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {dailyReport.paymentBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">En Cok Satan Urunler</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyReport.topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#86868b" }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#1d1d1f" }} width={120} />
                    <Tooltip formatter={(v: number) => [`\u20BA${formatCurrency(v)}`, "Ciro"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0" }} />
                    <Bar dataKey="revenue" fill="#e63462" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {activeTab === "period" && <PeriodComparisonTab allPeriodReports={allPeriodReports} />}
          {activeTab === "trends" && <ProductTrendsTab productTrends={productTrends} />}
          {activeTab === "density" && <HourlyDensityTab hourlyDensity={hourlyDensity} />}
          {activeTab === "waiters" && <WaitersTab dailyReport={dailyReport} />}
          {activeTab === "history" && <HistoryTab closedTables={closedTables} cancelledItems={cancelledItems} ledgerCustomers={ledgerCustomers} />}
        </div>
      </div>
    </div>
  )
}
