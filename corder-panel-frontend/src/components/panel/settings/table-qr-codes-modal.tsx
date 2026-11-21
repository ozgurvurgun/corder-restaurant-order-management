import { useEffect, useMemo, useState } from "react"
import {
  Check, Copy, Download, ExternalLink, FolderArchive, Printer, QrCode, Scissors, X,
} from "lucide-react"
import { CustomSelect } from "@/components/ui/custom-inputs"
import type { PanelTable } from "@/lib/panel-types"
import {
  buildPrintableQrDocumentHtml, buildStandaloneVectorCardSvg, clampCutMarginRatio,
  DEFAULT_QR_DESCRIPTION, downloadBulkVectorSvgZip, downloadVectorSvgFile,
  loadQrStudioPreferences, QR_CARD_SIZES, QR_DESCRIPTION_PRESETS, QR_DESIGN_TEMPLATES,
  QR_PRINT_MEDIUMS, sanitizeQrFilenameSegment, saveQrStudioPreferences,
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

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

  const previewSvgMarkup = useMemo(
    () => buildStandaloneVectorCardSvg({ tableName: previewTable.name, url: previewUrl, prefs, forInlinePreview: true }),
    [previewTable.name, previewUrl, prefs],
  )
  const isLaser = prefs.printMedium === "laser" || prefs.designTemplate === "laser-stencil"

  const copyUrl = (url: string, label: string) => {
    void navigator.clipboard?.writeText(url)
    showPanelToast(`${label} bağlantısı kopyalandı`, "success")
  }

  const printQrItems = (items: Array<{ tableName: string; url: string }>) => {
    if (items.length === 0) return showPanelToast("Yazdırılacak imzalı QR kodlu masa bulunamadı", "error")
    const win = window.open("", "_blank")
    if (!win) return showPanelToast("Lütfen tarayıcıda açılır pencere (pop-up) izni verin", "error")
    win.document.write(buildPrintableQrDocumentHtml({ items, prefs }))
    win.document.close()
  }

  const getPrintableFilteredItems = () =>
    filteredTables
      .map((t) => ({ tableName: t.name, section: t.section, url: buildTableUrl(t) }))
      .filter((item): item is { tableName: string; section: string; url: string } => Boolean(item.url))

  const handlePrintFiltered = () => printQrItems(getPrintableFilteredItems())

  const handleDownloadBulkZip = () => {
    const items = getPrintableFilteredItems()
    if (items.length === 0) return showPanelToast("İndirilecek imzalı QR kodlu masa bulunamadı", "error")
    const count = downloadBulkVectorSvgZip({ restaurantSlug: slug, items, prefs })
    showPanelToast(`${count} adet vektörel SVG dosyası ZIP olarak indirildi`, "success")
  }

  const handleDownloadSingleSvg = (t: PanelTable) => {
    const url = buildTableUrl(t) || generalMenuUrl
    const svg = buildStandaloneVectorCardSvg({ tableName: t.name, url, prefs })
    const safeFile = sanitizeQrFilenameSegment(t.name)
    downloadVectorSvgFile(`qr-${safeFile}-${prefs.cardSize}.svg`, svg)
    showPanelToast(`${t.name} vektörel SVG dosyası indirildi`, "success")
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[960px] max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-[#e63462]/10 text-[#e63462] flex items-center justify-center flex-shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#1d1d1f] truncate">
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
              onClick={handleDownloadBulkZip}
              className="hidden sm:inline-flex h-[34px] px-3.5 rounded-xl bg-[#1d1d1f] text-white text-[12px] font-semibold hover:bg-[#3a3a3c] items-center gap-1.5 whitespace-nowrap shadow-xs"
              title="Seçili bölgedeki tüm masaların vektörel SVG dosyalarını tek ZIP paketinde indir"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>
                {sectionFilter === "ALL"
                  ? `Toplu SVG İndir (.ZIP) (${filteredTables.length})`
                  : `${sectionFilter} SVG (.ZIP) (${filteredTables.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={handlePrintFiltered}
              className="hidden sm:inline-flex h-[34px] px-4 rounded-xl bg-[#e63462] text-white text-[12px] font-semibold hover:bg-[#d42d56] items-center gap-1.5 whitespace-nowrap shadow-xs"
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
              aria-label="Kapat"
              className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] flex-shrink-0"
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
                  <CustomSelect
                    value={prefs.printMedium}
                    onValueChange={(val) => updatePrefs({ printMedium: val as QrPrintMediumId })}
                    options={QR_PRINT_MEDIUMS.map((m) => ({ value: m.id, label: m.label }))}
                    className="w-full h-[36px] px-3 text-[12px] font-medium bg-white rounded-xl border border-[#d1d1d6] text-[#1d1d1f]"
                  />
                  <p className="text-[10px] text-[#86868b] mt-1">
                    {QR_PRINT_MEDIUMS.find((m) => m.id === prefs.printMedium)?.description}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#1d1d1f] uppercase tracking-wide block mb-1">
                    4. Fiziksel Baskı Ölçüsü (mm)
                  </label>
                  <CustomSelect
                    value={prefs.cardSize}
                    onValueChange={(val) => updatePrefs({ cardSize: val as QrCardSizeId })}
                    options={QR_CARD_SIZES.map((s) => ({ value: s.id, label: s.label }))}
                    className="w-full h-[36px] px-3 text-[12px] font-medium bg-white rounded-xl border border-[#d1d1d6] text-[#1d1d1f]"
                  />
                  <button
                    type="button"
                    onClick={() => updatePrefs({ showCropMarks: !prefs.showCropMarks })}
                    className="inline-flex items-center gap-2 mt-2 cursor-pointer select-none group"
                  >
                    <span
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        prefs.showCropMarks
                          ? "bg-[#e63462] border-[#e63462] text-white"
                          : "bg-white border-[#d1d1d6] group-hover:border-[#86868b]"
                      }`}
                    >
                      {prefs.showCropMarks && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                    <Scissors className="w-3 h-3 text-[#636366]" />
                    <span className="text-[11px] text-[#48484a] font-medium">
                      Kesim kılavuz çizgilerini (kros) göster
                    </span>
                  </button>
                </div>
              </div>

              {prefs.showCropMarks && (
                <div className="bg-white rounded-xl border border-[#d1d1d6]/70 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-[11px] font-semibold text-[#1d1d1f] uppercase tracking-wide flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-[#e63462]" />
                      <span>Kesim Kılavuz Çizgisi - Dış Çerçeve Uzaklık Oranı (%)</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {[2, 5, 10, 15, 22].map((presetPct) => (
                        <button
                          key={presetPct}
                          type="button"
                          onClick={() => updatePrefs({ cutMarginRatio: presetPct })}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                            prefs.cutMarginRatio === presetPct
                              ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
                              : "bg-[#f5f5f7] text-[#636366] border-[#d1d1d6]/60 hover:bg-[#e8e8ed]"
                          }`}
                        >
                          %{presetPct}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={30}
                      step={1}
                      value={prefs.cutMarginRatio}
                      onChange={(e) => updatePrefs({ cutMarginRatio: clampCutMarginRatio(e.target.value) })}
                      className="flex-1 accent-[#e63462] h-1.5 bg-[#e5e5ea] rounded-lg cursor-pointer"
                    />
                    <div className="relative w-[78px] flex-shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        step={1}
                        value={prefs.cutMarginRatio}
                        onChange={(e) => updatePrefs({ cutMarginRatio: clampCutMarginRatio(e.target.value) })}
                        className="w-full h-[32px] pl-2.5 pr-6 text-[12px] font-bold bg-[#f9f9fb] rounded-lg border border-[#d1d1d6] text-[#1d1d1f] focus:outline-none focus:border-[#e63462] text-right"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#86868b] pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 flex flex-col items-center justify-between bg-white rounded-2xl border border-[#d1d1d6]/70 p-4">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="inline-flex items-center text-[11px] font-semibold text-[#e63462]">
                  Canlı Baskı Önizlemesi (1:1 SVG)
                </span>
                <span className="text-[10px] font-mono text-[#86868b]">
                  {isLaser ? "100% Saf Vektör (#000)" : "300+ DPI Vektörel SVG"}
                </span>
              </div>

              <div className="my-2 flex items-center justify-center w-full">
                <div
                  className="w-full max-w-[290px] flex items-center justify-center drop-shadow-sm"
                  dangerouslySetInnerHTML={{ __html: previewSvgMarkup }}
                />
              </div>

              <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-[#f0f0f0]">
                <span className="text-[11px] text-[#86868b]">Önizleme ile indirilen SVG birebir aynıdır</span>
                <button
                  type="button"
                  onClick={() => handleDownloadSingleSvg(previewTable)}
                  className="h-[28px] px-2.5 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[11px] font-semibold text-[#1d1d1f] inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Download className="w-3 h-3" /> Örnek (.SVG) İndir
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
                onClick={handleDownloadBulkZip}
                className="h-[30px] px-2.5 rounded-lg bg-[#f5f5f7] border border-[#d1d1d6]/60 text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] flex items-center gap-1"
              >
                <FolderArchive className="w-3 h-3" /> Toplu SVG (.ZIP)
              </button>
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

          <div className="border border-[#d1d1d6]/60 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[600px]">
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
