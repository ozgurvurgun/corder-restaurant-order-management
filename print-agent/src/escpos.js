const {
  BOLD_ON,
  BOLD_OFF,
  SIZE_DOUBLE_HEIGHT,
  SIZE_NORMAL,
  trSafe,
  formatTitleCase,
  encodeCp857,
  formatPaymentMethodLabel,
  toMinorUnits,
  money,
  formatTicketDate,
  orderNumberFromId,
  clampWidth,
  kvLine,
  kvWrappedLines,
  hrLine,
  justifyLabelAmount,
  centerLine,
  noteBlock,
  receiptColLayout,
  receiptHeaderRow,
  receiptItemRows,
  kitchenItemRows,
  kitchenHeaderRow,
  escposBytes,
} = require("./escpos-encoding")

function appendKitchenItemsBlock(chunks, push, items, width, showLineNotes) {
  push(hrLine("-", width))
  chunks.push(BOLD_ON)
  push(kitchenHeaderRow(width))
  chunks.push(BOLD_OFF)
  push(hrLine("-", width))
  for (const item of items || []) {
    chunks.push(BOLD_ON)
    push(
      kitchenItemRows(
        Number(item.quantity || 0),
        formatTitleCase(item.productName || item.name) || "Ürün",
        width,
      ),
    )
    chunks.push(BOLD_OFF)
    if (showLineNotes && item.note) {
      const nb = noteBlock(formatTitleCase(item.note), width, 8)
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
  chunks.push(BOLD_ON)
  push(centerLine(heading, width))
  chunks.push(BOLD_OFF)
}

function resolveDepartmentTicketHeading(printerName, suffix) {
  const raw = String(printerName || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(termal|thermal)?\s*(yazıcısı|yazicisi|yazıcı|yazici|printer)\s*$/iu, "")
    .replace(/\b(sipariş|siparis|iptal)?\s*(fişi|fisi)\s*$/iu, "")
    .trim()
  const prefix = raw ? raw.toLocaleUpperCase("tr-TR") : "MUTFAK"
  return `${prefix} ${suffix}`
}

function resolveTicketOrderNumber(payload) {
  const explicit = String(payload?.orderNumber || "").trim()
  if (explicit) return explicit
  return orderNumberFromId(payload?.orderId || payload?.jobId, payload?.createdAt)
}

function buildKitchenTicket(payload, options = {}) {
  const width = clampWidth(options.charsPerLine)
  const footerLine = formatTitleCase(options.footerLine)
  const feedBeforeCut = Math.min(255, Math.max(0, Number(options.feedLinesBeforeCut) ?? 6))
  const asciiOnly = Boolean(options.asciiFallback)
  const chunks = []
  const push = (s) => chunks.push(encodeCp857(s, asciiOnly))
  const heading = resolveDepartmentTicketHeading(payload.targetPrinter?.name, "SİPARİŞ FİŞİ")

  appendTicketBanner(chunks, push, width, payload.isReprint, "", heading)
  push(kvLine("Tarih/Saat", formatTicketDate(payload.createdAt), width))
  push(kvLine("Sipariş No", resolveTicketOrderNumber(payload), width))
  chunks.push(BOLD_ON)
  push(kvLine("Masa", formatTitleCase(payload.tableName) || "-", width))
  chunks.push(BOLD_OFF)
  push(kvLine("Garson", formatTitleCase(payload.waiterName) || "-", width))

  appendKitchenItemsBlock(chunks, push, payload.items, width, options.includeLineNotes !== false)
  if (footerLine) {
    push(centerLine(footerLine, width))
  }
  return escposBytes(Buffer.concat(chunks), feedBeforeCut, { autoCut: options.autoCut !== false })
}

function buildShiftReportTicket(payload, options = {}) {
  const width = clampWidth(options.charsPerLine)
  const footerLine = formatTitleCase(options.footerLine)
  const feedBeforeCut = Math.min(255, Math.max(0, Number(options.feedLinesBeforeCut) ?? 6))
  const asciiOnly = Boolean(options.asciiFallback)
  const chunks = []
  const push = (s) => chunks.push(encodeCp857(s, asciiOnly))
  const r = payload.shiftReport || {}
  const isZ = String(r.reportType || "").toUpperCase() === "Z"
  const heading = isZ ? "Z RAPORU (KAPANIŞ RAPORU)" : "X RAPORU (ANLIK ÖZET)"
  const stamp = formatTitleCase(r.restaurantName)

  appendTicketBanner(chunks, push, width, payload.isReprint, stamp, heading)
  push(hrLine("-", width))
  push(kvLine("Rapor Tarihi", formatTicketDate(payload.createdAt), width))
  push(kvLine("Vardiya No", orderNumberFromId(r.shiftId || payload.jobId, r.openedAt || payload.createdAt), width))
  push(kvLine("Vardiya Açan", formatTitleCase(r.openedBy) || "-", width))
  if (r.closedBy) {
    push(kvLine("Vardiya Kapatan", formatTitleCase(r.closedBy), width))
  }
  push(kvLine("Açılış", formatTicketDate(r.openedAt), width))
  push(kvLine("Kapanış", r.closedAt ? formatTicketDate(r.closedAt) : "Açık Vardiya", width))
  push(kvLine("Kapanan Masa", `${Number(r.closedTablesCount || 0)} Adet`, width))

  push(hrLine("-", width))
  chunks.push(BOLD_ON)
  push(centerLine("ÖDEME KIRILIMI", width))
  chunks.push(BOLD_OFF)
  push(hrLine("-", width))
  push(justifyLabelAmount("Nakit:", Number(r.totalCash || 0), width))
  push(justifyLabelAmount("Kredi Kartı:", Number(r.totalCard || 0), width))
  push(justifyLabelAmount("Yemek Kartı:", Number(r.totalMealCard || 0), width))
  push(justifyLabelAmount("Multinet:", Number(r.totalMultinet || 0), width))
  push(justifyLabelAmount("Cari / Açık Hesap:", Number(r.totalLedger || 0), width))
  if (toMinorUnits(Number(r.discountTotal || 0)) > 0) {
    push(justifyLabelAmount("Toplam İndirim:", Number(r.discountTotal || 0), width, "-"))
  }

  push(hrLine("-", width))
  chunks.push(BOLD_ON)
  push(centerLine("KASA NAKİT ÖZETİ", width))
  chunks.push(BOLD_OFF)
  push(hrLine("-", width))
  push(justifyLabelAmount("Açılış Bakiyesi:", Number(r.openingBalance || 0), width))
  push(justifyLabelAmount("Nakit Giriş:", Number(r.cashIn || 0), width, "+"))
  push(justifyLabelAmount("Nakit Çıkış:", Number(r.cashOut || 0), width, "-"))
  chunks.push(BOLD_ON)
  push(justifyLabelAmount("Beklenen Nakit:", Number(r.expectedCash || 0), width))
  chunks.push(BOLD_OFF)
  if (r.closingBalance !== undefined && r.closingBalance !== null) {
    push(justifyLabelAmount("Sayılan Kapanış:", Number(r.closingBalance || 0), width))
    const diff = Number(r.cashDifference || 0)
    const diffPrefix = diff > 0 ? "+" : diff < 0 ? "-" : ""
    push(justifyLabelAmount("Kasa Farkı:", Math.abs(diff), width, diffPrefix))
  }

  push(hrLine("-", width))
  chunks.push(BOLD_ON)
  push(justifyLabelAmount("TOPLAM NET CİRO:", Number(r.totalRevenue || payload.total || 0), width))
  chunks.push(BOLD_OFF)
  push(hrLine("-", width))

  chunks.push(BOLD_ON)
  push(centerLine("DAHİLİ VARDİYA ÖZET RAPORUDUR", width))
  chunks.push(BOLD_OFF)
  if (footerLine) push(centerLine(footerLine, width))

  return escposBytes(Buffer.concat(chunks), feedBeforeCut, {
    autoCut: options.autoCut !== false,
    openCashDrawer: false,
  })
}

function buildReceipt(payload, options = {}) {
  if (payload && payload.shiftReport) {
    return buildShiftReportTicket(payload, options)
  }
  const width = clampWidth(options.charsPerLine)
  const footerLine = formatTitleCase(options.footerLine)
  const feedBeforeCut = Math.min(255, Math.max(0, Number(options.feedLinesBeforeCut) ?? 6))
  const asciiOnly = Boolean(options.asciiFallback)
  const chunks = []
  const push = (s) => chunks.push(encodeCp857(s, asciiOnly))

  appendTicketBanner(chunks, push, width, payload.isReprint, "", "ADİSYON / HESAP FİŞİ")
  push(kvLine("Tarih/Saat", formatTicketDate(payload.createdAt), width))
  push(kvLine("Sipariş No", resolveTicketOrderNumber(payload), width))
  push(kvLine("Masa", formatTitleCase(payload.tableName) || "-", width))
  push(kvLine("Garson", formatTitleCase(payload.waiterName) || "-", width))
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
    push(receiptItemRows(qty, unit, formatTitleCase(item.productName || item.name) || "Ürün", width))
    if (showLineNotes && item.note) {
      const nb = noteBlock(formatTitleCase(item.note), width, noteIndent)
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
  if (
    toMinorUnits(discountVal) > 0 ||
    toMinorUnits(tipVal) > 0 ||
    toMinorUnits(subtotalVal) !== toMinorUnits(totalVal)
  ) {
    push(justifyLabelAmount("Ara Toplam:", subtotalVal, width))
    if (toMinorUnits(discountVal) > 0) {
      push(justifyLabelAmount(`${formatTitleCase(payload.discountLabel) || "İndirim"}:`, discountVal, width, "-"))
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
  const footerLine = formatTitleCase(options.footerLine)
  const feedBeforeCut = Math.min(255, Math.max(0, Number(options.feedLinesBeforeCut) ?? 6))
  const asciiOnly = Boolean(options.asciiFallback)
  const chunks = []
  const push = (s) => chunks.push(encodeCp857(s, asciiOnly))
  const heading = resolveDepartmentTicketHeading(payload.targetPrinter?.name, "İPTAL FİŞİ")

  appendTicketBanner(chunks, push, width, false, "", heading)
  push(kvLine("Tarih/Saat", formatTicketDate(payload.createdAt), width))
  push(kvLine("Sipariş No", resolveTicketOrderNumber(payload), width))
  chunks.push(BOLD_ON)
  push(kvLine("Masa", formatTitleCase(payload.tableName) || "-", width))
  chunks.push(BOLD_OFF)
  push(kvLine("İptal Eden", formatTitleCase(payload.cancelledBy || payload.waiterName) || "-", width))
  push(kvWrappedLines("İptal Nedeni", formatTitleCase(payload.cancelReason) || "-", width))

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
  const asciiOnly = options.asciiFallback !== false
  const targetDesc =
    printerInfo.mode === "network"
      ? `TCP ${printerInfo.host || "127.0.0.1"}:${printerInfo.port || 9100}`
      : `USB/OS: ${printerInfo.systemPrinterName || formatTitleCase(printerInfo.name) || "VARSAYILAN"}`
  const modeLabel = asciiOnly ? "ASCII (TR guvenli)" : "CP857"

  const chunks = [BOLD_ON, encodeCp857(centerLine("CORDER YAZICI TESTI", width), asciiOnly), BOLD_OFF]
  const push = (s) => chunks.push(encodeCp857(s, asciiOnly))
  push(hrLine("-", width))
  push(kvLine("Tarih/Saat", formatTicketDate(), width))
  push(kvLine("Yazici", formatTitleCase(printerInfo.name) || "Test Yazicisi", width))
  push(kvLine("Baglanti", targetDesc, width))
  push(kvLine("Kagit", `${paperWidth}mm (${width} kolon)`, width))
  push(kvLine("Kodlama", modeLabel, width))
  push(hrLine("-", width))
  push(centerLine(`TURKCE KARAKTER TESTI (${modeLabel})`, width))
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
  buildShiftReportTicket,
  buildKitchenCancelTicket,
  buildTestTicket,
  formatPaymentMethodLabel,
  encodeCp857,
  trSafe,
  money,
}
