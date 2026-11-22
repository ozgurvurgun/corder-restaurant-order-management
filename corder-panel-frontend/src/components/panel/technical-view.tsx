import { useState, useMemo, useEffect } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"
import { showPanelToast } from "./panel-toast"
import {
  Bell,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { computeDateFilterBounds, formatIstanbulDateTime, formatTitleCase } from "@/lib/format"
import { CustomDatePicker } from "@/components/ui/custom-inputs"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { SecurityFraudTab } from "./security-fraud-tab"
import { PrintAgentDownloadCard } from "./settings/print-agent-download-card"

type TechnicalTab = "notifications" | "printers" | "security" | "audit"

const AUDIT_CATEGORIES = ["all", "auth", "order", "payment", "product", "user", "settings", "stock", "cash-register", "table"]

const categoryLabels: Record<string, string> = {
  all: "Tümü",
  auth: "Giriş",
  order: "Sipariş",
  payment: "Ödeme",
  product: "Ürün",
  user: "Kullanıcı",
  settings: "Ayarlar",
  stock: "Stok",
  "cash-register": "Kasa",
  table: "Masa",
}

function actionGroupLabel(action: string): string {
  if (action.startsWith("product_")) return "Ürün"
  if (action.startsWith("category_")) return "Kategori"
  if (action.startsWith("table_")) return "Masa"
  if (action.startsWith("order_")) return "Sipariş"
  if (action.startsWith("supplier_")) return "Tedarikçi"
  if (action.startsWith("material_") || action.startsWith("stock_")) return "Stok"
  if (action.startsWith("ledger_") || action.startsWith("open_account_")) return "Cari"
  if (action.startsWith("shift_") || action.startsWith("cash_")) return "Kasa"
  if (action.startsWith("printer_")) return "Yazıcı"
  if (action.startsWith("campaign_")) return "Kampanya"
  if (action.startsWith("settings_")) return "Ayar"
  if (action.startsWith("branch_")) return "Şube"
  if (action.startsWith("discount_") || action.startsWith("bill_")) return "Ödeme"
  return "Diğer"
}

export default function TechnicalView() {
  const { notifications, markNotificationRead, markAllNotificationsRead, dismissNotification, clearAllNotifications, auditLogs, printers: storePrinters, testPrinter, currentUser, hasPermission } = usePanelStore()
  const { token } = usePanelAuth()

  const isBoss = currentUser?.role === "root"
  const canManagePrinters = isBoss || hasPermission("system.manage_printers")
  const canViewAuditLogs = isBoss || hasPermission("reports.view_audit_logs")
  const canViewFraudAlerts =
    isBoss || hasPermission("security.view_fraud_alerts", "security.manage_fraud_alerts")
  const canManageFraudAlerts = isBoss || hasPermission("security.manage_fraud_alerts")

  const [activeTab, setActiveTab] = useState<TechnicalTab>("notifications")
  const [auditFilter, setAuditFilter] = useState<string>("all")
  const [datePreset, setDatePreset] = useState<"all" | "today" | "7d" | "30d" | "custom">("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [notifPage, setNotifPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [localPrinters, setLocalPrinters] = useState(storePrinters)
  const [refreshingPrinters, setRefreshingPrinters] = useState(false)

  useEffect(() => {
    setLocalPrinters(storePrinters)
  }, [storePrinters])

  useEffect(() => {
    if (activeTab !== "printers" || !token) return
    api.printers
      .list(token)
      .then((prs) => {
        setLocalPrinters(
          prs.map((p) => ({
            id: p.id,
            name: formatTitleCase(p.name),
            type: p.type,
            connection: p.connection,
            ipAddress: p.ipAddress ?? undefined,
            port: p.port ?? undefined,
            department: p.department ? formatTitleCase(p.department) : undefined,
            status: p.status,
            paperWidth: p.paperWidth === 58 ? 58 : 80,
            autoCut: p.autoCut,
          })),
        )
      })
      .catch(() => undefined)
  }, [activeTab, token])

  useEffect(() => {
    setAuditPage(1)
  }, [auditFilter, datePreset, fromDate, toDate])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const handleRefreshPrinters = async () => {
    if (!token || refreshingPrinters) return
    setRefreshingPrinters(true)
    try {
      const prs = await api.printers.list(token)
      setLocalPrinters(
        prs.map((p) => ({
          id: p.id,
          name: formatTitleCase(p.name),
          type: p.type,
          connection: p.connection,
          ipAddress: p.ipAddress ?? undefined,
          port: p.port ?? undefined,
          department: p.department ? formatTitleCase(p.department) : undefined,
          status: p.status,
          paperWidth: p.paperWidth === 58 ? 58 : 80,
          autoCut: p.autoCut,
        })),
      )
      showPanelToast("Print Agent yazıcı listesi yenilendi", "success")
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Yazıcı listesi alınamadı", "error")
    } finally {
      setRefreshingPrinters(false)
    }
  }

  const TABS = useMemo(() => {
    const list: { id: TechnicalTab; label: string; icon: typeof Bell }[] = [
      { id: "notifications", label: `Bildirimler${unreadCount > 0 ? ` (${unreadCount})` : ""}`, icon: Bell },
    ]
    if (canManagePrinters) list.push({ id: "printers", label: `Yazıcılar (${localPrinters.length})`, icon: Printer })
    if (canViewFraudAlerts) list.push({ id: "security", label: "Güvenlik & Suistimal Tespiti", icon: ShieldAlert })
    if (canViewAuditLogs) list.push({ id: "audit", label: "Aktivite Logları", icon: Shield })
    return list
  }, [unreadCount, canManagePrinters, localPrinters.length, canViewFraudAlerts, canViewAuditLogs])

  useEffect(() => {
    if (TABS.length > 0 && !TABS.some((t) => t.id === activeTab)) {
      setActiveTab(TABS[0].id)
    }
  }, [TABS, activeTab])

  const filteredLogs = useMemo(() => {
    const presetMap = datePreset === "7d" ? "week" : datePreset === "30d" ? "month" : datePreset
    const bounds = computeDateFilterBounds(presetMap, fromDate, toDate)
    return auditLogs.filter((l) => {
      if (auditFilter !== "all" && l.category !== auditFilter) return false
      if (!bounds) return true
      const d = new Date(l.createdAt)
      return d >= bounds.from && d <= bounds.to
    })
  }, [auditLogs, auditFilter, datePreset, fromDate, toDate])

  const notifPageSize = 10
  const auditPageSize = 12
  const paginatedNotifs = useMemo(
    () => notifications.slice((notifPage - 1) * notifPageSize, notifPage * notifPageSize),
    [notifications, notifPage],
  )
  const paginatedLogs = useMemo(
    () => filteredLogs.slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize),
    [filteredLogs, auditPage],
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-3.5 sm:px-5 py-2.5 flex gap-1.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors flex-shrink-0 flex items-center gap-1.5 ${
              activeTab === tab.id ? "bg-[#e63462] text-white" : "text-[#86868b] hover:bg-black/[0.04]"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3.5 sm:p-5">
        <div className="w-full flex flex-col gap-4">
          {activeTab === "notifications" && (
            <>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <p className="text-[12px] text-[#86868b]">
                  {notifications.length} bildirim ({unreadCount} okunmamış)
                </p>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button onClick={markAllNotificationsRead} className="text-[12px] font-medium text-[#e63462] hover:underline">
                      Tümünü Okundu İşaretle
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      className="h-[28px] px-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Tümünü Temizle
                    </button>
                  )}
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#d1d1d6]/60 py-14 text-center">
                  <Bell className="w-9 h-9 text-[#d1d1d6] mx-auto mb-2" />
                  <p className="text-[13px] text-[#86868b]">Aktif bildirim bulunmuyor.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {paginatedNotifs.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`w-full text-left bg-white rounded-xl border p-4 transition-colors hover:bg-[#f9f9fb] cursor-pointer ${
                        n.read ? "border-[#d1d1d6]/60 opacity-65" : "border-[#e63462]/30 bg-[#e63462]/[0.02]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              n.type === "stock-low"
                                ? "bg-amber-50"
                                : n.type === "waiter-call"
                                  ? "bg-[#e63462]/10"
                                  : n.type === "fraud-alert" || n.type === "kitchen-alert"
                                    ? "bg-red-50"
                                    : n.type === "system"
                                      ? "bg-blue-50"
                                      : "bg-green-50"
                            }`}
                          >
                            {n.type === "stock-low" ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            ) : n.type === "waiter-call" ? (
                              <Bell className="w-3.5 h-3.5 text-[#e63462]" />
                            ) : n.type === "fraud-alert" || n.type === "kitchen-alert" ? (
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                            ) : n.type === "system" ? (
                              <Shield className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-[13px] font-semibold text-[#1d1d1f]">{n.title}</h4>
                            <p className="text-[12px] text-[#86868b] mt-0.5">{n.message}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-[#86868b]">{formatIstanbulDateTime(n.createdAt)}</span>
                          {!n.read && <div className="w-2 h-2 rounded-full bg-[#e63462]" />}
                          <button
                            type="button"
                            title="Bildirimi Sil"
                            onClick={(e) => {
                              e.stopPropagation()
                              dismissNotification(n.id)
                            }}
                            className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50 text-[#86868b] hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <PaginationBar
                    currentPage={notifPage}
                    totalItems={notifications.length}
                    pageSize={notifPageSize}
                    onPageChange={setNotifPage}
                    itemLabel="bildirim"
                  />
                </div>
              )}
            </>
          )}

          {activeTab === "printers" && canManagePrinters && (
            <div className="space-y-4">
              <PrintAgentDownloadCard />
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Print Agent Masaüstü Uygulaması Yazıcıları</h3>
                  <p className="text-[12px] text-[#86868b] mt-0.5">Yazıcılar şube bilgisayarındaki Corder Print Agent masaüstü uygulamasından otomatik eşitlenir (salt-okunur).</p>
                </div>
                <button type="button" disabled={refreshingPrinters} onClick={() => void handleRefreshPrinters()} className="h-[32px] px-3.5 flex items-center gap-1.5 bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#d1d1d6]/60 text-[#1d1d1f] rounded-lg text-[12px] font-medium disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingPrinters ? "animate-spin" : ""}`} /> Listeyi Yenile
                </button>
              </div>

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Yazıcı Adı</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Görev / Tür</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Bağlantı &amp; Cihaz/IP</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Kağıt Genişliği</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Durum</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localPrinters.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-[12px] text-[#86868b]">
                          Print Agent masaüstü uygulamasından eşitlenmiş yazıcı bulunmuyor. Şube bilgisayarında Print Agent uygulamasını açıp yazıcı eşleştirmesi yapın.
                        </td>
                      </tr>
                    ) : (
                      localPrinters.map((pr, idx) => (
                        <tr key={pr.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                          <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{pr.name}</td>
                          <td className="px-4 py-2.5 text-[12px] text-[#86868b]">
                            {pr.type === "kitchen"
                              ? "Mutfak"
                              : pr.type === "bar"
                                ? "Bar"
                                : pr.type === "receipt" || pr.type === "cashier"
                                  ? "Kasa Fişi"
                                  : "Etiket"}
                          </td>
                          <td className="px-4 py-2.5 text-[12px] text-[#86868b]">
                            {pr.connection === "network"
                              ? `Ağ • ${pr.ipAddress || "-"}:${pr.port || 9100}`
                              : `${pr.connection.toUpperCase()}${pr.department ? ` • ${pr.department}` : ""}`}
                          </td>
                          <td className="px-4 py-2.5 text-center text-[12px] font-medium text-[#1d1d1f]">
                            {pr.paperWidth}mm
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                                pr.status === "online" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${pr.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
                              {pr.status === "online" ? "Çevrimiçi" : "Çevrimdışı"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => testPrinter(pr.id)}
                              className="h-[28px] px-3 rounded-lg bg-[#1d1d1f] text-[11px] font-medium text-white hover:bg-[#3a3a3c]"
                            >
                              Test Fişi Gönder
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "security" && canViewFraudAlerts && (
            <SecurityFraudTab canManageAlerts={canManageFraudAlerts} />
          )}

          {activeTab === "audit" && canViewAuditLogs && (
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
                  { id: "all", label: "Tüm Tarihler" },
                  { id: "today", label: "Bugün" },
                  { id: "7d", label: "Son 7 Gün" },
                  { id: "30d", label: "Son 30 Gün" },
                  { id: "custom", label: "Tarih Seç" },
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
                    <CustomDatePicker value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-[28px] px-2.5 text-[11px] bg-white border border-[#d1d1d6]/60 rounded-lg text-[#1d1d1f]" />
                    <span className="text-[11px] text-[#86868b]">-</span>
                    <CustomDatePicker value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-[28px] px-2.5 text-[11px] bg-white border border-[#d1d1d6]/60 rounded-lg text-[#1d1d1f]" />
                  </>
                )}
              </div>

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tarih</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kullanıcı</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">İşlem</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Başlık</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kategori</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Detay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map((log, idx) => (
                      <tr key={log.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                        <td className="px-4 py-2 text-[12px] text-[#86868b] whitespace-nowrap">
                          {formatIstanbulDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">{log.userName}</td>
                        <td className="px-4 py-2 text-[12px] text-[#1d1d1f]">{log.action}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b]">
                            {actionGroupLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b]">
                            {categoryLabels[log.category] || log.category}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[12px] text-[#86868b] max-w-[420px]">
                          <div className="truncate">{log.details}</div>
                          {log.metadata && (
                            <div className="text-[10px] text-[#a0a0a6] mt-0.5 truncate">{JSON.stringify(log.metadata)}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[12px] text-[#86868b]">Bu filtrelerde kayıt bulunamadı.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="px-4 pb-3">
                  <PaginationBar
                    currentPage={auditPage}
                    totalItems={filteredLogs.length}
                    pageSize={auditPageSize}
                    onPageChange={setAuditPage}
                    itemLabel="işlem kaydı"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
