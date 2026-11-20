import { useMemo, useState } from "react"
import {
  Check, Copy, Download, ExternalLink, Printer, QrCode, Scissors, Sparkles, X,
} from "lucide-react"
import type { PanelTable } from "@/lib/panel-types"
import { generateQrDataUri } from "@/lib/qr-svg"
import {
  buildPrintableQrDocumentHtml, buildStandaloneVectorCardSvg, DEFAULT_QR_DESCRIPTION,
  downloadVectorSvgFile, loadQrStudioPreferences, QR_CARD_SIZES, QR_DESCRIPTION_PRESETS,
  QR_DESIGN_TEMPLATES, QR_PRINT_MEDIUMS, saveQrStudioPreferences,
  type QrCardSizeId, type QrDesignTemplateId, type QrPrintMediumId, type QrStudioPreferences,
} from "@/lib/qr-print-studio"
import { showPanelToast } from "../panel-toast"

export function TableQrCodesModal(props: {
  restaurantName: string
  restaurantSlug: string
  tables: PanelTable[]
  onClose: () => void
}) {
  const { restaurantSlug, tables, onClose } = props
  const slug = restaurantSlug || "restoran"
  const generalMenuUrl = `https://menu.corders.uk/?restaurant=${encodeURIComponent(slug)}`

  const [prefs, setPrefs] = useState<QrStudioPreferences>(() => loadQrStudioPreferences(slug))
  const [sectionFilter, setSectionFilter] = useState<string>("ALL")

  const updatePrefs = (patch: Partial<QrStudioPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveQrStudioPreferences(next, slug)
      return next
    })
  }

  const sections = useMemo(
    () => Array.from(new Set(tables.map((t) => t.section).filter(Boolean))),
    [tables],
  )
  const filteredTables = useMemo(
    () => (sectionFilter === "ALL" ? tables : tables.filter((t) => t.section === sectionFilter)),
    [tables, sectionFilter],
  )

  const buildTableUrl = (t: PanelTable): string | null => {
    const token = t.qrToken?.trim()
    if (!token) return null
    return `https://menu.corders.uk/?restaurant=${encodeURIComponent(slug)}&t=${encodeURIComponent(token)}`
  }

  const previewTable = filteredTables[0] ?? tables[0] ?? {
    id: "preview", name: "B1", section: "Bahçe", status: "empty" as const, totalAmount: 0, orderCount: 0,
  }
  const previewUrl = buildTableUrl(previewTable) || generalMenuUrl
  const previewQrUri = useMemo(
    () => generateQrDataUri(previewUrl, 220, 3, "#000000", "#ffffff"),
    [previewUrl],
  )

  const isLaser = prefs.printMedium === "laser" || prefs.designTemplate === "laser-stencil"
  const isDark = !isLaser && prefs.designTemplate === "dark-card"
  const cleanDesc = prefs.descriptionText.trim()

  const copyUrl = (url: string, label: string) => {
    void navigator.clipboard?.writeText(url)
    showPanelToast(`${label} bağlantısı kopyalandı`, "success")
  }

  const printQrItems = (items: Array<{ tableName: string; url: string }>) => {
    if (items.length === 0) {
      showPanelToast("Yazdırılacak imzalı QR kodlu masa bulunamadı", "error")
      return
    }
    const win = window.open("", "_blank")
    if (!win) {
      showPanelToast("Lütfen tarayıcıda açılır pencere (pop-up) izni verin", "error")
      return
    }
    win.document.write(buildPrintableQrDocumentHtml({ items, prefs }))
    win.document.close()
  }

  const handlePrintFiltered = () => {
    const printable = filteredTables
      .map((t) => ({ tableName: t.name, url: buildTableUrl(t) }))
      .filter((item): item is { tableName: string; url: string } => Boolean(item.url))
    printQrItems(printable)
  }

  const handleDownloadSingleSvg = (t: PanelTable) => {
    const url = buildTableUrl(t)
    if (!url) return
    const svg = buildStandaloneVectorCardSvg({ tableName: t.name, url, prefs })
    const safeFile = t.name.toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, "-")
    downloadVectorSvgFile(`qr-${safeFile}-${prefs.cardSize}.svg`, svg)
    showPanelToast(`${t.name} vektörel SVG dosyası indirildi`, "success")
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-sm p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[960px] max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#e63462]/10 text-[#e63462] flex items-center justify-center flex-shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] truncate">
                Masa QR Tasarım &amp; Profesyonel Baskı Stüdyosu
              </h3>
              <p className="text-[11px] text-[#86868b] truncate">
                Lazer kazıma, direkt PVC/UV baskı, rulo etiket ve A4 kağıt baskısına %100 uyumlu vektörel QR kartları
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handlePrintFiltered}
              className="h-[34px] px-4 rounded-xl bg-[#e63462] text-white text-[12px] font-semibold hover:bg-[#d42d56] inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>
                {sectionFilter === "ALL"
                  ? `Tüm Masaları Yazdır (${filteredTables.length})`
                  : `${sectionFilter} Bölgesini Yazdır (${filteredTables.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
            >
              <X className="w-4 h-4 text-[#86868b]" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-[#f9f9fb] border border-[#d1d1d6]/60 rounded-2xl p-4">
            <div className="lg:col-span-7 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-[#1d1d1f] uppercase tracking-wide">
                    1. QR Üstü Açıklama Metni (Özelleştirilebilir)
                  </label>
                  <button
                    type="button"
                    onClick={() => updatePrefs({ descriptionText: "" })}
                    className="text-[11px] text-[#e63462] hover:underline font-medium"
                  >
                    Metni Kaldır (Sadece QR + Masa No)
                  </button>
                </div>
                <input
                  type="text"
                  value={prefs.descriptionText}
                  onChange={(e) => updatePrefs({ descriptionText: e.target.value })}
                  placeholder={DEFAULT_QR_DESCRIPTION}
                  maxLength={90}
                  className="w-full h-[36px] px-3 text-[12px] bg-white rounded-xl border border-[#d1d1d6] text-[#1d1d1f] focus:outline-none focus:border-[#e63462]"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QR_DESCRIPTION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updatePrefs({ descriptionText: preset })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                        prefs.descriptionText === preset
                          ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
                          : "bg-white text-[#636366] border-[#d1d1d6]/70 hover:bg-[#f0f0f5]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1d1d1f] uppercase tracking-wide block mb-1.5">
                  2. QR Kart Tasarım Şablonu
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QR_DESIGN_TEMPLATES.map((tpl) => {
                    const active = prefs.designTemplate === tpl.id
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => updatePrefs({ designTemplate: tpl.id as QrDesignTemplateId })}
                        className={`text-left p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                          active
                            ? "bg-white border-[#e63462] ring-2 ring-[#e63462]/15"
                            : "bg-white/80 border-[#d1d1d6]/70 hover:bg-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-[#1d1d1f]">{tpl.label}</div>
                          <p className="text-[10px] text-[#86868b] leading-snug mt-0.5">{tpl.subtitle}</p>
                        </div>
                        {active && (
                          <span className="w-4 h-4 rounded-full bg-[#e63462] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#1d1d1f] uppercase tracking-wide block mb-1">
                    3. Baskı Yöntemi / Materyal
                  </label>
                  <select
                    value={prefs.printMedium}
                    onChange={(e) => updatePrefs({ printMedium: e.target.value as QrPrintMediumId })}
                    className="w-full h-[36px] px-2.5 text-[12px] font-medium bg-white rounded-xl border border-[#d1d1d6] text-[#1d1d1f] focus:outline-none focus:border-[#e63462]"
                  >
                    {QR_PRINT_MEDIUMS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#86868b] mt-1">
                    {QR_PRINT_MEDIUMS.find((m) => m.id === prefs.printMedium)?.description}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#1d1d1f] uppercase tracking-wide block mb-1">
                    4. Fiziksel Baskı Ölçüsü (mm)
                  </label>
                  <select
                    value={prefs.cardSize}
                    onChange={(e) => updatePrefs({ cardSize: e.target.value as QrCardSizeId })}
                    className="w-full h-[36px] px-2.5 text-[12px] font-medium bg-white rounded-xl border border-[#d1d1d6] text-[#1d1d1f] focus:outline-none focus:border-[#e63462]"
                  >
                    {QR_CARD_SIZES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={prefs.showCropMarks}
                      onChange={(e) => updatePrefs({ showCropMarks: e.target.checked })}
                      className="rounded border-[#d1d1d6] text-[#e63462] focus:ring-[#e63462]"
                    />
                    <Scissors className="w-3 h-3 text-[#636366]" />
                    <span className="text-[11px] text-[#48484a] font-medium">
                      Kesim kılavuz çizgilerini (kros) göster
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col items-center justify-between bg-white rounded-2xl border border-[#d1d1d6]/70 p-4">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#e63462]">
                  <Sparkles className="w-3.5 h-3.5" /> Canlı Baskı Önizlemesi
                </span>
                <span className="text-[10px] font-mono text-[#86868b]">
                  {isLaser ? "100% Saf Vektör (#000)" : "300+ DPI Vektörel SVG"}
                </span>
              </div>

              <div className="my-2 flex items-center justify-center">
                <div
                  className={`w-[220px] min-h-[285px] rounded-2xl p-4 flex flex-col items-center justify-between text-center transition-all ${
                    isDark
                      ? "bg-[#111111] text-white border-2 border-[#111111] shadow-lg"
                      : isLaser
                        ? "bg-white text-black border-2 border-black"
                        : prefs.designTemplate === "luxury"
                          ? "bg-white text-black border-2 border-black ring-1 ring-inset ring-black ring-offset-4"
                          : "bg-white text-black border-2 border-black shadow-md"
                  }`}
                >
                  {cleanDesc ? (
                    <div
                      className={`w-full text-[12px] font-bold leading-snug break-words ${
                        prefs.designTemplate === "badge" && !isDark
                          ? "bg-[#f2f2f7] border border-black rounded-lg px-2.5 py-1.5 text-black"
                          : isDark ? "text-white" : "text-black"
                      }`}
                    >
                      {cleanDesc}
                    </div>
                  ) : (
                    <div className="h-1" />
                  )}

                  <div className={`my-2 p-2 bg-white rounded-xl flex items-center justify-center ${isLaser ? "border border-black" : ""}`}>
                    <img src={previewQrUri} alt={previewTable.name} className="w-[148px] h-[148px] block" />
                  </div>

                  <div className={`w-full pt-1 flex items-center justify-center ${prefs.designTemplate === "luxury" ? "border-t border-black pt-2 w-4/5" : ""}`}>
                    <span
                      className={`text-[24px] font-black tracking-wide leading-none ${
                        prefs.designTemplate === "badge" && !isLaser && !isDark
                          ? "bg-black text-white px-5 py-1.5 rounded-full text-[20px]"
                          : prefs.designTemplate === "badge" && isLaser
                            ? "border-2 border-black text-black px-5 py-1 rounded-full text-[20px]"
                            : isDark ? "text-white" : "text-black"
                      }`}
                    >
                      {previewTable.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-[#f0f0f0]">
                <span className="text-[11px] text-[#86868b]">Restoran adı ve bölge basılmaz</span>
                <button
                  type="button"
                  onClick={() => handleDownloadSingleSvg(previewTable)}
                  className="h-[28px] px-2.5 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[11px] font-semibold text-[#1d1d1f] inline-flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Örnek Vektör (.SVG) İndir
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSectionFilter("ALL")}
                className={`h-[30px] px-3 rounded-lg text-[11px] font-semibold transition-colors ${
                  sectionFilter === "ALL" ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#636366] hover:bg-[#e8e8ed]"
                }`}
              >
                Tüm Bölgeler ({tables.length})
              </button>
              {sections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSectionFilter(sec)}
                  className={`h-[30px] px-3 rounded-lg text-[11px] font-semibold transition-colors ${
                    sectionFilter === sec ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#636366] hover:bg-[#e8e8ed]"
                  }`}
                >
                  {sec} ({tables.filter((t) => t.section === sec).length})
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyUrl(generalMenuUrl, "Genel QR Menü")}
                className="h-[30px] px-2.5 rounded-lg bg-[#f5f5f7] border border-[#d1d1d6]/60 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Genel Menü Linki
              </button>
              <a
                href={generalMenuUrl}
                target="_blank"
                rel="noreferrer"
                className="h-[30px] px-2.5 rounded-lg bg-[#f5f5f7] border border-[#d1d1d6]/60 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Aç
              </a>
            </div>
          </div>

          <div className="border border-[#d1d1d6]/60 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Masa No</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Bölüm (Sadece Panelde)</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">İmzalı QR Bağlantısı</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase">Baskı &amp; Vektör İşlemleri</th>
                </tr>
              </thead>
              <tbody>
                {filteredTables.map((t, idx) => {
                  const url = buildTableUrl(t)
                  return (
                    <tr key={t.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                      <td className="px-4 py-2 text-[13px] font-bold text-[#1d1d1f]">{t.name}</td>
                      <td className="px-4 py-2 text-[12px] text-[#86868b]">{t.section}</td>
                      <td className="px-4 py-2 text-[11px] font-mono text-[#636366] max-w-[240px] truncate">
                        {url ?? "İmzalı QR anahtarı bekleniyor"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {url ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => printQrItems([{ tableName: t.name, url }])}
                              className="h-[26px] px-2.5 rounded-lg bg-[#1d1d1f] hover:bg-[#3a3a3c] text-[11px] font-medium text-white flex items-center gap-1"
                              title="Tek Masa QR Yazdır"
                            >
                              <Printer className="w-3 h-3" /> Yazdır
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleSvg(t)}
                              className="h-[26px] px-2.5 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#d1d1d6]/60 text-[11px] font-medium text-[#1d1d1f] flex items-center gap-1"
                              title="Lazer / PVC / Matbaa için Vektörel SVG İndir"
                            >
                              <Download className="w-3 h-3" /> SVG
                            </button>
                            <button
                              type="button"
                              onClick={() => copyUrl(url, t.name)}
                              className="h-[26px] px-2 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[11px] font-medium text-[#1d1d1f] flex items-center"
                              title="Bağlantıyı Kopyala"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="h-[26px] px-2 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[11px] font-medium text-[#1d1d1f] flex items-center"
                              title="Yeni Sekmede Aç"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#86868b]">-</span>
                        )}
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
