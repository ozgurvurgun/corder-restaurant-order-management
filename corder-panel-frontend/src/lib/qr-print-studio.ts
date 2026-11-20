import { encodeQrMatrix, escapeHtml, generateQrSvg } from "./qr-svg"

export type QrDesignTemplateId =
  | "classic"
  | "badge"
  | "luxury"
  | "dark-card"
  | "laser-stencil"

export type QrPrintMediumId = "paper" | "pvc" | "laser" | "sticker"

export type QrCardSizeId = "50x70" | "65x90" | "80x80" | "80x110"

export interface QrStudioPreferences {
  descriptionText: string
  designTemplate: QrDesignTemplateId
  printMedium: QrPrintMediumId
  cardSize: QrCardSizeId
  showCropMarks: boolean
}

export const DEFAULT_QR_DESCRIPTION = "Menüyü görmek ve garson çağırmak için okutun"

export const QR_DESCRIPTION_PRESETS: readonly string[] = [
  "Menüyü görmek ve garson çağırmak için okutun",
  "Menü & Garson Çağrısı İçin Okutun",
  "Dijital Menü İçin QR Kodu Okutun",
  "QR Kodu Okutarak Sipariş & Garson Çağrısı Yapabilirsiniz",
  "Scan for Digital Menu & Waiter Call",
]

export const QR_DESIGN_TEMPLATES: ReadonlyArray<{
  id: QrDesignTemplateId
  label: string
  subtitle: string
}> = [
  {
    id: "classic",
    label: "Klasik Minimal",
    subtitle: "Zarif çerçeve, üstte açıklama, altta net masa numarası",
  },
  {
    id: "badge",
    label: "Modern Rozetli",
    subtitle: "Üst bilgi bandı, köşe odaklı QR ve siyah masa rozeti",
  },
  {
    id: "luxury",
    label: "Lüks Çerçeveli",
    subtitle: "Çift katmanlı mimari kenarlık ve dekoratif masa numarası",
  },
  {
    id: "dark-card",
    label: "Koyu Kontrast (PVC / Pleksi)",
    subtitle: "Koyu gövde üzerinde yüksek kontrastlı beyaz QR alanı",
  },
  {
    id: "laser-stencil",
    label: "Saf Lazer & CNC Şablonu",
    subtitle: "%100 saf siyah-beyaz vektörel hatlar (ahşap, metal, pleksi kazıma)",
  },
]

export const QR_PRINT_MEDIUMS: ReadonlyArray<{
  id: QrPrintMediumId
  label: string
  description: string
}> = [
  {
    id: "paper",
    label: "A4 Kağıt / Masaüstü Yazıcı",
    description: "A4 sayfasına çoklu kart dizilimi ve kesim kılavuzu",
  },
  {
    id: "pvc",
    label: "Direkt PVC / UV / Matbaa Baskı",
    description: "1:1 milimetrik kart boyutu, yüksek kontrast ve matbaa kesim krosları",
  },
  {
    id: "laser",
    label: "Lazer Kazıma (Ahşap / Metal / Pleksi)",
    description: "Ara gri ton içermeyen %100 saf siyah (#000) vektörel SVG çıktı",
  },
  {
    id: "sticker",
    label: "Rulo Etiket / Tekli Sticker Yazıcı",
    description: "Her sayfada 1 adet tam kart ölçüsünde (@page) etiket çıktısı",
  },
]

export const QR_CARD_SIZES: ReadonlyArray<{
  id: QrCardSizeId
  label: string
  widthMm: number
  heightMm: number
  qrMm: number
  colsOnA4: number
}> = [
  { id: "50x70", label: "50 × 70 mm (Kompakt)", widthMm: 50, heightMm: 70, qrMm: 34, colsOnA4: 3 },
  { id: "65x90", label: "65 × 90 mm (Standart PVC)", widthMm: 65, heightMm: 90, qrMm: 44, colsOnA4: 3 },
  { id: "80x80", label: "80 × 80 mm (Kare Lazer / Blok)", widthMm: 80, heightMm: 80, qrMm: 46, colsOnA4: 2 },
  { id: "80x110", label: "80 × 110 mm (Büyük Stand)", widthMm: 80, heightMm: 110, qrMm: 54, colsOnA4: 2 },
]

const STORAGE_KEY_PREFIX = "corder_qr_studio_prefs_v1:"

export function loadQrStudioPreferences(restaurantSlug?: string): QrStudioPreferences {
  const fallback: QrStudioPreferences = {
    descriptionText: DEFAULT_QR_DESCRIPTION,
    designTemplate: "classic",
    printMedium: "paper",
    cardSize: "65x90",
    showCropMarks: true,
  }
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${restaurantSlug || "default"}`)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<QrStudioPreferences>
    return {
      descriptionText:
        typeof parsed.descriptionText === "string"
          ? parsed.descriptionText
          : fallback.descriptionText,
      designTemplate: QR_DESIGN_TEMPLATES.some((t) => t.id === parsed.designTemplate)
        ? (parsed.designTemplate as QrDesignTemplateId)
        : fallback.designTemplate,
      printMedium: QR_PRINT_MEDIUMS.some((m) => m.id === parsed.printMedium)
        ? (parsed.printMedium as QrPrintMediumId)
        : fallback.printMedium,
      cardSize: QR_CARD_SIZES.some((s) => s.id === parsed.cardSize)
        ? (parsed.cardSize as QrCardSizeId)
        : fallback.cardSize,
      showCropMarks:
        typeof parsed.showCropMarks === "boolean" ? parsed.showCropMarks : fallback.showCropMarks,
    }
  } catch {
    return fallback
  }
}

export function saveQrStudioPreferences(
  prefs: QrStudioPreferences,
  restaurantSlug?: string,
): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${restaurantSlug || "default"}`,
      JSON.stringify(prefs),
    )
  } catch {
    // ignore storage quota errors
  }
}

function wrapDescriptionLines(text: string, maxCharsPerLine = 26): string[] {
  const clean = text.trim().replace(/\s+/g, " ")
  if (!clean) return []
  const words = clean.split(" ")
  const lines: string[] = []
  let current = ""
  for (const w of words) {
    if (!current) {
      current = w
    } else if (current.length + 1 + w.length <= maxCharsPerLine) {
      current += ` ${w}`
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

/**
 * Generates a self-contained, 100% vector SVG file (with millimeter dimensions)
 * suitable for laser engraving (LightBurn, CorelDRAW, Illustrator) or direct UV/PVC printing.
 * Strictly omits restaurant name and section name; renders description on top and table number below.
 */
export function buildStandaloneVectorCardSvg(params: {
  tableName: string
  url: string
  prefs: QrStudioPreferences
}): string {
  const { tableName, url, prefs } = params
  const sizeSpec = QR_CARD_SIZES.find((s) => s.id === prefs.cardSize) ?? QR_CARD_SIZES[1]
  const w = sizeSpec.widthMm * 10
  const h = sizeSpec.heightMm * 10
  const isLaser = prefs.printMedium === "laser" || prefs.designTemplate === "laser-stencil"
  const isDark = !isLaser && prefs.designTemplate === "dark-card"

  const bgFill = isDark ? "#111111" : "#ffffff"
  const fgColor = isDark ? "#ffffff" : "#000000"
  const subTextColor = isLaser ? "#000000" : isDark ? "#f5f5f7" : "#111111"
  const borderColor = isLaser ? "#000000" : isDark ? "#111111" : "#111111"

  const matrix = encodeQrMatrix(url)
  const n = matrix.length
  const quietModules = 3
  const totalModules = n + quietModules * 2
  const qrBoxSize = sizeSpec.qrMm * 10
  const qrLeft = Math.round((w - qrBoxSize) / 2)
  const descLines = wrapDescriptionLines(prefs.descriptionText, sizeSpec.widthMm <= 50 ? 22 : 28)
  const hasDesc = descLines.length > 0
  const qrTop = hasDesc ? Math.round(h * 0.24) : Math.round(h * 0.14)
  const moduleScale = qrBoxSize / totalModules

  let qrPath = ""
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (qrLeft + (c + quietModules) * moduleScale).toFixed(2)
        const y = (qrTop + (r + quietModules) * moduleScale).toFixed(2)
        const ms = moduleScale.toFixed(2)
        qrPath += `M${x} ${y}h${ms}v${ms}h-${ms}z`
      }
    }
  }

  const descFontSize = sizeSpec.widthMm <= 50 ? 24 : 28
  const descLineHeight = Math.round(descFontSize * 1.28)
  const descStartY =
    descLines.length === 1
      ? Math.round(qrTop * 0.56)
      : descLines.length === 2
        ? Math.round(qrTop * 0.44)
        : Math.round(qrTop * 0.34)

  const descSvg = descLines
    .map(
      (line, idx) =>
        `<text x="${w / 2}" y="${descStartY + idx * descLineHeight}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="${descFontSize}" font-weight="700" fill="${subTextColor}">${escapeHtml(line)}</text>`,
    )
    .join("")

  const bottomAreaTop = qrTop + qrBoxSize
  const bottomCenterY = Math.round(bottomAreaTop + (h - bottomAreaTop) * 0.56)
  const tableFontSize = sizeSpec.widthMm <= 50 ? 58 : 72
  const safeTable = escapeHtml(tableName)

  let frameSvg = `<rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="42" ry="42" fill="${bgFill}" stroke="${borderColor}" stroke-width="${isLaser ? 8 : 6}"/>`
  if (prefs.designTemplate === "luxury") {
    frameSvg += `<rect x="28" y="28" width="${w - 56}" height="${h - 56}" rx="30" ry="30" fill="none" stroke="${fgColor}" stroke-width="3"/>`
    frameSvg += `<line x1="${Math.round(w * 0.25)}" y1="${bottomAreaTop + 22}" x2="${Math.round(w * 0.75)}" y2="${bottomAreaTop + 22}" stroke="${fgColor}" stroke-width="4"/>`
  }

  let tableSvg = `<text x="${w / 2}" y="${bottomCenterY + Math.round(tableFontSize * 0.32)}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="${tableFontSize}" font-weight="900" letter-spacing="1" fill="${fgColor}">${safeTable}</text>`
  if (prefs.designTemplate === "badge" && !isLaser) {
    const pillW = Math.max(180, Math.min(w - 100, safeTable.length * 46 + 90))
    const pillH = tableFontSize + 34
    const pillX = Math.round((w - pillW) / 2)
    const pillY = Math.round(bottomCenterY - pillH / 2)
    tableSvg = `<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${Math.round(pillH / 2)}" fill="#000000"/><text x="${w / 2}" y="${bottomCenterY + Math.round(tableFontSize * 0.33)}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="${tableFontSize - 6}" font-weight="900" fill="#ffffff">${safeTable}</text>`
  } else if (prefs.designTemplate === "badge" && isLaser) {
    const pillW = Math.max(180, Math.min(w - 100, safeTable.length * 46 + 90))
    const pillH = tableFontSize + 34
    const pillX = Math.round((w - pillW) / 2)
    const pillY = Math.round(bottomCenterY - pillH / 2)
    tableSvg = `<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${Math.round(pillH / 2)}" fill="none" stroke="#000000" stroke-width="6"/><text x="${w / 2}" y="${bottomCenterY + Math.round(tableFontSize * 0.33)}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="${tableFontSize - 6}" font-weight="900" fill="#000000">${safeTable}</text>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${sizeSpec.widthMm}mm" height="${sizeSpec.heightMm}mm" viewBox="0 0 ${w} ${h}" shape-rendering="geometricPrecision">
  ${frameSvg}
  ${descSvg}
  <rect x="${qrLeft}" y="${qrTop}" width="${qrBoxSize}" height="${qrBoxSize}" rx="18" fill="#ffffff" ${isLaser ? 'stroke="#000000" stroke-width="4"' : ""}/>
  <path d="${qrPath}" fill="#000000" shape-rendering="crispEdges"/>
  ${tableSvg}
</svg>`
}

export function downloadVectorSvgFile(filename: string, svgContent: string): void {
  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function buildPrintableQrDocumentHtml(params: {
  items: Array<{ tableName: string; url: string }>
  prefs: QrStudioPreferences
}): string {
  const { items, prefs } = params
  const sizeSpec = QR_CARD_SIZES.find((s) => s.id === prefs.cardSize) ?? QR_CARD_SIZES[1]
  const isLaser = prefs.printMedium === "laser" || prefs.designTemplate === "laser-stencil"
  const isSticker = prefs.printMedium === "sticker"
  const isPvc = prefs.printMedium === "pvc"
  const isDark = !isLaser && prefs.designTemplate === "dark-card"
  const cleanDesc = prefs.descriptionText.trim()

  const cardsHtml = items
    .map(({ tableName, url }) => {
      const qrSvg = generateQrSvg(url, 320, 3, "#000000", "#ffffff")
      const safeTable = escapeHtml(tableName)
      const safeDesc = escapeHtml(cleanDesc)
      return `<div class="card-wrap ${prefs.showCropMarks && !isSticker ? "with-crops" : ""}">
        <div class="qr-card tpl-${prefs.designTemplate} ${isLaser ? "mode-laser" : ""} ${isDark ? "mode-dark" : ""}">
          ${cleanDesc ? `<div class="qr-desc">${safeDesc}</div>` : `<div class="qr-desc-spacer"></div>`}
          <div class="qr-box">${qrSvg}</div>
          <div class="qr-table-wrap"><span class="qr-table">${safeTable}</span></div>
        </div>
      </div>`
    })
    .join("")

  const pageCss = isSticker
    ? `@page { size: ${sizeSpec.widthMm}mm ${sizeSpec.heightMm}mm; margin: 0; }
       body { margin: 0; padding: 0; }
       .sheet-grid { display: flex; flex-direction: column; }
       .card-wrap { page-break-after: always; break-after: page; display: flex; align-items: center; justify-content: center; width: ${sizeSpec.widthMm}mm; height: ${sizeSpec.heightMm}mm; }`
    : `@page { size: A4 portrait; margin: 10mm; }
       body { margin: 0; padding: 8mm; }
       .sheet-grid { display: grid; grid-template-columns: repeat(${sizeSpec.colsOnA4}, ${sizeSpec.widthMm}mm); gap: ${isPvc ? "8mm" : "6mm"}; justify-content: center; }`

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>Masa QR Baskı Şablonu (${sizeSpec.widthMm}x${sizeSpec.heightMm}mm)</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #000000; }
  ${pageCss}
  .card-wrap { position: relative; width: ${sizeSpec.widthMm}mm; height: ${sizeSpec.heightMm}mm; page-break-inside: avoid; break-inside: avoid; }
  .card-wrap.with-crops::before, .card-wrap.with-crops::after {
    content: ""; position: absolute; inset: -2mm; pointer-events: none;
    border: 0.25mm dashed ${isLaser ? "#000000" : "#999999"}; border-radius: 4.5mm;
  }
  .qr-card {
    width: 100%; height: 100%; border-radius: 4mm; padding: 4mm 3.5mm;
    display: flex; flex-direction: column; align-items: center; justify-content: space-between;
    text-align: center; background: #ffffff; color: #000000; border: 0.55mm solid #000000;
    position: relative; overflow: hidden;
  }
  .qr-card.tpl-luxury { border: 0.7mm solid #000000; box-shadow: inset 0 0 0 1.4mm #ffffff, inset 0 0 0 1.75mm #000000; padding: 5.5mm 4.5mm; }
  .qr-card.tpl-badge .qr-desc { background: #f2f2f7; border: 0.35mm solid #000000; border-radius: 2mm; padding: 1.4mm 2.5mm; width: 100%; }
  .qr-card.tpl-badge .qr-table { background: #000000; color: #ffffff; padding: 1.2mm 5.5mm; border-radius: 999px; display: inline-block; }
  .qr-card.mode-dark { background: #111111 !important; color: #ffffff !important; border-color: #111111 !important; }
  .qr-card.mode-dark .qr-desc { color: #ffffff !important; }
  .qr-card.mode-dark .qr-table { color: #ffffff !important; }
  .qr-card.mode-laser { background: #ffffff !important; color: #000000 !important; border: 0.7mm solid #000000 !important; }
  .qr-card.mode-laser .qr-desc { background: transparent !important; color: #000000 !important; border-color: #000000 !important; }
  .qr-card.mode-laser.tpl-badge .qr-table { background: transparent !important; color: #000000 !important; border: 0.6mm solid #000000 !important; }
  .qr-desc { font-size: ${sizeSpec.widthMm <= 50 ? "8.2pt" : "9.5pt"}; font-weight: 700; line-height: 1.25; color: #000000; max-width: 100%; word-break: break-word; }
  .qr-desc-spacer { height: 2mm; }
  .qr-box { width: ${sizeSpec.qrMm}mm; height: ${sizeSpec.qrMm}mm; background: #ffffff; padding: 1.2mm; border-radius: 2mm; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .qr-card.mode-laser .qr-box { border: 0.4mm solid #000000; }
  .qr-box svg { width: 100%; height: 100%; display: block; shape-rendering: crispEdges; }
  .qr-table-wrap { width: 100%; display: flex; align-items: center; justify-content: center; padding-top: 1mm; }
  .qr-card.tpl-luxury .qr-table-wrap { border-top: 0.4mm solid #000000; padding-top: 1.8mm; width: 82%; }
  .qr-table { font-size: ${sizeSpec.widthMm <= 50 ? "17pt" : "21pt"}; font-weight: 900; letter-spacing: 0.4px; line-height: 1.05; color: #000000; }
</style>
</head>
<body>
  <div class="sheet-grid">${cardsHtml}</div>
  <script>window.onload = () => setTimeout(() => window.print(), 220);</script>
</body>
</html>`
}
