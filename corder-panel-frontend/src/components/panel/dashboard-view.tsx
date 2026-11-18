import { useState, useEffect, useMemo } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelI18n } from "@/lib/panel-i18n"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  LayoutGrid,
  Ban,
  Users,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import type { PanelViewId } from "@/lib/panel-types"
import {
  computeDateFilterBounds,
  formatCurrency,
  formatIstanbulTime,
  toMinorUnits,
} from "@/lib/format"

interface DashboardViewProps {
  onNavigate?: (screen: PanelViewId) => void
}

const PIE_COLORS = ["#34c759", "#007aff", "#ff9500", "#af52de", "#e63462"]

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  "credit-card": "Kart",
  "meal-card": "Yemek K.",
  multinet: "Multinet",
  split: "Çoklu",
  ledger: "Cari",
}

export default function DashboardView(_props: DashboardViewProps) {
  const {
    tables,
    closedTables,
    dailyReport,
    auditLogs,
    currentUser,
    hasPermission,
  } = usePanelStore()
  const { t } = usePanelI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isBoss = currentUser?.role === "root"
  const canViewFinancial = isBoss || hasPermission("reports.view_financial")
  const canViewStaffPerf =
    isBoss || hasPermission("reports.view_staff_performance")
  const canViewAuditLogs = isBoss || hasPermission("reports.view_audit_logs")

  const occupiedCount = tables.filter((tb) => tb.status !== "empty").length
  const emptyCount = tables.filter((tb) => tb.status === "empty").length
  const recentAuditLogs = auditLogs.slice(0, 8)

  const yesterdayStats = useMemo(() => {
    const bounds = computeDateFilterBounds("yesterday", "", "")
    if (!bounds) return { revenueMinorUnits: 0, ordersCount: 0 }
    const yTables = closedTables.filter((ct) => {
      const d = new Date(ct.closedAt)
      return d >= bounds.from && d <= bounds.to
    })
    return {
      revenueMinorUnits: yTables.reduce((s, ct) => s + toMinorUnits(ct.netAmount), 0),
      ordersCount: yTables.length,
    }
  }, [closedTables])

  const todayRevenueMinorUnits = toMinorUnits(dailyReport.totalRevenue)
  const revenueDelta = useMemo(() => {
    if (yesterdayStats.revenueMinorUnits > 0) {
      const pct =
        ((todayRevenueMinorUnits - yesterdayStats.revenueMinorUnits) /
          yesterdayStats.revenueMinorUnits) *
        100
      const sign = pct >= 0 ? "+" : ""
      return {
        label: `${sign}${pct.toFixed(1)}% vs dün`,
        up: pct >= 0,
      }
    }
    return {
      label: todayRevenueMinorUnits > 0 ? "Bugün aktif" : "Dün veri yok",
      up: todayRevenueMinorUnits > 0,
    }
  }, [todayRevenueMinorUnits, yesterdayStats.revenueMinorUnits])

  const ordersDelta = useMemo(() => {
    const diff = dailyReport.totalOrders - yesterdayStats.ordersCount
    if (yesterdayStats.ordersCount > 0) {
      const sign = diff >= 0 ? "+" : ""
      return {
        label: `${sign}${diff} vs dün`,
        up: diff >= 0,
      }
    }
    return {
      label: `${dailyReport.totalOrders} adisyon`,
      up: dailyReport.totalOrders > 0,
    }
  }, [dailyReport.totalOrders, yesterdayStats.ordersCount])

  const paymentData = dailyReport.paymentBreakdown.map((p) => ({
    name: PAYMENT_METHOD_LABELS[p.method] || p.method,
    value: p.total,
    count: p.count,
  }))

  const hourlyData = dailyReport.hourlyRevenue.map((h) => ({
    hour: h.hour,
    revenue: h.revenue,
    orders: h.orders,
  }))

  const stats = [
    ...(canViewFinancial
      ? [
          {
            label: t("totalRevenue"),
            value: `₺${formatCurrency(dailyReport.totalRevenue)}`,
            icon: DollarSign,
            color: "#34c759",
            change: revenueDelta.label,
            up: revenueDelta.up,
          },
        ]
      : []),
    {
      label: t("totalOrders"),
      value: dailyReport.totalOrders.toString(),
      icon: ShoppingCart,
      color: "#007aff",
      change: ordersDelta.label,
      up: ordersDelta.up,
    },
    {
      label: t("occupiedTables"),
      value: `${occupiedCount} / ${tables.length}`,
      icon: LayoutGrid,
      color: "#ff9500",
      change: `${emptyCount} ${t("empty")}`,
      up: false,
    },
    {
      label: t("cancellations"),
      value: dailyReport.cancelledItems.length.toString(),
      icon: Ban,
      color: "#ff3b30",
      change: `₺${formatCurrency(dailyReport.cancelledAmount)}`,
      up: false,
    },
  ]

  const topProducts = dailyReport.topProducts.slice(0, 5)
  const waiterPerf = dailyReport.waiterPerformance.slice(0, 5)

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 w-full">
        <div
          className={`grid gap-4 mb-6 ${stats.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}
        >
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="bg-[var(--panel-card)] rounded-2xl p-4 border border-[var(--panel-border)]"
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${stat.color}15` }}
                  >
                    <Icon
                      className="w-[18px] h-[18px]"
                      style={{ color: stat.color }}
                    />
                  </div>
                  <div
                    className={`flex items-center gap-0.5 text-[11px] font-semibold ${
                      stat.up ? "text-[#34c759]" : "text-[#86868b]"
                    }`}
                  >
                    {stat.up && <TrendingUp className="w-3 h-3" />}
                    {!stat.up && stat.label === t("cancellations") && (
                      <TrendingDown className="w-3 h-3 text-[#ff3b30]" />
                    )}
                    {stat.change}
                  </div>
                </div>
                <p className="text-[22px] font-bold text-[var(--panel-text)] leading-tight">
                  {stat.value}
                </p>
                <p className="text-[12px] text-[var(--panel-text-secondary)] mt-0.5">
                  {stat.label}
                </p>
              </div>
            )
          })}
        </div>

        {canViewFinancial && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="col-span-2 bg-[var(--panel-card)] rounded-2xl p-5 border border-[var(--panel-border)]">
              <h3 className="text-[14px] font-semibold text-[var(--panel-text)] mb-4">
                {t("hourlyRevenue")}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--panel-border)"
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 11, fill: "var(--panel-text-secondary)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--panel-text-secondary)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel-card)",
                      border: "1px solid var(--panel-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [
                      `₺${formatCurrency(value)}`,
                      "Ciro",
                    ]}
                  />
                  <Bar dataKey="revenue" fill="#e63462" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[var(--panel-card)] rounded-2xl p-5 border border-[var(--panel-border)]">
              <h3 className="text-[14px] font-semibold text-[var(--panel-text)] mb-4">
                {t("paymentBreakdown")}
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel-card)",
                      border: "1px solid var(--panel-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [
                      `₺${formatCurrency(value)}`,
                      "",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {paymentData.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                    <span className="text-[11px] text-[var(--panel-text-secondary)]">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--panel-card)] rounded-2xl p-5 border border-[var(--panel-border)]">
            <h3 className="text-[14px] font-semibold text-[var(--panel-text)] mb-3">
              {t("topProducts")}
            </h3>
            <div className="flex flex-col gap-2">
              {topProducts.length === 0 ? (
                <p className="text-[12px] text-[var(--panel-text-secondary)] py-4">
                  Bugün henüz satış yok
                </p>
              ) : (
                topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 py-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#e63462]/10 flex items-center justify-center text-[10px] font-bold text-[#e63462]">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--panel-text)] truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-[var(--panel-text-secondary)]">
                        {p.quantity} {t("pieces")}
                      </p>
                    </div>
                    {canViewFinancial && (
                      <span className="text-[13px] font-semibold text-[#e63462]">
                        {"₺"}
                        {formatCurrency(p.revenue)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {canViewStaffPerf && (
            <div className="bg-[var(--panel-card)] rounded-2xl p-5 border border-[var(--panel-border)]">
              <h3 className="text-[14px] font-semibold text-[var(--panel-text)] mb-3">
                {t("waiterPerformance")}
              </h3>
              <div className="flex flex-col gap-2">
                {waiterPerf.length === 0 ? (
                  <p className="text-[12px] text-[var(--panel-text-secondary)] py-4">
                    Bugün henüz garson işlemi yok
                  </p>
                ) : (
                  waiterPerf.map((w) => (
                    <div
                      key={w.name}
                      className="flex items-center gap-3 py-1.5"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#007aff]/10 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-[#007aff]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--panel-text)]">
                          {w.name}
                        </p>
                        <p className="text-[11px] text-[var(--panel-text-secondary)]">
                          {w.tables} masa / {w.orders} sipariş
                        </p>
                      </div>
                      {canViewFinancial && (
                        <span className="text-[13px] font-semibold text-[var(--panel-text)]">
                          {"₺"}
                          {formatCurrency(w.revenue)}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {canViewAuditLogs && (
            <div className="bg-[var(--panel-card)] rounded-2xl p-5 border border-[var(--panel-border)]">
              <h3 className="text-[14px] font-semibold text-[var(--panel-text)] mb-3">
                {t("recentActivity")}
              </h3>
              <div className="flex flex-col gap-1.5">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#e63462] mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[var(--panel-text)] truncate">
                        {log.details}
                      </p>
                      <p className="text-[10px] text-[var(--panel-text-secondary)]">
                        {log.userName} -{" "}
                        {mounted ? formatIstanbulTime(log.createdAt) : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
