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
  if (evt.printType === "receipt") {
    return `${evt.jobId}:receipt`
  }
  if (evt.printType === "kitchen_cancel") {
    return makeKitchenCancelKey(evt)
  }
  return makeKitchenKey(evt)
}

function normalizePrintJob(payload, restaurantId) {
  if (!payload || payload.type !== "order.print_job") return null
  const acceptAllRestaurants = restaurantId === "*"
  if (!acceptAllRestaurants && payload.restaurantId !== restaurantId) return null
  if (!payload.jobId) return null
  if (payload.printType !== "receipt" && payload.printType !== "kitchen_cancel") return null
  if (!payload.order || !Array.isArray(payload.order.items)) return null

  const items = (payload.order.items || []).map((item) => ({
    productName: item.productName || item.name || "Urun",
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    note: item.note || "",
    categoryId: item.categoryId || undefined,
  }))
  const lineTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const receiptMode = payload.receiptMode === "consolidated" ? "consolidated" : "split"
  const includeLineNotes = payload.includeLineNotes !== false

  return {
    jobId: String(payload.jobId),
    restaurantId: payload.restaurantId,
    printType: payload.printType,
    receiptMode,
    includeLineNotes,
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
  const acceptAllRestaurants = restaurantId === "*"
  if (!acceptAllRestaurants && payload.restaurantId !== restaurantId) return null

  const items = payload.items
    .filter((item) => item && item.status !== "cancelled")
    .map((item) => ({
      productName: item.productName || item.name || "Urun",
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      note: item.note || "",
      categoryId: item.categoryId || undefined,
    }))

  if (!items.length) return null

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return {
    jobId: String(payload.id),
    restaurantId: payload.restaurantId,
    printType: "kitchen",
    createdAt: payload.createdAt || new Date().toISOString(),
    tableName: payload.table?.name || payload.tableName || payload.tableId || "-",
    waiterName: payload.user?.name || payload.waiterName || "-",
    items,
    total,
  }
}

function maybeAckJob(store, config, job) {
  if (job._splitKeys && job._splitKeys.length > 0) {
    const all = job._splitKeys.every((k) => store.hasPrinted(k))
    if (!all) return
  } else {
    const jk = job.jobKey || makeJobKey(job)
    if (!store.hasPrinted(jk)) return
  }

  if (job.printType === "kitchen") {
    void ackKitchenPrinted(config, job.jobId)
  } else if (job.printType === "receipt" || job.printType === "kitchen_cancel") {
    void ackPrintJobPrinted(config, job.jobId)
  }
}

async function printJob(job, printer, agentConfig) {
  const printOpts = {
    footerLine: agentConfig.printFooterLine,
    charsPerLine: agentConfig.ticketCharsPerLine,
    feedLinesBeforeCut: agentConfig.ticketFeedLinesBeforeCut,
    ticketStamp: agentConfig.printTicketStamp,
    includeLineNotes: job.includeLineNotes !== false,
  }
  let bytes
  if (job.printType === "kitchen_cancel") {
    bytes = buildKitchenCancelTicket(job, printOpts)
  } else if (job.printType === "receipt") {
    bytes = buildReceipt(job, printOpts)
  } else {
    bytes = buildKitchenTicket(job, printOpts)
  }
  const opts = {}
  if (job.targetNetwork) {
    opts.networkTarget = job.targetNetwork
  } else if (job.targetPrinterName) {
    opts.printerName = job.targetPrinterName
  }
  await printer.print(bytes, opts)
}

function expandOrderPrintJob(evt, config) {
  if (evt.printType === "receipt") {
    if (evt.receiptMode === "consolidated") {
      const name = (config.managementReceiptPrinter || "").trim() || null
      return [
        {
          ...evt,
          targetPrinterName: name,
          targetNetwork: null,
          targetPrinterKey: "mgmt",
          splitIndex: 0,
          _splitKeys: null,
          _mySplitKey: `${evt.jobId}:receipt:mgmt`,
        },
      ]
    }
    return expandReceiptPrintJobs(evt, config)
  }
  if (evt.printType === "kitchen_cancel") {
    return expandCancelPrintJobs(evt, config)
  }
  return []
}

function startAgent({ config, store, printer }) {
  let socket = null
  let queueTimer = null
  let syncTimer = null
  let isDraining = false
  let printPipeline = Promise.resolve()

  const enqueuePrint = (evt) => {
    printPipeline = printPipeline
      .then(() => handleEvent(evt))
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e)
        error("Print pipeline failed", { error: message })
      })
  }

  const enqueueKitchenJobsFromPayload = (payload) => {
    const base = normalizeOrderCreated(payload, config.restaurantId)
    if (!base) return
    const jobs = expandKitchenPrintJobs(base, config)
    for (const job of jobs) {
      const jk = makeJobKey(job)
      if (store.hasPrinted(jk)) {
        maybeAckJob(store, config, job)
        continue
      }
      enqueuePrint(job)
    }
  }

  const enqueueOrderPrintJobsFromPayload = (payload) => {
    const evt = normalizePrintJob(payload, config.restaurantId)
    if (!evt) return
    const jobs = expandOrderPrintJob(evt, config)
    for (const job of jobs) {
      const jk = makeJobKey(job)
      if (store.hasPrinted(jk)) {
        maybeAckJob(store, config, job)
        continue
      }
      enqueuePrint(job)
    }
  }

  const drainQueue = async () => {
    if (isDraining) return
    isDraining = true
    try {
      const ready = store.peekReady(5)
      if (!ready.length) return

      for (const job of ready) {
        try {
          if (store.hasPrinted(job.jobKey)) {
            store.markPrinted(job.jobKey)
            maybeAckJob(store, config, job)
            continue
          }
          await printJob(job, printer, config)
          store.markPrinted(job.jobKey)
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
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e)
        error("Drain pipeline failed", { error: message })
      })
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
      store.markPrinted(jobKey)
      info(`Print success: ${jobKey}`)
      maybeAckJob(store, config, job)
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown print error"
      warn(`Print failed, queued for retry: ${jobKey}`, { error: message })
      store.requeue(job, message)
    }
  }

  const pullPendingFromHttp = () => {
    void fetchPendingKitchenOrders(config).then((list) => {
      for (const payload of list) {
        enqueueKitchenJobsFromPayload(payload)
      }
    })
    void fetchPendingPrintJobs(config).then((list) => {
      for (const payload of list) {
        enqueueOrderPrintJobsFromPayload(payload)
      }
    })
  }

  const connect = () => {
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
      info("Print agent connected (socket.io)", {
        socketId: socket?.id,
        eventName: config.backendOrderEventName,
      })
      void scheduleDrainQueue()
      pullPendingFromHttp()
    })

    socket.on(config.backendOrderEventName, (payload) => {
      enqueueKitchenJobsFromPayload(payload)
    })

    socket.on("order.print_job", (payload) => {
      enqueueOrderPrintJobsFromPayload(payload)
    })

    socket.on("disconnect", (reason) => {
      warn("Socket disconnected", { reason })
    })

    socket.on("connect_error", (err) => {
      error("Socket connect error", { error: err.message })
    })
  }

  queueTimer = setInterval(() => {
    void scheduleDrainQueue()
  }, config.queueDrainIntervalMs)

  if (config.kitchenSyncIntervalMs > 0) {
    syncTimer = setInterval(() => {
      pullPendingFromHttp()
    }, config.kitchenSyncIntervalMs)
  }

  connect()

  setImmediate(() => {
    pullPendingFromHttp()
  })

  return {
    flushQueue: scheduleDrainQueue,
    stop() {
      clearInterval(queueTimer)
      if (syncTimer) clearInterval(syncTimer)
      if (socket) socket.close()
    },
  }
}

module.exports = { startAgent }
