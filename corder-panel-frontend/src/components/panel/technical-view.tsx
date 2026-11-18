import { useState, useMemo, useEffect } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { Bell, Shield, CheckCircle2, XCircle, AlertTriangle, Printer, Plus, Trash2 } from "lucide-react"
import type { PrinterConfig } from "@/lib/panel-types"
import { computeDateFilterBounds, formatIstanbulDateTime } from "@/lib/format"

type TechnicalTab = "notifications" | "printers" | "audit"

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
  if (action.startsWith("material_") || action.startsWith("stock_"))
    return "Stok"
  if (action.startsWith("ledger_") || action.startsWith("open_account_"))
    return "Cari"
  if (action.startsWith("shift_") || action.startsWith("cash_")) return "Kasa"
  if (action.startsWith("printer_")) return "Yazıcı"
  if (action.startsWith("campaign_")) return "Kampanya"
  if (action.startsWith("settings_")) return "Ayar"
  if (action.startsWith("branch_")) return "Şube"
  if (action.startsWith("discount_") || action.startsWith("bill_"))
    return "Ödeme"
  return "Diğer"
}

export default function TechnicalView() {
  const { notifications, markNotificationRead, markAllNotificationsRead, auditLogs, printers, addPrinter, updatePrinter, deletePrinter, testPrinter, currentUser, hasPermission } = usePanelStore()

  const isBoss = currentUser?.role === "root"
  const canManagePrinters = isBoss || hasPermission("system.manage_printers")
  const canViewAuditLogs = isBoss || hasPermission("reports.view_audit_logs")

  const [activeTab, setActiveTab] = useState<TechnicalTab>("notifications")
  const [auditFilter, setAuditFilter] = useState<string>("all")
  const [datePreset, setDatePreset] = useState<
    "all" | "today" | "7d" | "30d" | "custom"
  >("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  // Printer form state
  const [showAddPrinter, setShowAddPrinter] = useState(false)
  const [pName, setPName] = useState("")
  const [pType, setPType] = useState<PrinterConfig["type"]>("kitchen")
  const [pConn, setPConn] = useState<PrinterConfig["connection"]>("network")
  const [pIp, setPIp] = useState("")
  const [pPort, setPPort] = useState("9100")
  const [pPaper, setPPaper] = useState<58 | 80>(80)

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const TABS = useMemo(() => {
    const list: {
      id: TechnicalTab
      label: string
      icon: typeof Bell
    }[] = [
      {
        id: "notifications",
        label: `Bildirimler${unreadCount > 0 ? ` (${unreadCount})` : ""}`,
        icon: Bell,
      },
    ]
    if (canManagePrinters) {
      list.push({
        id: "printers",
        label: `Yazıcılar (${printers.length})`,
        icon: Printer,
      })
    }
    if (canViewAuditLogs) {
      list.push({ id: "audit", label: "Aktivite Logları", icon: Shield })
    }
    return list
  }, [unreadCount, canManagePrinters, printers.length, canViewAuditLogs])

  useEffect(() => {
    if (TABS.length > 0 && !TABS.some((t) => t.id === activeTab)) {
      setActiveTab(TABS[0].id)
    }
  }, [TABS, activeTab])

  const filteredLogs = useMemo(() => {
    const presetMap =
      datePreset === "7d"
        ? "week"
        : datePreset === "30d"
          ? "month"
          : datePreset
    const bounds = computeDateFilterBounds(presetMap, fromDate, toDate)

    return auditLogs.filter((l) => {
      if (auditFilter !== "all" && l.category !== auditFilter) return false
      if (!bounds) return true
      const d = new Date(l.createdAt)
      return d >= bounds.from && d <= bounds.to
    })
  }, [auditLogs, auditFilter, datePreset, fromDate, toDate])

  const handleAddPrinter = () => {
    if (!pName.trim()) return
    const parsedPort = parseInt(pPort, 10)
    addPrinter({
      name: pName.trim(),
      type: pType,
      connection: pConn,
      ipAddress: pConn === "network" ? pIp.trim() || undefined : undefined,
      port:
        pConn === "network" && Number.isFinite(parsedPort) ? parsedPort : 9100,
      status: "online",
      paperWidth: pPaper,
      autoCut: true,
    })
    setPName("")
    setPIp("")
    setShowAddPrinter(false)
  }

  return (
    <div className="h-full flex flex-col">
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
        <div className="w-full flex flex-col gap-4">
          {activeTab === "notifications" && (
            <>
              <div className="flex justify-between items-center">
                <p className="text-[12px] text-[#86868b]">
                  {unreadCount} okunmamış bildirim
                </p>
                {unreadCount > 0 && (
                  <button onClick={markAllNotificationsRead} className="text-[12px] font-medium text-[#e63462] hover:underline">Tümünü Okundu İşaretle</button>
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
                          {formatIstanbulDateTime(n.createdAt)}
                        </span>
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-[#e63462]" />)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === "printers" && canManagePrinters && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-[#86868b]">Şube yazıcılarını tanımlayın ve bağlantılarını test edin.</p>
                <button type="button" onClick={() => setShowAddPrinter((v) => !v)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56]">
                  <Plus className="w-3.5 h-3.5" /> Yazıcı Ekle
                </button>
              </div>

              {showAddPrinter && (
                <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <input type="text" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Yazıcı adı (Örn: Mutfak)" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60" />
                    <select value={pType} onChange={(e) => setPType(e.target.value as PrinterConfig["type"]) } className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60">
                      <option value="kitchen">Mutfak</option>
                      <option value="bar">Bar</option>
                      <option value="receipt">Adisyon / Kasa</option>
                      <option value="label">Etiket</option>
                    </select>
                    <select value={pConn} onChange={(e) => setPConn(e.target.value as PrinterConfig["connection"]) } className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60">
                      <option value="network">Ağ (IP/TCP)</option>
                      <option value="usb">USB</option>
                      <option value="bluetooth">Bluetooth</option>
                    </select>
                  </div>
                  {pConn === "network" && (
                    <div className="grid grid-cols-3 gap-3">
                      <input type="text" value={pIp} onChange={(e) => setPIp(e.target.value)} placeholder="IP Adresi (Örn: 192.168.1.200)" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60" />
                      <input type="number" value={pPort} onChange={(e) => setPPort(e.target.value)} placeholder="Port (9100)" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60" />
                      <select value={pPaper} onChange={(e) => setPPaper(Number(e.target.value) as 58 | 80) } className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60">
                        <option value={80}>80mm Kağıt</option>
                        <option value={58}>58mm Kağıt</option>
                      </select>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAddPrinter(false)} className="h-[32px] px-3 text-[12px] text-[#86868b] rounded-lg border border-[#d1d1d6]/60">
                      İptal
                    </button>
                    <button type="button" onClick={handleAddPrinter} className="h-[32px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg">Kaydet</button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Yazıcı</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Tür</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Bağlantı</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Durum</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[#86868b]">Henüz kayıtlı yazıcı bulunmuyor.</td>
                      </tr>
                    ) : (
                      printers.map((pr, idx) => (
                        <tr key={pr.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                          <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">
                            {pr.name}
                          </td>
                          <td className="px-4 py-2.5 text-[12px] text-[#86868b]">
                            {pr.type === "kitchen"
                              ? "Mutfak"
                              : pr.type === "bar"
                                ? "Bar"
                                : pr.type === "receipt"
                                  ? "Adisyon"
                                  : "Etiket"}{" "}
                            ({pr.paperWidth}mm)
                          </td>
                          <td className="px-4 py-2.5 text-[12px] text-[#86868b]">
                            {pr.connection === "network"
                              ? `${pr.ipAddress || "-"}:${pr.port || 9100}`
                              : pr.connection.toUpperCase()}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                updatePrinter(pr.id, {
                                  status:
                                    pr.status === "online"
                                      ? "offline"
                                      : "online",
                                })
                              }
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                pr.status === "online"
                                  ? "bg-green-50 text-green-600"
                                  : "bg-red-50 text-red-500"
                              }`}
                            >
                              {pr.status === "online"
                                ? "Çevrimiçi"
                                : "Çevrimdışı"}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => testPrinter(pr.id)} className="h-[26px] px-2.5 rounded bg-[#f5f5f7] text-[11px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed]">
                                Test Et
                              </button>
                              <button type="button" onClick={() => deletePrinter(pr.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50">
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-[28px] px-2 text-[11px] bg-white border border-[#d1d1d6]/60 rounded-lg text-[#1d1d1f]" />
                    <span className="text-[11px] text-[#86868b]">-</span>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-[28px] px-2 text-[11px] bg-white border border-[#d1d1d6]/60 rounded-lg text-[#1d1d1f]" />
                  </>
                )}
              </div>

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <table className="w-full">
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
                    {filteredLogs.slice(0, 250).map((log, idx) => (
                      <tr key={log.id} className={`border-b border-[#f0f0f0] ${ idx % 2 === 1 ? "bg-[#fafafa]" : "" }`}>
                        <td className="px-4 py-2 text-[12px] text-[#86868b] whitespace-nowrap">
                          {formatIstanbulDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">
                          {log.userName}
                        </td>
                        <td className="px-4 py-2 text-[12px] text-[#1d1d1f]">
                          {log.action}
                        </td>
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
                            <div className="text-[10px] text-[#a0a0a6] mt-0.5 truncate">
                              {JSON.stringify(log.metadata)}
                            </div>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
