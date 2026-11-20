const { buildKitchenTicket, buildReceipt, buildKitchenCancelTicket } = require("./escpos")
const { ackKitchenPrinted, ackPrintJobPrinted } = require("./http-sync")
const {
  expandReceiptPrintJobs,
  expandCancelPrintJobs,
  makeKitchenKey,
  makeReceiptKey,
  makeKitchenCancelKey,
} = require("./kitchen-split")

function makeJobKey(evt) {
  if (evt._mySplitKey) return evt._mySplitKey
  if (evt.printType === "receipt") return makeReceiptKey(evt)
  if (evt.printType === "kitchen_cancel") return makeKitchenCancelKey(evt)
  return makeKitchenKey(evt)
}

function normalizePrintJob(payload, restaurantId) {
  if (!payload || payload.type !== "order.print_job") return null
  const acceptAll = !restaurantId || restaurantId === "*"
  if (!acceptAll && payload.restaurantId !== restaurantId) return null
  if (!payload.jobId || !payload.order || !Array.isArray(payload.order.items)) return null
  if (payload.printType !== "receipt" && payload.printType !== "kitchen_cancel") return null

  const items = payload.order.items
    .filter((item) => item && Number(item.quantity || 0) > 0)
    .map((item) => ({
      productName: item.productName || item.name || "Ürün",
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      note: item.note || "",
      categoryId: item.categoryId || undefined,
    }))
  if (!items.length) return { emptyJobId: String(payload.jobId) }

  const lineTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const rawTotal = payload.order.total
  const total =
    rawTotal !== undefined && rawTotal !== null && Number.isFinite(Number(rawTotal))
      ? Number(rawTotal)
      : lineTotal
  const rawSubtotal = payload.order.subtotal
  const subtotal =
    rawSubtotal !== undefined && rawSubtotal !== null && Number.isFinite(Number(rawSubtotal))
      ? Number(rawSubtotal)
      : lineTotal

  return {
    jobId: String(payload.jobId),
    orderId: payload.order.orderId ? String(payload.order.orderId) : undefined,
    orderNumber: payload.order.orderNumber ? String(payload.order.orderNumber).trim() : undefined,
    restaurantId: payload.restaurantId,
    printType: payload.printType,
    receiptMode: payload.receiptMode === "consolidated" ? "consolidated" : "split",
    includeLineNotes: payload.includeLineNotes !== false,
    isReprint: Boolean(payload.isReprint),
    openCashDrawer: Boolean(payload.openCashDrawer),
    createdAt: payload.createdAt || new Date().toISOString(),
    tableName: payload.order.tableName || "-",
    waiterName: payload.order.waiterName || "-",
    paymentMethod: payload.order.paymentMethod || undefined,
    subtotal,
    discountAmount: Number(payload.order.discountAmount || 0),
    discountLabel: payload.order.discountLabel || undefined,
    tipAmount: Number(payload.order.tipAmount || 0),
    cancelledBy: payload.order.cancelledBy || "-",
    cancelReason: payload.order.cancelReason || "-",
    shiftReport: payload.shiftReport || null,
    items,
    total,
  }
}

function normalizeOrderCreated(payload, restaurantId) {
  if (!payload || !payload.id || !Array.isArray(payload.items)) return null
  const acceptAll = !restaurantId || restaurantId === "*"
  if (!acceptAll && payload.restaurantId !== restaurantId) return null

  const items = payload.items
    .filter(
      (item) =>
        item &&
        item.status !== "cancelled" &&
        item.status !== "ledger" &&
        Number(item.quantity || 0) > 0,
    )
    .map((item) => ({
      productName: item.productName || item.name || "Ürün",
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      note: item.note || "",
      categoryId: item.categoryId || undefined,
    }))
  if (!items.length) return null

  return {
    jobId: String(payload.id),
    orderId: String(payload.id),
    orderNumber:
      typeof payload.orderNumber === "string" && payload.orderNumber.trim()
        ? payload.orderNumber.trim()
        : undefined,
    restaurantId: payload.restaurantId,
    printType: "kitchen",
    isReprint: Boolean(payload.isReprint),
    createdAt: payload.createdAt || new Date().toISOString(),
    tableName: payload.table?.name || payload.tableName || payload.tableId || "-",
    waiterName: payload.waiterName || payload.userName || payload.user?.name || "-",
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }
}

function maybeAckJob(store, config, job, ackInFlightIds) {
  if (!job?.jobId) return
  if (store.hasAcked(job.jobId) || ackInFlightIds.has(job.jobId)) return

  if (job._splitKeys?.length) {
    if (!job._splitKeys.every((k) => store.hasPrinted(k))) return
  } else if (!store.hasPrinted(job.jobKey || makeJobKey(job))) {
    return
  }

  ackInFlightIds.add(job.jobId)
  const ackPromise =
    job.printType === "kitchen"
      ? ackKitchenPrinted(config, job.jobId)
      : job.printType === "receipt" || job.printType === "kitchen_cancel"
        ? ackPrintJobPrinted(config, job.jobId)
        : Promise.resolve(false)

  void ackPromise
    .then((ok) => {
      if (ok) store.markAcked(job.jobId)
    })
    .finally(() => {
      ackInFlightIds.delete(job.jobId)
    })
}

async function printJob(job, printer, agentConfig) {
  const tp = job.targetPrinter
  const charsPerLine =
    tp?.paperWidth === 58 ? 32 : tp?.paperWidth === 80 ? 42 : agentConfig.ticketCharsPerLine
  const feedLinesBeforeCut = Number(
    tp?.feedLinesBeforeCut ?? agentConfig.ticketFeedLinesBeforeCut ?? 3,
  )
  const useAsciiFallback =
    agentConfig.asciiFallback === true ||
    (agentConfig.asciiFallback !== false && (tp?.mode === "system" || !tp?.mode))
  const printOpts = {
    footerLine: agentConfig.printFooterLine,
    charsPerLine,
    feedLinesBeforeCut,
    includeLineNotes: job.includeLineNotes !== false,
    autoCut: tp ? tp.autoCut !== false : true,
    openCashDrawer: Boolean(job.openCashDrawer),
    asciiFallback: useAsciiFallback,
  }
  const bytes =
    job.printType === "kitchen_cancel"
      ? buildKitchenCancelTicket(job, printOpts)
      : job.printType === "receipt"
        ? buildReceipt(job, printOpts)
        : buildKitchenTicket(job, printOpts)

  const opts = {}
  if (tp) opts.printer = tp
  if (job.targetNetwork) opts.networkTarget = job.targetNetwork
  else if (job.targetPrinterName) opts.printerName = job.targetPrinterName
  await printer.print(bytes, opts)
}

function expandOrderPrintJob(evt, config) {
  if (evt.printType === "receipt") return expandReceiptPrintJobs(evt, config)
  if (evt.printType === "kitchen_cancel") return expandCancelPrintJobs(evt, config)
  return []
}

module.exports = {
  makeJobKey,
  normalizePrintJob,
  normalizeOrderCreated,
  maybeAckJob,
  printJob,
  expandOrderPrintJob,
}

