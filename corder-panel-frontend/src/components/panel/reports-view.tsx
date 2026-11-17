import { useState, useMemo, useEffect } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp, ShoppingCart, Ban, Percent, Clock, Receipt, Download, Printer, Filter } from "lucide-react"
import { HistoryTab } from "./reports/completed-orders-tab"
import { HourlyDensityTab, PeriodComparisonTab, ProductTrendsTab, useReportAnalyticsData, WaitersTab } from "./reports/analytics-tabs"
import { ISTANBUL_TZ, computeDateFilterBounds, formatCurrency, formatIstanbulDateTime, fromMinorUnits, getIstanbulYmd, toMinorUnits } from "@/lib/format"
import { computeReportForClosedTables } from "@/lib/store/panel-local-storage"

const PIE_COLORS = ["#e63462", "#34c759", "#007aff", "#ff9500", "#af52de"]
type ReportTab =
  | "daily"
  | "period"
  | "trends"
  | "density"
  | "waiters"
  | "history"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  "credit-card": "Kredi Kartı",
  "meal-card": "Yemek Kartı",
  multinet: "Multinet",
  split: "Çoklu Ödeme",
  ledger: "Cari",
}

export default function ReportsView() {
  const { closedTables, cancelledItems, ledgerCustomers, settings, currentUser, hasPermission } = usePanelStore()
  const [activeTab, setActiveTab] = useState<ReportTab>("daily")
  const [filterDate, setFilterDate] = useState("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  const isBoss = currentUser?.role === "root"
  const canViewFinancial = isBoss || hasPermission("reports.view_financial")
  const canViewOperational =
    isBoss || hasPermission("reports.view_operational", "reports.view_financial")
  const canViewStaffPerf =
    isBoss || hasPermission("reports.view_staff_performance")

  const { allPeriodReports, productTrends, hourlyDensity } =
    useReportAnalyticsData(closedTables, cancelledItems)

  const dateBounds = useMemo(
    () => computeDateFilterBounds(filterDate, customStartDate, customEndDate),
    [filterDate, customStartDate, customEndDate],
  )

  const filteredClosedTables = useMemo(() => {
    let list = [...closedTables]
    if (dateBounds) {
      list = list.filter((ct) => {
        const d = new Date(ct.closedAt)
        return d >= dateBounds.from && d <= dateBounds.to
      })
    }
    return list.sort(
      (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime(),
    )
  }, [closedTables, dateBounds])

  const filteredCancelledItems = useMemo(() => {
    let list = [...cancelledItems]
    if (dateBounds) {
      list = list.filter((ci) => {
        const d = new Date(ci.cancelledAt)
        return d >= dateBounds.from && d <= dateBounds.to
      })
    }
    return list.sort(
      (a, b) =>
        new Date(b.cancelledAt).getTime() - new Date(a.cancelledAt).getTime(),
    )
  }, [cancelledItems, dateBounds])

  const filteredReport = useMemo(
    () =>
      computeReportForClosedTables(
        filteredClosedTables,
        filteredCancelledItems,
      ),
    [filteredClosedTables, filteredCancelledItems],
  )

  const paymentPieData = useMemo(
    () =>
      filteredReport.paymentBreakdown.map((p) => ({
        ...p,
        label: PAYMENT_METHOD_LABELS[p.method] || p.method,
      })),
    [filteredReport.paymentBreakdown],
  )

  const availableTabs = useMemo(() => {
    const list: { id: ReportTab; label: string }[] = []
    if (canViewFinancial || canViewOperational) {
      list.push({ id: "daily", label: "Günlük Rapor" })
    }
    if (canViewFinancial) {
      list.push({ id: "period", label: "Dönem Karşılaştırma" })
    }
    if (canViewOperational) {
      list.push({ id: "trends", label: "Ürün Trendleri" })
      list.push({ id: "density", label: "Yoğunluk Analizi" })
    }
    if (canViewStaffPerf) {
      list.push({ id: "waiters", label: "Garson Performansı" })
    }
    if (canViewOperational || canViewFinancial) {
      list.push({ id: "history", label: "Geçmiş Kayıtlar" })
    }
    return list
  }, [canViewFinancial, canViewOperational, canViewStaffPerf])

  useEffect(() => {
    if (
      availableTabs.length > 0 &&
      !availableTabs.some((t) => t.id === activeTab)
    ) {
      setActiveTab(availableTabs[0].id)
    }
  }, [availableTabs, activeTab])

  const summaryCards = [
    ...(canViewFinancial
      ? [
          {
            label: "Toplam Ciro",
            value: `\u20BA${formatCurrency(filteredReport.totalRevenue)}`,
            icon: TrendingUp,
            color: "#34c759",
          },
        ]
      : []),
    {
      label: "Sipariş Sayısı",
      value: filteredReport.totalOrders.toString(),
      icon: ShoppingCart,
      color: "#007aff",
    },
    {
      label: "Kapanan Masa",
      value: filteredReport.totalTables.toString(),
      icon: Receipt,
      color: "#e63462",
    },
    {
      label: "İptal Tutarı",
      value: `\u20BA${formatCurrency(filteredReport.cancelledAmount)}`,
      icon: Ban,
      color: "#ff3b30",
    },
    ...(canViewFinancial
      ? [
          {
            label: "İndirim Tutarı",
            value: `\u20BA${formatCurrency(filteredReport.discountAmount)}`,
            icon: Percent,
            color: "#ff9500",
          },
        ]
      : []),
  ]

  const escapeCsvCell = (val: string | number) => {
    const str = String(val ?? "")
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const handleExportCsv = () => {
    const rows: string[][] = [
      ["Rapor Özeti", settings.name || "Restoran"],
      ["Tarih", getIstanbulYmd(new Date())],
      ["Toplam Ciro (TL)", formatCurrency(filteredReport.totalRevenue)],
      ["Toplam Sipariş", String(filteredReport.totalOrders)],
      ["Kapanan Masa", String(filteredReport.totalTables)],
      ["İptal Tutarı (TL)", formatCurrency(filteredReport.cancelledAmount)],
      ["İndirim Tutarı (TL)", formatCurrency(filteredReport.discountAmount)],
      [],
      [
        "Masa",
        "Bölüm",
        "Garson",
        "Ara Toplam (TL)",
        "İndirim (TL)",
        "Net Tutar (TL)",
        "Ödeme Yöntemi",
        "Kapanış Zamanı",
      ],
      ...filteredClosedTables.map((ct) => [
        ct.tableName,
        ct.section,
        ct.waiter,
        formatCurrency(ct.totalAmount),
        formatCurrency(ct.discountAmount),
        formatCurrency(ct.netAmount),
        PAYMENT_METHOD_LABELS[ct.payment.method] || ct.payment.method,
        formatIstanbulDateTime(ct.closedAt),
      ]),
      [],
      ["İptal Edilen Ürün", "Adet", "Masa", "Sebep", "İptal Eden", "Tutar (TL)"],
      ...filteredCancelledItems.map((ci) => [
        ci.orderItem.productName,
        String(ci.orderItem.quantity),
        ci.tableName,
        ci.reason,
        ci.cancelledBy,
        formatCurrency(
          fromMinorUnits(toMinorUnits(ci.orderItem.price) * ci.orderItem.quantity),
        ),
      ]),
    ]
    const csvContent =
      "\uFEFF" +
      rows.map((r) => r.map((c) => escapeCsvCell(c)).join(";")).join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rapor-${getIstanbulYmd(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintPdf = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    const rowsHtml = filteredClosedTables
      .map(
        (ct) => `
        <tr>
          <td>${ct.tableName}</td>
          <td>${ct.waiter}</td>
          <td style="text-align:right">₺${formatCurrency(ct.totalAmount)}</td>
          <td style="text-align:right">₺${formatCurrency(ct.discountAmount)}</td>
          <td style="text-align:right;font-weight:bold">₺${formatCurrency(ct.netAmount)}</td>
          <td>${PAYMENT_METHOD_LABELS[ct.payment.method] || ct.payment.method}</td>
          <td>${formatIstanbulDateTime(ct.closedAt)}</td>
        </tr>`,
      )
      .join("")
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="utf-8" />
          <title>Rapor — ${settings.name || "Corder POS"}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1d1d1f; }
            h1 { font-size: 18px; margin: 0 0 4px; }
            p.sub { font-size: 12px; color: #666; margin: 0 0 16px; }
            .cards { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
            .card .lbl { font-size: 11px; color: #666; }
            .card .val { font-size: 16px; font-weight: bold; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; }
            th { background: #f5f5f7; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>${settings.name || "Restoran"} — Satış Raporu</h1>
          <p class="sub">Oluşturulma: ${formatIstanbulDateTime(new Date())}</p>
          <div class="cards">
            <div class="card"><div class="lbl">Toplam Ciro</div><div class="val">₺${formatCurrency(filteredReport.totalRevenue)}</div></div>
            <div class="card"><div class="lbl">Sipariş Sayısı</div><div class="val">${filteredReport.totalOrders}</div></div>
            <div class="card"><div class="lbl">Kapanan Masa</div><div class="val">${filteredReport.totalTables}</div></div>
            <div class="card"><div class="lbl">İptal Tutarı</div><div class="val">₺${formatCurrency(filteredReport.cancelledAmount)}</div></div>
            <div class="card"><div class="lbl">İndirim Tutarı</div><div class="val">₺${formatCurrency(filteredReport.discountAmount)}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Masa</th><th>Garson</th><th style="text-align:right">Tutar</th><th style="text-align:right">İndirim</th><th style="text-align:right">Net</th><th>Ödeme</th><th>Tarih/Saat</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Raporlar</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
              <Clock className="w-3.5 h-3.5" />
              {new Date().toLocaleDateString("tr-TR", {
                timeZone: ISTANBUL_TZ,
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="h-4 w-px bg-[#d1d1d6]/60" />
            <button onClick={handleExportCsv} className="h-[28px] px-2.5 flex items-center gap-1.5 text-[11px] font-medium text-[#86868b] hover:bg-black/[0.04] rounded-md transition-colors">
              <Download className="w-3 h-3" /> CSV (Excel)
            </button>
            <button onClick={handlePrintPdf} className="h-[28px] px-2.5 flex items-center gap-1.5 text-[11px] font-medium text-[#86868b] hover:bg-black/[0.04] rounded-md transition-colors">
              <Printer className="w-3 h-3" /> Yazdır / PDF
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Filter className="w-3.5 h-3.5 text-[#86868b]" />
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none pr-7 cursor-pointer"
          >
            <option value="today">Bugün</option>
            <option value="yesterday">Dün</option>
            <option value="week">Son 7 Gün</option>
            <option value="month">Son 30 Gün</option>
            <option value="custom">Özel Tarih</option>
            <option value="all">Tümü</option>
          </select>
          {filterDate === "custom" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Başlangıç:</span>
                <input
                  type="datetime-local"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Bitiş:</span>
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
            {filteredClosedTables.length} sipariş
            {canViewFinancial
              ? ` | \u20BA${formatCurrency(filteredReport.totalRevenue)}`
              : ""}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex gap-1.5 overflow-x-auto">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors flex-shrink-0 ${activeTab === tab.id ? "bg-[#e63462] text-white" : "text-[#86868b] hover:bg-black/[0.04]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-6xl flex flex-col gap-5">
          {activeTab === "daily" && (
            <>
              <div className={`grid gap-3 ${summaryCards.length === 5 ? "grid-cols-5" : "grid-cols-3"}`}>
                {summaryCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <div key={card.label} className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${card.color}15` }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                        </div>
                        <span className="text-[11px] text-[#86868b] font-medium">
                          {card.label}
                        </span>
                      </div>
                      <p className="text-[20px] font-bold text-[#1d1d1f]">
                        {card.value}
                      </p>
                    </div>
                  )
                })}
              </div>

              {canViewFinancial && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                    <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Saatlik Ciro</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={filteredReport.hourlyRevenue}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#e63462" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#e63462" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#86868b" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#86868b" }} />
                        <Tooltip formatter={(v: number) => [ `\u20BA${formatCurrency(v)}`, "Ciro", ]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0", }} />
                        <Area type="monotone" dataKey="revenue" stroke="#e63462" strokeWidth={2} fill="url(#areaGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                    <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Ödeme Yöntemi Dağılımı</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={paymentPieData} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={75} innerRadius={40} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%` } labelLine={false} fontSize={10}>
                          {paymentPieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [ `\u20BA${formatCurrency(v)}`, ]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0", }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">En Çok Satan Ürünler</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={filteredReport.topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#86868b" }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#1d1d1f" }} width={120} />
                    <Tooltip formatter={(v: number) => [ canViewFinancial ? `\u20BA${formatCurrency(v)}` : `${v}`, canViewFinancial ? "Ciro" : "Adet", ]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f0f0f0", }} />
                    <Bar dataKey={canViewFinancial ? "revenue" : "quantity"} fill="#e63462" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {activeTab === "period" && canViewFinancial && (
            <PeriodComparisonTab allPeriodReports={allPeriodReports} />
          )}
          {activeTab === "trends" && (
            <ProductTrendsTab productTrends={productTrends} />
          )}
          {activeTab === "density" && (
            <HourlyDensityTab hourlyDensity={hourlyDensity} />
          )}
          {activeTab === "waiters" && canViewStaffPerf && (
            <WaitersTab dailyReport={filteredReport} />
          )}
          {activeTab === "history" && (
            <HistoryTab closedTables={filteredClosedTables} cancelledItems={filteredCancelledItems} ledgerCustomers={ledgerCustomers} />
          )}
        </div>
      </div>
    </div>
  )
}
