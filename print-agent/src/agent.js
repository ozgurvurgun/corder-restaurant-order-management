const { io } = require("socket.io-client")
const { buildKitchenTicket, buildReceipt } = require("./escpos")
const { ackKitchenPrinted, fetchPendingKitchenOrders } = require("./http-sync")
const { expandKitchenPrintJobs, expandReceiptPrintJobs, makeKitchenKey } = require("./kitchen-split")
const { info, warn, error } = require("./logger")

function makeJobKey(evt) {
  if (evt._mySplitKey) return evt._mySplitKey
  if (evt.printType === "receipt") {
    return `${evt.jobId}:receipt`
  }
  return makeKitchenKey(evt)
}

function normalizePrintJob(payload, restaurantId) {
  if (!payload || payload.type !== "order.print_job") return null
  const acceptAllRestaurants = restaurantId === "*"
  if (!acceptAllRestaurants && payload.restaurantId !== restaurantId) return null
  if (!payload.jobId) return null
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
    printType: payload.printType === "receipt" ? "receipt" : "kitchen",
    receiptMode,
    includeLineNotes,
    createdAt: payload.createdAt || new Date().toISOString(),
    tableName: payload.order.tableName || "-",
    waiterName: payload.order.waiterName || "-",
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

function maybeAckKitchen(store, config, job) {
  if (job.printType === "receipt") return
  if (job._splitKeys && job._splitKeys.length > 0) {
    const all = job._splitKeys.every((k) => store.hasPrinted(k))
    if (all) void ackKitchenPrinted(config, job.jobId)
    return
  }
  void ackKitchenPrinted(config, job.jobId)
}

async function printJob(job, printer, agentConfig) {
  const printOpts = {
    footerLine: agentConfig.printFooterLine,
    charsPerLine: agentConfig.ticketCharsPerLine,
    feedLinesBeforeCut: agentConfig.ticketFeedLinesBeforeCut,
    ticketStamp: agentConfig.printTicketStamp,
    includeLineNotes: job.includeLineNotes !== false,
  }
  const bytes =
    job.printType === "receipt" ? buildReceipt(job, printOpts) : buildKitchenTicket(job, printOpts)
  const opts = {}
  if (job.targetNetwork) {
    opts.networkTarget = job.targetNetwork
  } else if (job.targetPrinterName) {
    opts.printerName = job.targetPrinterName
  }
  await printer.print(bytes, opts)
}

function startAgent({ config, store, printer }) {
  let socket = null
  let queueTimer = null
  let kitchenSyncTimer = null
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
        maybeAckKitchen(store, config, job)
        continue
      }
      enqueuePrint(job)
    }
  }

  const drainQueue = async () => {
    const ready = store.dequeueReady(5)
    if (!ready.length) return

    for (const job of ready) {
      try {
        if (store.hasPrinted(job.jobKey)) continue
        await printJob(job, printer, config)
        store.markPrinted(job.jobKey)
        info(`Queued job printed: ${job.jobKey}`)
        maybeAckKitchen(store, config, job)
      } catch (e) {
        const message = e instanceof Error ? e.message : "unknown print error"
        store.requeue(job, message)
        warn(`Queued job failed: ${job.jobKey}`, { error: message, retryCount: (job.retryCount || 0) + 1 })
      }
    }
  }

  const handleEvent = async (evt) => {
    const jobKey = makeJobKey(evt)
    const job = { ...evt, jobKey, receivedAt: Date.now() }
    if (store.hasPrinted(jobKey)) {
      info(`Duplicate print skipped: ${jobKey}`)
      maybeAckKitchen(store, config, job)
      return
    }

    try {
      await printJob(job, printer, config)
      store.markPrinted(jobKey)
      info(`Print success: ${jobKey}`)
      maybeAckKitchen(store, config, job)
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown print error"
      warn(`Print failed, queued: ${jobKey}`, { error: message })
      store.requeue(job, message)
    } finally {
      void drainQueue()
    }
  }

  const pullPendingKitchenFromHttp = () => {
    void fetchPendingKitchenOrders(config).then((list) => {
      for (const payload of list) {
        const base = normalizeOrderCreated(payload, config.restaurantId)
        if (!base) continue
        const jobs = expandKitchenPrintJobs(base, config)
        for (const j of jobs) {
          const jk = makeJobKey(j)
          if (store.hasPrinted(jk)) {
            maybeAckKitchen(store, config, j)
            continue
          }
          enqueuePrint(j)
        }
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
      void drainQueue()
      pullPendingKitchenFromHttp()
    })

    socket.on(config.backendOrderEventName, (payload) => {
      enqueueKitchenJobsFromPayload(payload)
    })

    socket.on("order.print_job", (payload) => {
      const evt = normalizePrintJob(payload, config.restaurantId)
      if (!evt) return
      if (evt.printType === "receipt") {
        if (evt.receiptMode === "consolidated") {
          const name = (config.managementReceiptPrinter || "").trim() || null
          const job = {
            ...evt,
            targetPrinterName: name,
            targetNetwork: null,
            targetPrinterKey: "mgmt",
            splitIndex: 0,
            _splitKeys: null,
            _mySplitKey: `${evt.jobId}:receipt:mgmt`,
          }
          enqueuePrint(job)
          return
        }
        const jobs = expandReceiptPrintJobs(evt, config)
        for (const job of jobs) {
          enqueuePrint(job)
        }
        return
      }
      enqueuePrint(evt)
    })

    socket.on("disconnect", (reason) => {
      warn("Socket disconnected", { reason })
    })

    socket.on("connect_error", (err) => {
      error("Socket connect error", { error: err.message })
    })
  }

  queueTimer = setInterval(() => {
    void drainQueue()
  }, config.queueDrainIntervalMs)

  if (config.kitchenSyncIntervalMs > 0) {
    kitchenSyncTimer = setInterval(() => {
      pullPendingKitchenFromHttp()
    }, config.kitchenSyncIntervalMs)
  }

  connect()

  setImmediate(() => {
    pullPendingKitchenFromHttp()
  })

  return {
    flushQueue: drainQueue,
    stop() {
      clearInterval(queueTimer)
      if (kitchenSyncTimer) clearInterval(kitchenSyncTimer)
      if (socket) socket.close()
    },
  }
}

module.exports = { startAgent }
