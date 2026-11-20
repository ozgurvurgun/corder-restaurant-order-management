import { encodeQrMatrix, escapeHtml } from "./qr-svg"
import { downloadZipArchive, type ZipTextEntry } from "./zip-archive"

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
  /** Distance ratio (%) from the QR code to the outer cut guide line / border (3..38, default 10) */
  cutMarginRatio: number
}

export const DEFAULT_QR_DESCRIPTION = "Menüyü görmek ve garson çağırmak için okutun"
export const DEFAULT_CUT_MARGIN_RATIO = 10

export function clampCutMarginRatio(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num)) return DEFAULT_CUT_MARGIN_RATIO
  return Math.max(3, Math.min(38, Math.round(num)))
}

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
const SVG_FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function loadQrStudioPreferences(restaurantSlug?: string): QrStudioPreferences {
  const fallback: QrStudioPreferences = {
    descriptionText: DEFAULT_QR_DESCRIPTION,
    designTemplate: "classic",
    printMedium: "paper",
    cardSize: "65x90",
    showCropMarks: true,
    cutMarginRatio: DEFAULT_CUT_MARGIN_RATIO,
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
      cutMarginRatio:
        parsed.cutMarginRatio !== undefined
          ? clampCutMarginRatio(parsed.cutMarginRatio)
          : fallback.cutMarginRatio,
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

function wrapDescriptionLines(text: string, maxCharsPerLine = 25): string[] {
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
 * Single source of truth for live preview, single SVG download, bulk ZIP SVG export, and printing.
 * Uses a canonical 440-unit horizontal coordinate system (2x of the 220px preview card)
 * so font sizes, line breaks, borders, and spacing are 100% identical everywhere.
 */
export function buildStandaloneVectorCardSvg(params: {
  tableName: string
  url: string
  prefs: QrStudioPreferences
  forInlinePreview?: boolean
}): string {
  const { tableName, url, prefs, forInlinePreview = false } = params
  const sizeSpec = QR_CARD_SIZES.find((s) => s.id === prefs.cardSize) ?? QR_CARD_SIZES[1]
  const w = 440
  const isLaser = prefs.printMedium === "laser" || prefs.designTemplate === "laser-stencil"
  const isDark = !isLaser && prefs.designTemplate === "dark-card"
  const isLuxury = prefs.designTemplate === "luxury"
  const isBadge = prefs.designTemplate === "badge"

  const bgFill = isDark ? "#111111" : "#ffffff"
  const fgColor = isDark ? "#ffffff" : "#000000"
  const borderColor = isLaser ? "#000000" : isDark ? "#111111" : "#000000"
  const frameInset = isLuxury ? 15 : 6

  const descLines = wrapDescriptionLines(prefs.descriptionText, 25)
  const hasDesc = descLines.length > 0
  const descFontSize = 24
  const descLineHeight = 31

  let descSvg = ""
  let qrModulesTop = 0
  const qrPlatePad = isDark || isLaser ? 14 : 0
  const ratioPct = clampCutMarginRatio(prefs.cutMarginRatio)
  // User-configurable distance ratio (%) from the outer cut guide line / border to the QR code
  const cutDistanceUnits = Math.round((w * ratioPct) / 100)
  const minSafeLeft = frameInset + 10 + qrPlatePad
  const qrModulesLeft = Math.max(minSafeLeft, cutDistanceUnits + qrPlatePad)
  const qrModulesSize = Math.max(120, w - qrModulesLeft * 2)
  const verticalPad = Math.max(14, Math.round(cutDistanceUnits * 0.55))
  const innerGap = Math.max(14, Math.round(cutDistanceUnits * 0.48))

  if (hasDesc) {
    if (isBadge) {
      const boxX = Math.max(frameInset + 16, qrModulesLeft - qrPlatePad)
      const boxY = frameInset + verticalPad
      const boxW = w - boxX * 2
      const padY = 13
      const boxH = descLines.length * descLineHeight + padY * 2 - 6
      const boxFill = isLaser || isDark ? "none" : "#f2f2f7"
      descSvg += `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="16" ry="16" fill="${boxFill}" stroke="${fgColor}" stroke-width="2"/>`
      const firstLineY = boxY + padY + 18
      descSvg += descLines
        .map(
          (line, idx) =>
            `<text class="qr-svg-desc" x="${w / 2}" y="${firstLineY + idx * descLineHeight}" text-anchor="middle" font-family="${SVG_FONT_STACK}" font-size="${descFontSize - 1}" font-weight="700" fill="${fgColor}">${escapeHtml(line)}</text>`,
        )
        .join("")
      qrModulesTop = boxY + boxH + innerGap + qrPlatePad
    } else {
      const firstLineY = frameInset + verticalPad + 19
      descSvg += descLines
        .map(
          (line, idx) =>
            `<text class="qr-svg-desc" x="${w / 2}" y="${firstLineY + idx * descLineHeight}" text-anchor="middle" font-family="${SVG_FONT_STACK}" font-size="${descFontSize}" font-weight="700" fill="${fgColor}">${escapeHtml(line)}</text>`,
        )
        .join("")
      const descBottom = frameInset + verticalPad + descLines.length * descLineHeight - 6
      qrModulesTop = descBottom + innerGap + qrPlatePad
    }
  } else {
    // When there is no text, top distance from cut line to QR equals left/right distance
    qrModulesTop = qrModulesLeft
  }

  const matrix = encodeQrMatrix(url)
  const n = matrix.length
  const moduleScale = qrModulesSize / n

  let qrPath = ""
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (qrModulesLeft + c * moduleScale).toFixed(2)
        const y = (qrModulesTop + r * moduleScale).toFixed(2)
        const ms = moduleScale.toFixed(2)
        qrPath += `M${x} ${y}h${ms}v${ms}h-${ms}z`
      }
    }
  }

  const qrPlateSvg =
    qrPlatePad > 0
      ? `<rect x="${qrModulesLeft - qrPlatePad}" y="${qrModulesTop - qrPlatePad}" width="${qrModulesSize + qrPlatePad * 2}" height="${qrModulesSize + qrPlatePad * 2}" rx="18" ry="18" fill="#ffffff" ${isLaser ? 'stroke="#000000" stroke-width="2.5"' : ""}/>`
      : ""

  const qrVisualBottom = qrModulesTop + qrModulesSize + qrPlatePad
  const tableFontSize = 48
  const safeTable = escapeHtml(tableName)

  let dividerSvg = ""
  let tableSectionTop = qrVisualBottom + innerGap
  if (isLuxury) {
    const lineY = qrVisualBottom + innerGap
    const lineLeft = qrModulesLeft - qrPlatePad
    dividerSvg = `<line x1="${lineLeft}" y1="${lineY}" x2="${w - lineLeft}" y2="${lineY}" stroke="${fgColor}" stroke-width="2.2"/>`
    tableSectionTop = lineY + Math.max(14, Math.round(innerGap * 0.85))
  }

  let tableSvg = ""
  let bottomContentEnd = 0

  if (isBadge) {
    const pillH = 62
    const pillW = Math.max(136, Math.min(w - 80, safeTable.length * 30 + 76))
    const pillX = Math.round((w - pillW) / 2)
    const pillY = tableSectionTop
    const pillCenterY = pillY + Math.round(pillH / 2)
    if (isLaser) {
      tableSvg = `<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="none" stroke="#000000" stroke-width="3.5"/><text class="qr-svg-table" x="${w / 2}" y="${pillCenterY + 14}" text-anchor="middle" font-family="${SVG_FONT_STACK}" font-size="40" font-weight="900" letter-spacing="0.8" fill="#000000">${safeTable}</text>`
    } else {
      const pillFill = isDark ? "#ffffff" : "#000000"
      const pillTextFill = isDark ? "#111111" : "#ffffff"
      tableSvg = `<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${pillFill}"/><text class="qr-svg-table" x="${w / 2}" y="${pillCenterY + 14}" text-anchor="middle" font-family="${SVG_FONT_STACK}" font-size="40" font-weight="900" letter-spacing="0.8" fill="${pillTextFill}">${safeTable}</text>`
    }
    bottomContentEnd = pillY + pillH
  } else {
    const tableBaselineY = tableSectionTop + 40
    tableSvg = `<text class="qr-svg-table" x="${w / 2}" y="${tableBaselineY}" text-anchor="middle" font-family="${SVG_FONT_STACK}" font-size="${tableFontSize}" font-weight="900" letter-spacing="0.8" fill="${fgColor}">${safeTable}</text>`
    bottomContentEnd = tableBaselineY + 8
  }

  const bottomPad = Math.max(16, Math.round(cutDistanceUnits * 0.6))
  const h = Math.round(bottomContentEnd + bottomPad + frameInset)

  let frameSvg = `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="32" ry="32" fill="${bgFill}" stroke="${borderColor}" stroke-width="${isLaser ? 4.5 : 4}"/>`
  if (isLuxury) {
    frameSvg += `<rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="23" ry="23" fill="none" stroke="${fgColor}" stroke-width="2.2"/>`
  }

  const showCrops = prefs.showCropMarks && prefs.printMedium !== "sticker"
  const cropBleed = showCrops ? 18 : 0
  const cropColor = isLaser ? "#000000" : "#8e8e93"
  const cropSvg = showCrops
    ? `<rect x="${-10}" y="${-10}" width="${w + 20}" height="${h + 20}" rx="38" ry="38" fill="none" stroke="${cropColor}" stroke-width="2" stroke-dasharray="10 7"/>`
    : ""

  const vbX = -cropBleed
  const vbY = -cropBleed
  const vbW = w + cropBleed * 2
  const vbH = h + cropBleed * 2
  const effectiveHeightMm = Number(((sizeSpec.widthMm * vbH) / vbW).toFixed(2))

  const sizeAttrs = forInlinePreview
    ? `width="100%" height="auto" style="max-width:225px;display:block;"`
    : `width="${sizeSpec.widthMm}mm" height="${effectiveHeightMm}mm"`

  const xmlHeader = forInlinePreview ? "" : `<?xml version="1.0" encoding="UTF-8"?>\n`

  return `${xmlHeader}<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs} viewBox="${vbX} ${vbY} ${vbW} ${vbH}" shape-rendering="geometricPrecision">
  <defs>
    <style>
      .qr-svg-desc { font-family: ${SVG_FONT_STACK}; font-weight: 700; }
      .qr-svg-table { font-family: ${SVG_FONT_STACK}; font-weight: 900; }
    </style>
  </defs>
  ${cropSvg}
  ${frameSvg}
  ${descSvg}
  ${qrPlateSvg}
  <path d="${qrPath}" fill="#000000" shape-rendering="crispEdges"/>
  ${dividerSvg}
  ${tableSvg}
</svg>`
}

export function sanitizeQrFilenameSegment(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "masa"
  )
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

export function downloadBulkVectorSvgZip(params: {
  restaurantSlug: string
  items: Array<{ tableName: string; section?: string; url: string }>
  prefs: QrStudioPreferences
}): number {
  const { restaurantSlug, items, prefs } = params
  if (items.length === 0) return 0

  const usedNames = new Set<string>()
  const entries: ZipTextEntry[] = items.map((item, idx) => {
    const svg = buildStandaloneVectorCardSvg({
      tableName: item.tableName,
      url: item.url,
      prefs,
    })
    const baseTable = sanitizeQrFilenameSegment(item.tableName)
    let filename = `qr-${baseTable}-${prefs.cardSize}.svg`
    if (usedNames.has(filename)) {
      filename = `qr-${baseTable}-${idx + 1}-${prefs.cardSize}.svg`
    }
    usedNames.add(filename)
    return { filename, content: svg }
  })

  const cleanSlug = sanitizeQrFilenameSegment(restaurantSlug || "corder")
  downloadZipArchive(`${cleanSlug}-qr-svg-${prefs.cardSize}.zip`, entries)
  return entries.length
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

  const cardsHtml = items
    .map(({ tableName, url }) => {
      const cardSvg = buildStandaloneVectorCardSvg({ tableName, url, prefs })
      return `<div class="card-wrap">${cardSvg}</div>`
    })
    .join("")

  const pageCss = isSticker
    ? `@page { size: ${sizeSpec.widthMm}mm auto; margin: 0; }
       body { margin: 0; padding: 0; }
       .sheet-grid { display: flex; flex-direction: column; align-items: center; }
       .card-wrap { page-break-after: always; break-after: page; display: flex; align-items: center; justify-content: center; }`
    : `@page { size: A4 portrait; margin: 10mm; }
       body { margin: 0; padding: 8mm; }
       .sheet-grid { display: grid; grid-template-columns: repeat(${sizeSpec.colsOnA4}, ${sizeSpec.widthMm}mm); gap: ${isPvc ? "8mm" : "6mm"}; justify-content: center; align-items: start; }`

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>Masa QR Baskı Şablonu (${sizeSpec.widthMm}mm)</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: ${SVG_FONT_STACK}; background: #ffffff; color: #000000; }
  ${pageCss}
  .card-wrap { position: relative; width: ${sizeSpec.widthMm}mm; page-break-inside: avoid; break-inside: avoid; display: flex; justify-content: center; }
  .card-wrap > svg { width: ${sizeSpec.widthMm}mm; height: auto; display: block; }
  .card-wrap.with-crops::before {
    content: ""; position: absolute; inset: -1.8mm; pointer-events: none;
    border: 0.25mm dashed ${isLaser ? "#000000" : "#999999"}; border-radius: 4.5mm;
  }
</style>
</head>
<body>
  <div class="sheet-grid">${cardsHtml}</div>
  <script>window.onload = () => setTimeout(() => window.print(), 220);</script>
</body>
</html>`
}
