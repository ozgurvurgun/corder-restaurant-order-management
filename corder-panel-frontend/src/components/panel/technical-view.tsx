import { useState, useMemo } from "react"
import { usePanelStore } from "@/lib/panel-store"
import {
  Bell,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react"

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type TechnicalTab = "notifications" | "audit"

export default function TechnicalView() {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    auditLogs,
  } = usePanelStore()

  const [activeTab, setActiveTab] = useState<TechnicalTab>("notifications")
  const [auditFilter, setAuditFilter] = useState<string>("all")
  const [datePreset, setDatePreset] = useState<
    "all" | "today" | "7d" | "30d" | "custom"
  >("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const actionGroupLabel = (action: string): string => {
    if (action.startsWith("product_")) return "Urun"
    if (action.startsWith("category_")) return "Kategori"
    if (action.startsWith("table_")) return "Masa"
    if (action.startsWith("order_")) return "Siparis"
    if (action.startsWith("supplier_")) return "Tedarikci"
    if (action.startsWith("material_") || action.startsWith("stock_"))
      return "Stok"
    if (action.startsWith("ledger_") || action.startsWith("open_account_"))
      return "Cari"
    if (action.startsWith("shift_") || action.startsWith("cash_"))
      return "Kasa"
    if (action.startsWith("printer_")) return "Yazici"
    if (action.startsWith("campaign_")) return "Kampanya"
    if (action.startsWith("settings_")) return "Ayar"
    if (action.startsWith("branch_")) return "Sube"
    if (action.startsWith("discount_") || action.startsWith("bill_"))
      return "Odeme"
    return "Diger"
  }

  const filteredLogs = useMemo(() => {
    const now = new Date()
    const byDate = (d: Date) => {
      if (datePreset === "all") return true
      if (datePreset === "today") {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        return d >= start
      }
      if (datePreset === "7d" || datePreset === "30d") {
        const days = datePreset === "7d" ? 7 : 30
        const start = new Date(now)
        start.setDate(start.getDate() - days)
        start.setHours(0, 0, 0, 0)
        return d >= start
      }
      if (datePreset === "custom") {
        if (!fromDate && !toDate) return true
        const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null
        const to = toDate ? new Date(`${toDate}T23:59:59`) : null
        if (from && d < from) return false
        if (to && d > to) return false
      }
      return true
    }

    return auditLogs.filter((l) => {
      if (auditFilter !== "all" && l.category !== auditFilter) return false
      return byDate(new Date(l.createdAt))
    })
  }, [auditLogs, auditFilter, datePreset, fromDate, toDate])

  const TABS = [
    {
      id: "notifications" as const,
      label: `Bildirimler${unreadCount > 0 ? ` (${unreadCount})` : ""}`,
      icon: Bell,
    },
    { id: "audit" as const, label: "Aktivite Loglari", icon: Shield },
  ]

  const AUDIT_CATEGORIES = [
    "all",
    "auth",
    "order",
    "payment",
    "product",
    "user",
    "settings",
    "stock",
    "cash-register",
    "table",
  ]
  const categoryLabels: Record<string, string> = {
    all: "Tumu",
    auth: "Giris",
    order: "Siparis",
    payment: "Odeme",
    product: "Urun",
    user: "Kullanici",
    settings: "Ayarlar",
    stock: "Stok",
    "cash-register": "Kasa",
    table: "Masa",
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-between px-5">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
          Teknik Yonetim
        </h2>
      </div>

      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex gap-1.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors flex-shrink-0 flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "bg-[#e63462] text-white"
                : "text-[#86868b] hover:bg-black/[0.04]"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-5xl flex flex-col gap-4">
          {activeTab === "notifications" && (
            <>
              <div className="flex justify-between items-center">
                <p className="text-[12px] text-[#86868b]">
                  {unreadCount} okunmamis bildirim
                </p>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-[12px] font-medium text-[#e63462] hover:underline"
                  >
                    Tumunu Okundu Isaretle
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={`w-full text-left bg-white rounded-xl border p-4 transition-colors hover:bg-[#f9f9fb] ${
                      n.read
                        ? "border-[#d1d1d6]/60 opacity-60"
                        : "border-[#e63462]/30 bg-[#e63462]/[0.02]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            n.type === "stock-low"
                              ? "bg-amber-50"
                              : n.type === "system"
                                ? "bg-blue-50"
                                : n.type === "kitchen-alert"
                                  ? "bg-red-50"
                                  : "bg-green-50"
                          }`}
                        >
                          {n.type === "stock-low" ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          ) : n.type === "system" ? (
                            <Shield className="w-3.5 h-3.5 text-blue-600" />
                          ) : n.type === "kitchen-alert" ? (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-[13px] font-semibold text-[#1d1d1f]">
                            {n.title}
                          </h4>
                          <p className="text-[12px] text-[#86868b] mt-0.5">
                            {n.message}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-[#86868b]">
                          {formatDate(n.createdAt)}
                        </span>
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-[#e63462]" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === "audit" && (
            <>
              <div className="flex gap-1.5 flex-wrap">
                {AUDIT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setAuditFilter(cat)}
                    className={`h-[28px] px-3 rounded-lg text-[11px] font-medium transition-colors ${
                      auditFilter === cat
                        ? "bg-[#e63462] text-white"
                        : "bg-white border border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    {categoryLabels[cat] || cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: "all", label: "Tum tarih" },
                  { id: "today", label: "Bugun" },
                  { id: "7d", label: "Son 7 gun" },
                  { id: "30d", label: "Son 30 gun" },
                  { id: "custom", label: "Tarih sec" },
                ].map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setDatePreset(x.id as typeof datePreset)}
                    className={`h-[28px] px-3 rounded-lg text-[11px] font-medium transition-colors ${
                      datePreset === x.id
                        ? "bg-[#e63462] text-white"
                        : "bg-white border border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    {x.label}
                  </button>
                ))}
                {datePreset === "custom" && (
                  <>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-[28px] px-2 text-[11px] bg-white border border-[#d1d1d6]/60 rounded-lg text-[#1d1d1f]"
                    />
                    <span className="text-[11px] text-[#86868b]">-</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-[28px] px-2 text-[11px] bg-white border border-[#d1d1d6]/60 rounded-lg text-[#1d1d1f]"
                    />
                  </>
                )}
              </div>

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                        Tarih
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                        Kullanici
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                        Islem
                      </th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                        Baslik
                      </th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                        Kategori
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                        Detay
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.slice(0, 250).map((log, idx) => (
                      <tr
                        key={log.id}
                        className={`border-b border-[#f0f0f0] ${
                          idx % 2 === 1 ? "bg-[#fafafa]" : ""
                        }`}
                      >
                        <td className="px-4 py-2 text-[12px] text-[#86868b] whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f] capitalize">
                          {log.userName}
                        </td>
                        <td className="px-4 py-2 text-[12px] text-[#1d1d1f]">
                          {log.action}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b] capitalize">
                            {actionGroupLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b] capitalize">
                            {log.category}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[12px] text-[#86868b] max-w-[420px]">
                          <div className="truncate">{log.details}</div>
                          {log.metadata && (
                            <div className="text-[10px] text-[#a0a0a6] mt-0.5 truncate">
                              {JSON.stringify(log.metadata)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-[12px] text-[#86868b]"
                        >
                          Bu filtrelerde kayit bulunamadi.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
