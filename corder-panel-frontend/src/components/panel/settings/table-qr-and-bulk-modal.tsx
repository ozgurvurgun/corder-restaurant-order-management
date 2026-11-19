import { useState, useMemo } from "react"
import {
  Bell,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  Printer,
  QrCode,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react"
import type { PanelSection, PanelTable } from "@/lib/panel-types"
import { showPanelToast } from "../panel-toast"
import {
  getBrowserNotificationPermission,
  getNotificationPrefs,
  requestBrowserNotificationPermission,
  saveNotificationPrefs,
  showBrowserNotification,
  type NotificationPrefs,
} from "@/lib/notification-sound"

export function BulkCreateTablesModal(props: {
  sections: PanelSection[]
  onClose: () => void
  onBulkCreate: (body: {
    section: string
    prefix: string
    startNumber: number
    count: number
    capacity?: number
  }) => Promise<PanelTable[]>
}) {
  const { sections, onClose, onBulkCreate } = props
  const [section, setSection] = useState(sections[0]?.name || "Bahçe")
  const [prefix, setPrefix] = useState("B")
  const [startNumber, setStartNumber] = useState("1")
  const [count, setCount] = useState("20")
  const [capacity, setCapacity] = useState("4")
  const [busy, setBusy] = useState(false)

  const parsedStart = Math.max(1, parseInt(startNumber, 10) || 1)
  const parsedCount = Math.min(100, Math.max(1, parseInt(count, 10) || 1))
  const parsedCapacity = Math.max(1, parseInt(capacity, 10) || 4)
  const cleanPrefix = prefix.trim()

  const previewList = useMemo(
    () => Array.from({ length: parsedCount }, (_, i) => `${cleanPrefix}${parsedStart + i}`),
    [cleanPrefix, parsedStart, parsedCount],
  )

  const previewText = useMemo(() => {
    if (previewList.length <= 6) {
      return `${previewList.join(", ")} — ${previewList.length} masa oluşturulacak`
    }
    return `${previewList.slice(0, 3).join(", ")} ... ${previewList[previewList.length - 1]} — ${previewList.length} masa oluşturulacak`
  }, [previewList])

  const handleSubmit = async () => {
    if (!section.trim() || busy) return
    setBusy(true)
    try {
      const created = await onBulkCreate({
        section: section.trim(),
        prefix: cleanPrefix,
        startNumber: parsedStart,
        count: parsedCount,
        capacity: parsedCapacity,
      })
      if (created.length > 0) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[460px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#e63462]" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Çoklu Masa Oluştur (Otomatik Seri)</h3>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3.5 text-[13px]">
          <div>
            <label className="text-[11px] font-medium text-[#86868b] mb-1 block">Bölge / Salon Adı (Örn: Bahçe, Teras, Salon)</label>
            <input
              type="text"
              list="corder-bulk-sections"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Bahçe"
              className="w-full h-[38px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
            />
            <datalist id="corder-bulk-sections">
              {sections.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#86868b] mb-1 block">Ön Ek (Örn: B, T, M)</label>
              <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="B" className="w-full h-[38px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#86868b] mb-1 block">Başlangıç No</label>
              <input type="number" min={1} value={startNumber} onChange={(e) => setStartNumber(e.target.value)} className="w-full h-[38px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#86868b] mb-1 block">Masa Adedi (1 - 100)</label>
              <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} className="w-full h-[38px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#86868b] mb-1 block">Kapasite (Kişi)</label>
              <input type="number" min={1} max={50} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full h-[38px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
            </div>
          </div>

          <div className="rounded-xl bg-[#f5f5f7] border border-[#d1d1d6]/50 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] block mb-1">
              Canlı Önizleme ({section || "Bölge"})
            </span>
            <p className="text-[12px] font-semibold text-[#1d1d1f]">{previewText}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b]">
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy || !section.trim()}
            onClick={() => void handleSubmit()}
            className="flex-1 h-[38px] rounded-xl bg-[#e63462] text-white text-[13px] font-semibold hover:bg-[#d42d56] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Oluşturuluyor…</> : `${parsedCount} Masayı Oluştur`}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TableQrCodesModal(props: {
  restaurantName: string
  restaurantSlug: string
  tables: PanelTable[]
  onClose: () => void
}) {
  const { restaurantName, restaurantSlug, tables, onClose } = props
  const slug = restaurantSlug || "restoran"
  const generalMenuUrl = `https://menu.corders.uk/?restaurant=${encodeURIComponent(slug)}`
  const buildTableUrl = (t: PanelTable) =>
    `https://menu.corders.uk/?restaurant=${encodeURIComponent(slug)}&t=${encodeURIComponent(t.qrToken || t.id)}`

  const copyUrl = (url: string, label: string) => {
    void navigator.clipboard?.writeText(url)
    showPanelToast(`${label} bağlantısı kopyalandı`, "success")
  }

  const handlePrintAllQrCodes = () => {
    const win = window.open("", "_blank")
    if (!win) return
    const cardsHtml = tables
      .map((t) => {
        const url = buildTableUrl(t)
        const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`
        return `<div class="card"><div class="brand">${restaurantName || "Restoran"}</div><div class="section">${t.section}</div><div class="table">${t.name}</div><img src="${qrImg}" alt="${t.name}" width="160" height="160" /><div class="hint">Menüyü görmek ve garson çağırmak için okutun</div></div>`
      })
      .join("")
    win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Masa QR Kodları — ${restaurantName}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;color:#1d1d1f}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{border:1.5px solid #d1d1d6;border-radius:16px;padding:16px;text-align:center;page-break-inside:avoid}.brand{font-size:12px;font-weight:600;color:#86868b}.section{font-size:11px;color:#e63462;font-weight:600;margin-top:2px}.table{font-size:20px;font-weight:800;margin:4px 0 10px}.hint{font-size:10px;color:#636366;margin-top:8px}</style></head><body><div class="grid">${cardsHtml}</div><script>window.onload=()=>setTimeout(()=>window.print(),400);</script></body></html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[680px] max-h-[86vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#e63462]" />
            <div>
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Masaya Özel İmzalı QR Kodlar (Garson Çağrılı)</h3>
              <p className="text-[11px] text-[#86868b]">
                Her masanın kriptografik imzalı QR bağlantısı yalnızca o masa için garson çağrısını aktif eder.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePrintAllQrCodes} className="h-[32px] px-3 rounded-lg bg-[#1d1d1f] text-white text-[12px] font-medium hover:bg-[#3a3a3c] flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Masa QR Kodlarını Yazdır
            </button>
            <button type="button" onClick={onClose} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
              <X className="w-3.5 h-3.5 text-[#86868b]" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="rounded-xl bg-[#f5f5f7] border border-[#d1d1d6]/60 p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                Genel QR Menü (Masasız — Garson Çağrısı Gizli)
              </span>
              <p className="text-[12px] font-mono text-[#1d1d1f] truncate mt-0.5">{generalMenuUrl}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button type="button" onClick={() => copyUrl(generalMenuUrl, "Genel QR Menü")} className="h-[28px] px-2.5 rounded-lg bg-white border border-[#d1d1d6]/60 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] flex items-center gap-1">
                <Copy className="w-3 h-3" /> Kopyala
              </button>
              <a href={generalMenuUrl} target="_blank" rel="noreferrer" className="h-[28px] px-2.5 rounded-lg bg-white border border-[#d1d1d6]/60 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Aç
              </a>
            </div>
          </div>

          <div className="border border-[#d1d1d6]/60 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Masa</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Bölüm</th>
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">İmzalı QR Bağlantısı</th>
                  <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((t, idx) => {
                  const url = buildTableUrl(t)
                  return (
                    <tr key={t.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                      <td className="px-4 py-2 text-[13px] font-semibold text-[#1d1d1f]">{t.name}</td>
                      <td className="px-4 py-2 text-[12px] text-[#86868b]">{t.section}</td>
                      <td className="px-4 py-2 text-[11px] font-mono text-[#636366] max-w-[280px] truncate">{url}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => copyUrl(url, t.name)} className="h-[26px] px-2.5 rounded bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[11px] font-medium text-[#1d1d1f] flex items-center gap-1">
                            <Copy className="w-3 h-3" /> Kopyala
                          </button>
                          <a href={url} target="_blank" rel="noreferrer" className="h-[26px] px-2 rounded bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[11px] font-medium text-[#1d1d1f] flex items-center">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NotificationSoundSettingsCard() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => getNotificationPrefs())
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() =>
    getBrowserNotificationPermission(),
  )

  const updatePref = (patch: Partial<NotificationPrefs>) => {
    setPrefs(saveNotificationPrefs(patch))
  }

  const handleRequestPush = async () => {
    const nextPerm = await requestBrowserNotificationPermission()
    setPerm(nextPerm)
    setPrefs(getNotificationPrefs())
    if (nextPerm === "granted") {
      showPanelToast("Push bildirim izni verildi", "success")
    } else if (nextPerm === "denied") {
      showPanelToast("Bildirim izni reddedildi. Tarayıcı adres çubuğundan izin verebilirsiniz.", "error")
    } else {
      showPanelToast("Bildirim izni durumu: " + nextPerm, "info")
    }
  }

  const handleTestPush = async () => {
    let currentPerm = getBrowserNotificationPermission()
    if (currentPerm !== "granted") {
      currentPerm = await requestBrowserNotificationPermission()
      setPerm(currentPerm)
      setPrefs(getNotificationPrefs())
    }
    if (currentPerm === "granted") {
      updatePref({ browserPushEnabled: true })
      showBrowserNotification(
        "🔔 Masa 1 (Salon) — Garson Çağırıyor!",
        "Standart Push bildirimi ve sistem bildirim sesi aktif.",
        `corder-test-${Date.now()}`,
      )
      showPanelToast("Test Push bildirimi gönderildi", "success")
    } else {
      showPanelToast("Push bildirimi için tarayıcı bildirim izni gereklidir.", "error")
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#e63462]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              Anlık Push Bildirim Ayarları (Garson Çağrısı &amp; Uyarılar)
            </h3>
            <p className="text-[11px] text-[#86868b]">
              Masalardan gelen QR garson çağrıları ve güvenlik uyarıları standart cihaz/tarayıcı Push bildirimi ve sistem bildirim sesi ile iletilir.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleTestPush()}
            className="h-[30px] px-3 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#d1d1d6]/60 text-[12px] font-medium text-[#1d1d1f] flex items-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5 text-[#e63462]" /> Push Bildirimini Test Et
          </button>
          {perm !== "granted" && (
            <button
              type="button"
              onClick={() => void handleRequestPush()}
              className="h-[30px] px-3 rounded-lg bg-[#1d1d1f] hover:bg-[#3a3a3c] text-[12px] font-medium text-white flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" /> Bildirim İzni İste
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
          <div>
            <p className="text-[13px] font-medium text-[#1d1d1f]">Garson Çağrısı Bildirimi</p>
            <p className="text-[11px] text-[#86868b]">QR menüden gelen çağrıları bildirim olarak al</p>
          </div>
          <button type="button" onClick={() => updatePref({ waiterCallEnabled: !prefs.waiterCallEnabled })}>
            {prefs.waiterCallEnabled ? <ToggleRight className="w-8 h-8 text-[#e63462]" /> : <ToggleLeft className="w-8 h-8 text-[#d1d1d6]" />}
          </button>
        </div>

        <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
          <div>
            <p className="text-[13px] font-medium text-[#1d1d1f]">Standart Push Bildirimi (Sistem Sesi)</p>
            <p className="text-[11px] text-[#86868b]">
              Durum: {perm === "granted" ? (prefs.browserPushEnabled ? "Aktif (İzin Verildi)" : "Kapalı") : perm === "denied" ? "Engellendi" : "İzin Bekliyor"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (perm !== "granted") {
                void handleRequestPush()
              } else {
                updatePref({ browserPushEnabled: !prefs.browserPushEnabled })
              }
            }}
          >
            {perm === "granted" && prefs.browserPushEnabled ? (
              <ToggleRight className="w-8 h-8 text-[#34c759]" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-[#d1d1d6]" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
