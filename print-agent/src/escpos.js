const PAYMENT_METHOD_LABELS = {
  cash: "NAKİT",
  "credit-card": "KREDİ KARTI",
  "meal-card": "YEMEK KARTI",
  multinet: "MULTİNET",
  split: "PARÇALI ÖDEME",
  ledger: "CARİ HESAP",
}

/**
 * CP857 (PC857 Turkish) single-byte mapping for non-ASCII Turkish characters (ESC t 18).
 */
const CP857_MAP = new Map([
  ["\u00c7", 0x80], ["\u00fc", 0x81], ["\u00e9", 0x82], ["\u00e2", 0x83],
  ["\u00e4", 0x84], ["\u00e7", 0x87], ["\u00ea", 0x88], ["\u00eb", 0x89],
  ["\u00ee", 0x8c], ["\u0131", 0x8d], ["\u00c4", 0x8e], ["\u00f4", 0x93],
  ["\u00f6", 0x94], ["\u00fb", 0x96], ["\u0130", 0x98], ["\u00d6", 0x99],
  ["\u00dc", 0x9a], ["\u015e", 0x9e], ["\u015f", 0x9f], ["\u011e", 0xa6],
  ["\u011f", 0xa7],
])

function trAsciiFallback(text) {
  if (!text) return ""
  return String(text)
    .replaceAll("\u20ba", "TL")
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2022", "*")
    .replaceAll("\u0130", "I").replaceAll("\u0131", "i")
    .replaceAll("\u015e", "S").replaceAll("\u015f", "s")
    .replaceAll("\u011e", "G").replaceAll("\u011f", "g")
    .replaceAll("\u00dc", "U").replaceAll("\u00fc", "u")
    .replaceAll("\u00d6", "O").replaceAll("\u00f6", "o")
    .replaceAll("\u00c7", "C").replaceAll("\u00e7", "c")
    .replaceAll("\u00e2", "a").replaceAll("\u00ee", "i").replaceAll("\u00fb", "u")
}

function trSafe(text, asciiOnly = false) {
  if (text === undefined || text === null) return ""
  const base = String(text)
    .replaceAll("\u20ba", "TL")
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2022", "*")
  if (asciiOnly) return trAsciiFallback(base)

  let out = ""
  for (const ch of base) {
    const code = ch.charCodeAt(0)
    if (ch === "\n" || (code >= 0x20 && code <= 0x7e) || CP857_MAP.has(ch)) {
      out += ch
    } else {
      const ascii = trAsciiFallback(ch)
      const ac = ascii.charCodeAt(0)
      out += ac >= 0x20 && ac <= 0x7e ? ascii : "?"
    }
  }
  return out
}

function formatTitleCaseTr(input) {
  if (input === undefined || input === null) return ""
  const normalized = String(input)
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0307/g, "")
  if (!normalized) return ""
  return normalized.replace(
    /(^|[\s\-/(&+.,:;])([a-zA-ZçğıöşüÇĞİÖŞÜ])/gu,
    (_m, sep, ch) => `${sep}${ch.toLocaleUpperCase("tr-TR")}`,
  )
}

function encodeCp857(str, asciiOnly = false) {
  const normalized = trSafe(str, asciiOnly)
  const bytes = new Uint8Array(normalized.length)
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (!asciiOnly && CP857_MAP.has(ch)) {
      bytes[i] = CP857_MAP.get(ch)
    } else {
      const code = ch.charCodeAt(0)
      bytes[i] = code === 0x0a || (code >= 0x20 && code <= 0x7e) ? code : 0x3f
    }
  }
  return Buffer.from(bytes)
}

function formatPaymentMethodLabel(method) {
  if (!method) return ""
  const key = String(method).trim().toLowerCase()
  return PAYMENT_METHOD_LABELS[key] || trSafe(String(method).toUpperCase())
}

function toMinorUnits(value) {
  const num = Number(value)
  return Number.isFinite(num) ? Math.round(num * 100) : 0
}

function money(value) {
  const minorUnits = toMinorUnits(value)
  const negative = minorUnits < 0
  const absMinorUnits = Math.abs(minorUnits)
  const majorUnits = Math.floor(absMinorUnits / 100)
  const cents = String(absMinorUnits % 100).padStart(2, "0")
  const majorFormatted = majorUnits.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${negative ? "-" : ""}${majorFormatted},${cents}`
}

function formatTicketDate(input) {
  const d = input ? new Date(input) : new Date()
  if (Number.isNaN(d.getTime())) return formatTicketDate()
  try {
    const parts = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(d)
    const map = {}
    for (const p of parts) map[p.type] = p.value
    if (map.day && map.month && map.year && map.hour && map.minute && map.second) {
      return `${map.day}.${map.month}.${map.year} ${map.hour}:${map.minute}:${map.second}`
    }
  } catch {
    // Fallback below
  }
  const pad = (n) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function orderNumberFromId(id) {
  const s = String(id || "")
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return String(((h >>> 0) % 9000) + 1000)
}

function clampWidth(n) {
  const w = Number(n)
  return Number.isFinite(w) ? Math.min(64, Math.max(24, Math.floor(w))) : 42
}

function kvLine(label, value, width) {
  const leftPart = `${trSafe(label)}:`.padEnd(13, " ")
  const line = `${leftPart} ${trSafe(value)}`.trimEnd()
  return line.length > width ? `${line.slice(0, width)}\n` : `${line}\n`
}

function kvWrappedLines(label, value, width) {
  const leftPart = `${trSafe(label)}:`.padEnd(13, " ")
  const indent = leftPart.length + 1
  const lines = wrapWords(value || "-", Math.max(8, width - indent))
  if (!lines.length) return `${leftPart} -\n`
  return lines
    .map((seg, idx) => (idx === 0 ? `${leftPart} ${seg}\n` : `${" ".repeat(indent)}${seg}\n`))
    .join("")
}

function hrLine(char, width) {
  return `${(char && char[0] ? char[0] : "-").repeat(width)}\n`
}

function justifyLabelAmount(label, amount, width, prefix = "") {
  const right = `${prefix}${money(amount)} TL`
  const left = trSafe(label)
  const gap = width - left.length - right.length
  return gap < 1 ? `${left} ${right}\n` : `${left}${" ".repeat(gap)}${right}\n`
}

function wrapWords(text, maxLen) {
  const raw = trSafe(text).trim()
  if (!raw) return []
  const words = raw.split(/\s+/).filter(Boolean)
  const lines = []
  let line = ""
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (candidate.length <= maxLen) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    if (w.length <= maxLen) {
      line = w
      continue
    }
    let rest = w
    while (rest.length > maxLen) {
      lines.push(rest.slice(0, maxLen))
      rest = rest.slice(maxLen)
    }
    line = rest
  }
  if (line) lines.push(line)
  return lines
}

function centerLine(text, width) {
  const t = trSafe(text).trim()
  if (!t) return ""
  if (t.length <= width) {
    return `${" ".repeat(Math.floor((width - t.length) / 2))}${t}\n`
  }
  return wrapWords(t, width)
    .map((ln) => `${" ".repeat(Math.floor(Math.max(0, width - ln.length) / 2))}${ln}\n`)
    .join("")
}

function noteBlock(note, width, columnIndent = 2) {
  const n = String(note || "").trim()
  if (!n) return ""
  const indent = Math.max(0, Math.floor(columnIndent))
  const wrapped = wrapWords(`NOT: ${trSafe(n)}`, Math.max(8, width - indent))
  return wrapped.map((ln) => `${" ".repeat(indent)}${ln}\n`).join("")
}

const COL_GAP = " "

function receiptColLayout(width) {
  const qtyW = 5
  const priceW = width <= 34 ? 11 : 13
  const gapLen = COL_GAP.length
  const nameW = Math.max(8, width - qtyW - priceW - gapLen * 2)
  return { qtyW, priceW, gapLen, nameW }
}

function receiptHeaderRow(width) {
  const { qtyW, priceW, nameW } = receiptColLayout(width)
  const hQty = trSafe("Adet").slice(0, qtyW).padEnd(qtyW, " ")
  const hName = trSafe("Ürün").slice(0, nameW).padEnd(nameW, " ")
  const hPrice = trSafe("Tutar").slice(0, priceW).padStart(priceW, " ")
  return `${hQty}${COL_GAP}${hName}${COL_GAP}${hPrice}\n`
}

function receiptItemRows(qty, unitPrice, name, width) {
  const { qtyW, priceW, nameW } = receiptColLayout(width)
  const numQty = Number(qty) || 0
  const unitMinorUnits = toMinorUnits(unitPrice)
  const lineTotal = (unitMinorUnits * numQty) / 100
  const qStr = `${numQty}x`.slice(0, qtyW).padEnd(qtyW, " ")
  const priceStr = `${money(lineTotal)} TL`.slice(0, priceW).padStart(priceW, " ")
  let nameLines = wrapWords(trSafe(name).trim() || "Ürün", nameW)
  if (!nameLines.length) nameLines = ["Ürün"]

  const lines = []
  for (let i = 0; i < nameLines.length; i++) {
    const seg = nameLines[i].slice(0, nameW).padEnd(nameW, " ")
    lines.push(i === 0 ? `${qStr}${COL_GAP}${seg}${COL_GAP}${priceStr}` : `${" ".repeat(qtyW)}${COL_GAP}${seg}`)
  }
  if (numQty > 1 && unitMinorUnits > 0) {
    const unitHint = `(@ ${money(unitPrice)} TL)`
    if (unitHint.length <= nameW) lines.push(`${" ".repeat(qtyW)}${COL_GAP}${unitHint}`)
  }
  return `${lines.join("\n")}\n`
}

function kitchenItemRows(qty, name, width) {
  const qtyW = 6
  const gapLen = 2
  const nameW = Math.max(10, width - qtyW - gapLen)
  const qStr = `${Number(qty) || 0}x`.slice(0, qtyW).padEnd(qtyW, " ")
  let nameLines = wrapWords(trSafe(name).trim() || "Ürün", nameW)
  if (!nameLines.length) nameLines = ["Ürün"]
  const contPrefix = " ".repeat(qtyW + gapLen)
  return `${nameLines.map((seg, i) => (i === 0 ? `${qStr}  ${seg.slice(0, nameW)}` : `${contPrefix}${seg.slice(0, nameW)}`)).join("\n")}\n`
}

function kitchenHeaderRow(width) {
  const qtyW = 6
  return `${trSafe("Adet").slice(0, qtyW).padEnd(qtyW, " ")}  ${trSafe("Ürün").slice(0, Math.max(10, width - qtyW - 2))}\n`
}

const ESC_INIT = Buffer.from([0x1b, 0x40])
const ESC_CODEPAGE_CP857 = Buffer.from([0x1b, 0x74, 0x12])
const BOLD_ON = Buffer.from([0x1b, 0x45, 0x01])
const BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00])
const SIZE_DOUBLE_HEIGHT = Buffer.from([0x1d, 0x21, 0x01])
const SIZE_NORMAL = Buffer.from([0x1d, 0x21, 0x00])
const CUT_FULL = Buffer.from([0x1d, 0x56, 0x00])
const CASH_DRAWER_KICK_PIN2 = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])

function escposBytes(bodyBuffer, feedLinesBeforeCut = 3, opts = {}) {
  const lines = Math.min(255, Math.max(0, Math.floor(Number(feedLinesBeforeCut) || 0)))
  // Re-select CP857 after init. Many SPRT/CUPS paths ignore the first ESC t;
  // ASCII fallback (options.asciiFallback) is the reliable path for those devices.
  const parts = [ESC_INIT, ESC_CODEPAGE_CP857, ESC_CODEPAGE_CP857]
  if (opts.openCashDrawer) parts.push(CASH_DRAWER_KICK_PIN2)
  parts.push(bodyBuffer)
  if (lines > 0) parts.push(Buffer.from([0x1b, 0x64, lines]))
  if (opts.autoCut !== false) parts.push(CUT_FULL)
  return Buffer.concat(parts)
}

function appendKitchenItemsBlock(chunks, push, items, width, showLineNotes) {
  push(hrLine("-", width))
  chunks.push(BOLD_ON)
  push(kitchenHeaderRow(width))
  chunks.push(BOLD_OFF)
  push(hrLine("-", width))
  for (const item of items || []) {
    chunks.push(BOLD_ON)
    push(kitchenItemRows(Number(item.quantity || 0), formatTitleCaseTr(item.productName || item.name) || "Ürün", width))
    chunks.push(BOLD_OFF)
    if (showLineNotes && item.note) {
      const nb = noteBlock(item.note, width, 8)
      if (nb) push(nb)
    }
  }
  push(hrLine("-", width))
}

function appendTicketBanner(chunks, push, width, isReprint, stamp, heading) {
  if (isReprint) {
    chunks.push(BOLD_ON, SIZE_DOUBLE_HEIGHT)
    push(centerLine("*** TEKRAR BASKI ***", width))
    chunks.push(SIZE_NORMAL, BOLD_OFF)
  }
  if (stamp) {
    chunks.push(BOLD_ON)
    push(centerLine(stamp, width))
    chunks.push(BOLD_OFF)
  }
  // Double-height fonts on many SP-EP/SPRT heads lack Turkish glyphs (İ/Ş/ı);
  // keep the banner bold but normal size so CP857/ASCII maps render correctly.
  chunks.push(BOLD_ON)
  push(centerLine(heading, width))
  chunks.push(BOLD_OFF)
}

function buildKitchenTicket(payload, options = {}) {
  const width = clampWidth(options.charsPerLine)
  const footerLine = String(options.footerLine || "").trim()
  const feedBeforeCut = Math.min(255, Math.max(0, Number(options.feedLinesBeforeCut) ?? 6))
  const asciiOnly = Boolean(options.asciiFallback)
  const chunks = []
  const push = (s) => chunks.push(encodeCp857(s, asciiOnly))
  const stamp = String(options.ticketStamp || payload.targetPrinter?.name || "").trim()

  appendTicketBanner(chunks, push, width, payload.isReprint, stamp, "MUTFAK SİPARİŞ FİŞİ")
  push(kvLine("Tarih/Saat", formatTicketDate(payload.createdAt), width))
  push(kvLine("Sipariş No", orderNumberFromId(payload.jobId), width))
  chunks.push(BOLD_ON)
  push(kvLine("Masa", payload.tableName || "-", width))
  chunks.push(BOLD_OFF)
  push(kvLine("Garson", formatTitleCaseTr(payload.waiterName) || "-", width))

  appendKitchenItemsBlock(chunks, push, payload.items, width, options.includeLineNotes !== false)
  if (footerLine) {
    push(centerLine(footerLine, width))
  }
  return escposBytes(Buffer.concat(chunks), feedBeforeCut, { autoCut: options.autoCut !== false })
}

function buildReceipt(payload, options = {}) {
  const width = clampWidth(options.charsPerLine)
  const footerLine = String(options.footerLine || "").trim()
  const feedBeforeCut = Math.min(255, Math.max(0, Number(options.feedLinesBeforeCut) ?? 6))
  const asciiOnly = Boolean(options.asciiFallback)
  const chunks = []
  const push = (s) => chunks.push(encodeCp857(s, asciiOnly))
  const stamp = String(options.ticketStamp || "").trim()

  appendTicketBanner(chunks, push, width, payload.isReprint, stamp, "ADİSYON / HESAP FİŞİ")
  push(kvLine("Tarih/Saat", formatTicketDate(payload.createdAt), width))
  push(kvLine("Fiş No", orderNumberFromId(payload.jobId), width))
  push(kvLine("Masa", payload.tableName || "-", width))
  push(kvLine("Garson", formatTitleCaseTr(payload.waiterName) || "-", width))
  if (payload.paymentMethod) {
    push(kvLine("Ödeme Tipi", formatPaymentMethodLabel(payload.paymentMethod), width))
  }

  push(hrLine("-", width))
  chunks.push(BOLD_ON)
  push(receiptHeaderRow(width))
  chunks.push(BOLD_OFF)
  push(hrLine("-", width))

  const layout = receiptColLayout(width)
  const noteIndent = layout.qtyW + layout.gapLen
  const showLineNotes = options.includeLineNotes !== false

  let computedSubtotalMinorUnits = 0
  for (const item of payload.items || []) {
    const qty = Number(item.quantity || 0)
    const unit = Number(item.price || 0)
    computedSubtotalMinorUnits += toMinorUnits(unit) * qty
    push(receiptItemRows(qty, unit, formatTitleCaseTr(item.productName || item.name) || "Ürün", width))
    if (showLineNotes && item.note) {
      const nb = noteBlock(item.note, width, noteIndent)
      if (nb) push(nb)
    }
  }

  const subtotalVal =
    payload.subtotal !== undefined && payload.subtotal !== null && Number.isFinite(Number(payload.subtotal))
      ? Number(payload.subtotal)
      : computedSubtotalMinorUnits / 100
  const discountVal = Number(payload.discountAmount || 0)
  const tipVal = Number(payload.tipAmount || 0)
  const totalVal =
    payload.total !== undefined && payload.total !== null && Number.isFinite(Number(payload.total))
      ? Number(payload.total)
      : Math.max(0, (toMinorUnits(subtotalVal) - toMinorUnits(discountVal)) / 100)

  push(hrLine("-", width))
  if (toMinorUnits(discountVal) > 0 || toMinorUnits(tipVal) > 0 || toMinorUnits(subtotalVal) !== toMinorUnits(totalVal)) {
    push(justifyLabelAmount("Ara Toplam:", subtotalVal, width))
    if (toMinorUnits(discountVal) > 0) {
      push(justifyLabelAmount(`${payload.discountLabel || "İndirim"}:`, discountVal, width, "-"))
    }
    if (toMinorUnits(tipVal) > 0) {
      push(justifyLabelAmount("Bahşiş:", tipVal, width, "+"))
    }
  }
  chunks.push(BOLD_ON)
  push(justifyLabelAmount("TOPLAM:", totalVal, width))
  chunks.push(BOLD_OFF)
  push(hrLine("-", width))

  chunks.push(BOLD_ON)
  push(centerLine("BİLGİ FİŞİDİR / MALİ DEĞERİ YOKTUR", width))
  chunks.push(BOLD_OFF)
  if (footerLine) push(centerLine(footerLine, width))

  const shouldKickDrawer =
    options.openCashDrawer !== undefined
      ? Boolean(options.openCashDrawer)
      : Boolean(payload.openCashDrawer || (payload.paymentMethod === "cash" && !payload.isReprint))

  return escposBytes(Buffer.concat(chunks), feedBeforeCut, {
    autoCut: options.autoCut !== false,
    openCashDrawer: shouldKickDrawer,
  })
}

function buildKitchenCancelTicket(payload, options = {}) {
  const width = clampWidth(options.charsPerLine)
  const footerLine = String(options.footerLine || "").trim()
  const feedBeforeCut = Math.min(255, Math.max(0, Number(options.feedLinesBeforeCut) ?? 6))
  const asciiOnly = Boolean(options.asciiFallback)
  const chunks = []
  const push = (s) => chunks.push(encodeCp857(s, asciiOnly))
  const stamp = String(options.ticketStamp || payload.targetPrinter?.name || "").trim()

  appendTicketBanner(chunks, push, width, false, stamp, "MUTFAK İPTAL FİŞİ")
  push(kvLine("Tarih/Saat", formatTicketDate(payload.createdAt), width))
  chunks.push(BOLD_ON)
  push(kvLine("Masa", payload.tableName || "-", width))
  chunks.push(BOLD_OFF)
  push(kvLine("İptal Eden", formatTitleCaseTr(payload.cancelledBy || payload.waiterName) || "-", width))
  push(kvWrappedLines("İptal Nedeni", payload.cancelReason || "-", width))

  appendKitchenItemsBlock(chunks, push, payload.items, width, options.includeLineNotes !== false)
  if (footerLine) {
    push(centerLine(footerLine, width))
  }
  return escposBytes(Buffer.concat(chunks), feedBeforeCut, { autoCut: options.autoCut !== false })
}

function buildTestTicket(printerInfo = {}, options = {}) {
  const paperWidth = Number(printerInfo.paperWidth) === 58 ? 58 : 80
  const width = clampWidth(options.charsPerLine || (paperWidth === 58 ? 32 : 42))
  const feedBeforeCut = Math.min(
    255,
    Math.max(0, Number(options.feedLinesBeforeCut ?? printerInfo.feedLinesBeforeCut ?? 3)),
  )
  // Default ON for system/CUPS printers — SP-EP ignores ESC t CP857.
  const asciiOnly = options.asciiFallback !== false
  const targetDesc =
    printerInfo.mode === "network"
      ? `TCP ${printerInfo.host || "127.0.0.1"}:${printerInfo.port || 9100}`
      : `USB/OS: ${printerInfo.systemPrinterName || printerInfo.name || "VARSAYILAN"}`
  const modeLabel = asciiOnly ? "ASCII (TR guvenli)" : "CP857"

  const chunks = [BOLD_ON, encodeCp857(centerLine("CORDER YAZICI TESTI", width), asciiOnly), BOLD_OFF]
  const push = (s) => chunks.push(encodeCp857(s, asciiOnly))
  push(hrLine("-", width))
  push(kvLine("Tarih/Saat", formatTicketDate(), width))
  push(kvLine("Yazici", printerInfo.name || "Test Yazicisi", width))
  push(kvLine("Baglanti", targetDesc, width))
  push(kvLine("Kagit", `${paperWidth}mm (${width} kolon)`, width))
  push(kvLine("Kodlama", modeLabel, width))
  push(hrLine("-", width))
  push(centerLine(`TURKCE KARAKTER TESTI (${modeLabel})`, width))
  // Same Turkish sample; with asciiFallback becomes CIGOSU cigosu — readable on SP-EP.
  push(centerLine("ÇĞİÖŞÜ çğıöşü - 1234567890", width))
  push(`${"1234567890".repeat(Math.ceil(width / 10)).slice(0, width)}\n`)
  push(hrLine("-", width))
  push(centerLine("BAGLANTI BASARILI - CORDER POS", width))
  return escposBytes(Buffer.concat(chunks), feedBeforeCut, {
    autoCut: printerInfo.autoCut !== false && options.autoCut !== false,
  })
}

module.exports = {
  buildKitchenTicket,
  buildReceipt,
  buildKitchenCancelTicket,
  buildTestTicket,
  formatPaymentMethodLabel,
  encodeCp857,
  trSafe,
  money,
}
