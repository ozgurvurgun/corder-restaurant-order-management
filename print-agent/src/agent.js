const { io } = require("socket.io-client")
const { buildKitchenTicket, buildReceipt, buildKitchenCancelTicket } = require("./escpos")
const {
  ackKitchenPrinted,
  ackPrintJobPrinted,
  fetchPendingKitchenOrders,
  fetchPendingPrintJobs,
} = require("./http-sync")
const {
  expandKitchenPrintJobs,
  expandReceiptPrintJobs,
  expandCancelPrintJobs,
  makeKitchenKey,
  makeKitchenCancelKey,
} = require("./kitchen-split")
const { info, warn, error } = require("./logger")

function makeJobKey(evt) {
  if (evt._mySplitKey) return evt._mySplitKey
  if (evt.printType === "receipt") return `${evt.jobId}:receipt`
  if (evt.printType === "kitchen_cancel") return makeKitchenCancelKey(evt)
  return makeKitchenKey(evt)
}

function normalizePrintJob(payload, restaurantId) {
  if (!payload || payload.type !== "order.print_job") return null
  const acceptAll = !restaurantId || restaurantId === "*"
  if (!acceptAll && payload.restaurantId !== restaurantId) return null
  if (!payload.jobId || !payload.order || !Array.isArray(payload.order.items)) return null
  if (payload.printType !== "receipt" && payload.printType !== "kitchen_cancel") return null

  const items = payload.order.items.map((item) => ({
    productName: item.productName || item.name || "Item",
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    note: item.note || "",
    categoryId: item.categoryId || undefined,
  }))
  const lineTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return {
    jobId: String(payload.jobId),
    restaurantId: payload.restaurantId,
    printType: payload.printType,
    receiptMode: payload.receiptMode === "consolidated" ? "consolidated" : "split",
    includeLineNotes: payload.includeLineNotes !== false,
    createdAt: payload.createdAt || new Date().toISOString(),
    tableName: payload.order.tableName || "-",
    waiterName: payload.order.waiterName || "-",
    cancelledBy: payload.order.cancelledBy || "-",
    cancelReason: payload.order.cancelReason || "-",
    items,
    total: Number(payload.order.total) || lineTotal,
  }
}

function normalizeOrderCreated(payload, restaurantId) {
  if (!payload || !payload.id || !Array.isArray(payload.items)) return null
  const acceptAll = !restaurantId || restaurantId === "*"
  if (!acceptAll && payload.restaurantId !== restaurantId) return null

  const items = payload.items
    .filter((item) => item && item.status !== "cancelled")
    .map((item) => ({
      productName: item.productName || item.name || "Item",
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      note: item.note || "",
      categoryId: item.categoryId || undefined,
    }))
  if (!items.length) return null

  return {
    jobId: String(payload.id),
    restaurantId: payload.restaurantId,
    printType: "kitchen",
    createdAt: payload.createdAt || new Date().toISOString(),
    tableName: payload.table?.name || payload.tableName || payload.tableId || "-",
    waiterName: payload.user?.name || payload.waiterName || "-",
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }
}

function maybeAckJob(store, config, job) {
  if (job._splitKeys?.length) {
    if (!job._splitKeys.every((k) => store.hasPrinted(k))) return
  } else if (!store.hasPrinted(job.jobKey || makeJobKey(job))) {
    return
  }
  if (job.printType === "kitchen") void ackKitchenPrinted(config, job.jobId)
  else if (job.printType === "receipt" || job.printType === "kitchen_cancel") {
    void ackPrintJobPrinted(config, job.jobId)
  }
}

async function printJob(job, printer, agentConfig) {
  const tp = job.targetPrinter
  const charsPerLine =
    tp?.paperWidth === 58 ? 32 : tp?.paperWidth === 80 ? 42 : agentConfig.ticketCharsPerLine
  const feedLinesBeforeCut = Number(tp?.feedLinesBeforeCut ?? agentConfig.ticketFeedLinesBeforeCut ?? 6)
  const printOpts = {
    footerLine: agentConfig.printFooterLine,
    charsPerLine,
    feedLinesBeforeCut,
    ticketStamp: agentConfig.printTicketStamp,
    includeLineNotes: job.includeLineNotes !== false,
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
  if (evt.printType === "receipt") {
    if (evt.receiptMode === "consolidated") {
      const rp = config.receiptPrinter || config.defaultKitchenPrinter || null
      const name = rp?.systemPrinterName || rp?.name || (config.managementReceiptPrinter || "").trim() || null
      const net = rp?.mode === "network" ? `${rp.host}:${rp.port || 9100}` : null
      return [
        {
          ...evt,
          targetPrinter: rp,
          targetPrinterName: net ? null : name,
          targetNetwork: net,
          targetPrinterKey: "mgmt",
          splitIndex: 0,
          _splitKeys: null,
          _mySplitKey: `${evt.jobId}:receipt:mgmt`,
        },
      ]
    }
    return expandReceiptPrintJobs(evt, config)
  }
  if (evt.printType === "kitchen_cancel") return expandCancelPrintJobs(evt, config)
  return []
}

function startAgent({ config: initialConfig, store, printer }) {
  let config = initialConfig
  let socket = null
  let queueTimer = null
  let syncTimer = null
  let isDraining = false
  let printPipeline = Promise.resolve()

  const statusState = {
    socketConnected: false,
    lastConnectedAt: null,
    lastHttpSyncAt: null,
    lastError: null,
    setupRequired: false,
  }

  const enqueuePrint = (evt) => {
    printPipeline = printPipeline
      .then(() => handleEvent(evt))
      .catch((e) => error("Print pipeline failed", { error: e instanceof Error ? e.message : String(e) }))
  }

  const enqueueJobs = (jobs) => {
    for (const job of jobs) {
      const jk = makeJobKey(job)
      if (store.hasPrinted(jk)) {
        maybeAckJob(store, config, job)
        continue
      }
      enqueuePrint(job)
    }
  }

  const enqueueKitchenJobsFromPayload = (payload) => {
    const base = normalizeOrderCreated(payload, config.restaurantId)
    if (base) enqueueJobs(expandKitchenPrintJobs(base, config))
  }

  const enqueueOrderPrintJobsFromPayload = (payload) => {
    const evt = normalizePrintJob(payload, config.restaurantId)
    if (evt) enqueueJobs(expandOrderPrintJob(evt, config))
  }

  const drainQueue = async () => {
    if (isDraining) return
    isDraining = true
    try {
      const ready = store.peekReady(5)
      for (const job of ready) {
        try {
          if (store.hasPrinted(job.jobKey)) {
            store.markPrinted(job.jobKey, job)
            maybeAckJob(store, config, job)
            continue
          }
          await printJob(job, printer, config)
          store.markPrinted(job.jobKey, job)
          info(`Queued job printed: ${job.jobKey}`)
          maybeAckJob(store, config, job)
        } catch (e) {
          const message = e instanceof Error ? e.message : "unknown print error"
          store.requeue(job, message)
          warn(`Queued job failed: ${job.jobKey}`, { error: message, retryCount: (job.retryCount || 0) + 1 })
        }
      }
    } finally {
      isDraining = false
    }
  }

  const scheduleDrainQueue = () => {
    printPipeline = printPipeline
      .then(() => drainQueue())
      .catch((e) => error("Drain pipeline failed", { error: e instanceof Error ? e.message : String(e) }))
    return printPipeline
  }

  const handleEvent = async (evt) => {
    const jobKey = makeJobKey(evt)
    const job = { ...evt, jobKey, receivedAt: Date.now() }
    if (store.hasPrinted(jobKey)) {
      info(`Duplicate print skipped: ${jobKey}`)
      maybeAckJob(store, config, job)
      return
    }
    store.enqueue(job)
    try {
      await printJob(job, printer, config)
      store.markPrinted(jobKey, job)
      info(`Print success: ${jobKey}`)
      maybeAckJob(store, config, job)
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown print error"
      warn(`Print failed, queued for retry: ${jobKey}`, { error: message })
      store.requeue(job, message)
    }
  }

  const pullPendingFromHttp = () => {
    if (!config.backendWsUrl || !config.agentToken) return
    statusState.lastHttpSyncAt = new Date().toISOString()
    void fetchPendingKitchenOrders(config).then((list) => list.forEach(enqueueKitchenJobsFromPayload))
    void fetchPendingPrintJobs(config).then((list) => list.forEach(enqueueOrderPrintJobsFromPayload))
  }

  const connect = () => {
    if (socket) {
      socket.removeAllListeners()
      socket.close()
      socket = null
    }
    if (!config.backendWsUrl || !config.agentToken || !config.restaurantId) {
      statusState.socketConnected = false
      statusState.setupRequired = true
      info("Waiting for Print Agent username and password login in UI")
      return
    }
    statusState.setupRequired = false
    info(`Connecting socket.io: ${config.backendWsUrl} (path=${config.backendSocketPath})`)
    socket = io(config.backendWsUrl, {
      path: config.backendSocketPath,
      transports: ["websocket"],
      auth: { token: config.agentToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: config.socketReconnectionDelayMs,
      reconnectionDelayMax: config.socketReconnectionDelayMaxMs,
      randomizationFactor: 0.33,
      timeout: 20000,
    })

    socket.on("connect", () => {
      statusState.socketConnected = true
      statusState.lastConnectedAt = new Date().toISOString()
      statusState.lastError = null
      info("Print agent connected (socket.io)", { socketId: socket?.id })
      void scheduleDrainQueue()
      pullPendingFromHttp()
    })
    socket.on(config.backendOrderEventName, enqueueKitchenJobsFromPayload)
    socket.on("order.print_job", enqueueOrderPrintJobsFromPayload)
    socket.on("disconnect", (reason) => {
      statusState.socketConnected = false
      warn("Socket disconnected", { reason })
    })
    socket.on("connect_error", (err) => {
      statusState.socketConnected = false
      statusState.lastError = err.message
      error("Socket connect error", { error: err.message })
    })
  }

  const setupTimers = () => {
    if (queueTimer) clearInterval(queueTimer)
    if (syncTimer) clearInterval(syncTimer)
    queueTimer = setInterval(() => void scheduleDrainQueue(), config.queueDrainIntervalMs)
    if (config.kitchenSyncIntervalMs > 0) {
      syncTimer = setInterval(pullPendingFromHttp, config.kitchenSyncIntervalMs)
    }
  }

  setupTimers()
  connect()
  setImmediate(pullPendingFromHttp)

  return {
    flushQueue: scheduleDrainQueue,
    getStatus() {
      return {
        ...statusState,
        restaurantId: config.restaurantId,
        restaurantName: config.restaurantName || "",
        backendUrl: config.backendHttpUrl || config.backendWsUrl || "",
        queueSize: store.getQueueSize(),
      }
    },
    reloadConfig(nextConfig) {
      const reconnectNeeded =
        nextConfig.backendWsUrl !== config.backendWsUrl ||
        nextConfig.agentToken !== config.agentToken ||
        nextConfig.backendSocketPath !== config.backendSocketPath
      config = nextConfig
      if (printer && typeof printer.updateConfig === "function") printer.updateConfig(nextConfig)
      setupTimers()
      if (reconnectNeeded || !statusState.socketConnected) connect()
      pullPendingFromHttp()
      void scheduleDrainQueue()
    },
    stop() {
      if (queueTimer) clearInterval(queueTimer)
      if (syncTimer) clearInterval(syncTimer)
      if (socket) socket.close()
    },
  }
}

module.exports = { startAgent }
