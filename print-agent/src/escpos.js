const PAYMENT_METHOD_LABELS = {
  cash: "NAKIT",
  "credit-card": "KREDI KARTI",
  "meal-card": "YEMEK KARTI",
  multinet: "MULTINET",
  split: "COKLU ODEME",
  ledger: "CARI",
}

function formatPaymentMethodLabel(method) {
  if (!method) return ""
  const key = String(method).trim().toLowerCase()
  return PAYMENT_METHOD_LABELS[key] || trSafe(String(method).toUpperCase())
}

function trSafe(text) {
  if (!text) return ""
  return String(text)
    .replaceAll("İ", "I")
    .replaceAll("ı", "i")
    .replaceAll("Ş", "S")
    .replaceAll("ş", "s")
    .replaceAll("Ğ", "G")
    .replaceAll("ğ", "g")
    .replaceAll("Ü", "U")
    .replaceAll("ü", "u")
    .replaceAll("Ö", "O")
    .replaceAll("ö", "o")
    .replaceAll("Ç", "C")
    .replaceAll("ç", "c")
}

function money(value) {
  const amount = Number(value || 0)
  return amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatTicketDate(input) {
  const d = input ? new Date(input) : new Date()
  if (Number.isNaN(d.getTime())) return formatTicketDate()
  const pad = (n) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function orderNumberFromId(id) {
  const s = String(id || "")
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = (h >>> 0) % 9000 + 1000
  return String(n)
}

function clampWidth(n) {
  const w = Number(n)
  if (!Number.isFinite(w)) return 42
  return Math.min(64, Math.max(24, Math.floor(w)))
}

function kvLine(label, value, width) {
  const leftPart = `${trSafe(label)}:`.padEnd(14, " ")
  const line = `${leftPart} ${trSafe(value)}`.trimEnd()
  return line.length > width ? `${line.slice(0, width)}\n` : `${line}\n`
}

function kvWrappedLines(label, value, width) {
  const leftPart = `${trSafe(label)}:`.padEnd(14, " ")
  const indent = leftPart.length + 1
  const maxValWidth = Math.max(8, width - indent)
  const lines = wrapWords(value || "-", maxValWidth)
  if (!lines.length) {
    return `${leftPart} -\n`
  }
  return lines
    .map((seg, idx) => (idx === 0 ? `${leftPart} ${seg}\n` : `${" ".repeat(indent)}${seg}\n`))
    .join("")
}

function hrLine(char, width) {
  const c = char && char.length ? char[0] : "-"
  return `${c.repeat(width)}\n`
}

function justifyLabelAmount(label, amount, width) {
  const right = `${money(amount)} TL`
  const left = trSafe(label)
  const gap = width - left.length - right.length
  if (gap < 1) return `${left} ${right}\n`
  return `${left}${" ".repeat(gap)}${right}\n`
}

function centerLine(text, width) {
  const t = trSafe(text)
  if (!t) return ""
  if (t.length >= width) return `${t.slice(0, width)}\n`
  const pad = width - t.length
  const left = Math.floor(pad / 2)
  return `${" ".repeat(left)}${t}\n`
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

function noteBlock(note, width, columnIndent = 2) {
  const n = String(note || "").trim()
  if (!n) return ""
  const indent = Math.max(0, Math.floor(columnIndent))
  const max = Math.max(8, width - indent)
  const prefixed = `NOT: ${trSafe(n)}`
  const wrapped = wrapWords(prefixed, max)
  return wrapped.map((ln) => `${" ".repeat(indent)}${ln}\n`).join("")
}

/** Gap between Unit Price column and Product column (spaces only). */
const COL_GAP = "  "

function tableColLayout(width) {
  const qtyW = 6
  const priceW = 14
  const gapLen = COL_GAP.length
  const nameW = Math.max(1, width - qtyW - priceW - gapLen)
  return { qtyW, priceW, gapLen, nameW }
}

/** Left column (Qty): header and values start at same x. */
function colQty(value, qtyW) {
  return trSafe(value).slice(0, qtyW).padEnd(qtyW, " ")
}

/** Price column: amounts right-aligned under header (same width). */
function colPriceMoney(amount, priceW) {
  return `${money(amount)} TL`.slice(0, priceW).padStart(priceW, " ")
}

function colPriceHeader(priceW) {
  return trSafe("Birim Fiyat").slice(0, priceW).padStart(priceW, " ")
}

/**
 * One item: qty + price on first line; long product names wrap only in the Product column,
 * continuation lines leave Qty/Unit Price columns blank.
 */
function tableItemRows(qty, unitPrice, name, width) {
  const { qtyW, priceW, nameW } = tableColLayout(width)
  const qStr = colQty(String(Number(qty) || 0), qtyW)
  const priceStr = colPriceMoney(unitPrice, priceW)
  const nm = trSafe(name).trim()
  let nameLines = nm ? wrapWords(nm, nameW) : [""]
  if (!nameLines.length) nameLines = [""]

  const contPrefix = " ".repeat(qtyW) + " ".repeat(priceW) + COL_GAP
  const lines = []
  for (let i = 0; i < nameLines.length; i++) {
    const seg = nameLines[i].slice(0, nameW).padEnd(nameW, " ")
    if (i === 0) lines.push(`${qStr}${priceStr}${COL_GAP}${seg}`)
    else lines.push(`${contPrefix}${seg}`)
  }
  return `${lines.join("\n")}\n`
}

function tableHeaderRow(width) {
  const { qtyW, priceW, nameW } = tableColLayout(width)
  const hQty = colQty("Miktar", qtyW)
  const hPrice = colPriceHeader(priceW)
  const hName = trSafe("Urun").slice(0, nameW).padEnd(nameW, " ")
  return `${hQty}${hPrice}${COL_GAP}${hName}\n`
}

function cancelItemRows(qty, name, width) {
  const qtyW = 8
  const gapLen = COL_GAP.length
  const nameW = Math.max(1, width - qtyW - gapLen)
  const qStr = colQty(String(Number(qty) || 0), qtyW)
  const nm = trSafe(name).trim()
  let nameLines = nm ? wrapWords(nm, nameW) : [""]
  if (!nameLines.length) nameLines = [""]

  const contPrefix = " ".repeat(qtyW) + COL_GAP
  const lines = []
  for (let i = 0; i < nameLines.length; i++) {
    const seg = nameLines[i].slice(0, nameW).padEnd(nameW, " ")
    if (i === 0) lines.push(`${qStr}${COL_GAP}${seg}`)
    else lines.push(`${contPrefix}${seg}`)
  }
  return `${lines.join("\n")}\n`
}

function cancelHeaderRow(width) {
  const qtyW = 8
  const gapLen = COL_GAP.length
  const nameW = Math.max(1, width - qtyW - gapLen)
  const hQty = colQty("Adet", qtyW)
  const hName = trSafe("Urun").slice(0, nameW).padEnd(nameW, " ")
  return `${hQty}${COL_GAP}${hName}\n`
}

function textBuf(s) {
  return Buffer.from(String(s), "ascii")
}

/** ESC/POS: bold on/off */
const BOLD_ON = Buffer.from([0x1b, 0x45, 0x01])
const BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00])
/**
 * GS ! n — Epson-style: n = (widthMul - 1) * 16 + (heightMul - 1).
 * 0x10 = double WIDTH only (breaks column layout). 0x01 = double height, normal width.
 */
const SIZE_DOUBLE_HEIGHT = Buffer.from([0x1d, 0x21, 0x01])
const SIZE_NORMAL = Buffer.from([0x1d, 0x21, 0x00])

/** ESC d n — print and feed n lines (before cut so totals are not clipped). */
function escFeedLines(n) {
  const lines = Math.min(255, Math.max(0, Math.floor(Number(n) || 0)))
  return Buffer.from([0x1b, 0x64, lines])
}

/**
 * Bottom: a few LFs + ESC d n before cut (tune with `TICKET_FEED_LINES_BEFORE_CUT`).
 */
function escposBytes(bodyBuffer, feedLinesBeforeCut = 6) {
  const init = Buffer.from([0x1b, 0x40])
  const cut = Buffer.from([0x1d, 0x56, 0x00])
  const tailLf = Buffer.from("\n".repeat(2), "ascii")
  const feed = escFeedLines(feedLinesBeforeCut)
  return Buffer.concat([init, bodyBuffer, tailLf, feed, cut])
}

function buildStandardTicket(payload, options = {}, heading = "SIPARIS") {
  const width = clampWidth(options.charsPerLine)
  const footerLine = String(options.footerLine || "").trim()
  const feedBeforeCut = Math.min(255, Math.max(0, Number(options.feedLinesBeforeCut) || 6))

  const chunks = []
  const push = (s) => chunks.push(textBuf(s))

  const stamp = String(options.ticketStamp || "").trim()
  if (stamp) {
    push(centerLine(stamp, width))
    push("\n")
  }

  push(kvLine("Tarih/Saat", formatTicketDate(payload.createdAt), width))
  push(kvLine("Siparis No", orderNumberFromId(payload.jobId), width))
  push(kvLine("Masa", payload.tableName || "-", width))
  push(kvLine("Garson", payload.waiterName || "-", width))
  if (payload.paymentMethod) {
    push(kvLine("Odeme", formatPaymentMethodLabel(payload.paymentMethod), width))
  }
  push("\n")

  chunks.push(BOLD_ON)
  chunks.push(SIZE_DOUBLE_HEIGHT)
  push(`${trSafe(heading)}\n`)
  chunks.push(SIZE_NORMAL)
  chunks.push(BOLD_OFF)
  push("\n")
  chunks.push(SIZE_NORMAL)

  push(hrLine("-", width))
  chunks.push(BOLD_ON)
  push(tableHeaderRow(width))
  chunks.push(BOLD_OFF)
  push(hrLine("-", width))

  const layout = tableColLayout(width)
  const nameColumnIndent = layout.qtyW + layout.priceW + layout.gapLen

  const showLineNotes = options.includeLineNotes !== false

  for (const item of payload.items || []) {
    const qty = Number(item.quantity || 0)
    const unit = Number(item.price || 0)
    const name = item.productName || item.name || "Urun"
    push(tableItemRows(qty, unit, name, width))
    if (showLineNotes) {
      const nb = noteBlock(item.note, width, nameColumnIndent)
      if (nb) push(nb)
    }
  }

  push(hrLine("-", width))
  push(justifyLabelAmount("Toplam:", Number(payload.total || 0), width))
  push(hrLine("-", width))

  if (footerLine) {
    push("\n")
    push(centerLine(footerLine, width))
  }

  return escposBytes(Buffer.concat(chunks), feedBeforeCut)
}

function buildKitchenTicket(payload, options) {
  return buildStandardTicket(payload, options || {}, "SIPARIS")
}

function buildReceipt(payload, options) {
  return buildStandardTicket(payload, options || {}, "HESAP FISI")
}

function buildKitchenCancelTicket(payload, options = {}) {
  const width = clampWidth(options.charsPerLine)
  const footerLine = String(options.footerLine || "").trim()
  const feedBeforeCut = Math.min(255, Math.max(0, Number(options.feedLinesBeforeCut) || 6))

  const chunks = []
  const push = (s) => chunks.push(textBuf(s))

  const stamp = String(options.ticketStamp || "").trim()
  if (stamp) {
    push(centerLine(stamp, width))
    push("\n")
  }

  chunks.push(BOLD_ON)
  chunks.push(SIZE_DOUBLE_HEIGHT)
  push("IPTAL\n")
  chunks.push(SIZE_NORMAL)
  chunks.push(BOLD_OFF)
  push("\n")

  push(kvLine("Tarih/Saat", formatTicketDate(payload.createdAt), width))
  push(kvLine("Masa", payload.tableName || "-", width))
  push(kvLine("Iptal Eden", payload.cancelledBy || payload.waiterName || "-", width))
  push(kvWrappedLines("Sebep", payload.cancelReason || "-", width))
  push("\n")

  push(hrLine("=", width))
  chunks.push(BOLD_ON)
  push(cancelHeaderRow(width))
  chunks.push(BOLD_OFF)
  push(hrLine("=", width))

  const nameColumnIndent = 8 + COL_GAP.length
  const showLineNotes = options.includeLineNotes !== false

  for (const item of payload.items || []) {
    const qty = Number(item.quantity || 0)
    const name = item.productName || item.name || "Urun"
    push(cancelItemRows(qty, name, width))
    if (showLineNotes) {
      const nb = noteBlock(item.note, width, nameColumnIndent)
      if (nb) push(nb)
    }
  }

  push(hrLine("=", width))

  if (footerLine) {
    push("\n")
    push(centerLine(footerLine, width))
  }

  return escposBytes(Buffer.concat(chunks), feedBeforeCut)
}

module.exports = {
  buildKitchenTicket,
  buildReceipt,
  buildKitchenCancelTicket,
  formatPaymentMethodLabel,
}
