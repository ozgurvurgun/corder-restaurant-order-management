const { io } = require("socket.io-client")
const { buildKitchenTicket, buildReceipt, buildKitchenCancelTicket } = require("./escpos")
const {
  ackKitchenPrinted,
  ackPrintJobPrinted,
  fetchPendingKitchenOrders,
  fetchPendingPrintJobs,
  refreshAgentSession,
} = require("./http-sync")
const {
  expandKitchenPrintJobs,
  expandReceiptPrintJobs,
  expandCancelPrintJobs,
  makeKitchenKey,
  makeReceiptKey,
  makeKitchenCancelKey,
} = require("./kitchen-split")
const { info, warn, error } = require("./logger")

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
    items,
    total,
  }
}

function normalizeOrderCreated(payload, restaurantId) {
  if (!payload || !payload.id || !Array.isArray(payload.items)) return null
  const acceptAll = !restaurantId || restaurantId === "*"
  if (!acceptAll && payload.restaurantId !== restaurantId) return null

  const items = payload.items
    .filter((item) => item && item.status !== "cancelled" && item.status !== "ledger" && Number(item.quantity || 0) > 0)
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
  const feedLinesBeforeCut = Number(tp?.feedLinesBeforeCut ?? agentConfig.ticketFeedLinesBeforeCut ?? 3)
  // SP-EP/CUPS often ignores ESC/POS code-page select; ASCII fold keeps Turkish readable.
  const useAsciiFallback =
    agentConfig.asciiFallback === true ||
    (agentConfig.asciiFallback !== false && (tp?.mode === "system" || !tp?.mode))
  const printOpts = {
    footerLine: agentConfig.printFooterLine,
    charsPerLine,
    feedLinesBeforeCut,
    ticketStamp: agentConfig.printTicketStamp,
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
  if (evt.printType === "receipt") {
    return expandReceiptPrintJobs(evt, config)
  }
  if (evt.printType === "kitchen_cancel") return expandCancelPrintJobs(evt, config)
  return []
}

function startAgent({ config: initialConfig, store, printer, onContextInvalidated }) {
  let config = initialConfig
  let socket = null
  let queueTimer = null
  let syncTimer = null
  let reconnectTimer = null
  let isDraining = false
  let printPipeline = Promise.resolve()
  const inFlightKeys = new Set()
  const ackInFlightIds = new Set()

  const statusState = {
    socketConnected: false,
    lastConnectedAt: null,
    lastHttpSyncAt: null,
    lastError: null,
    setupRequired: false,
  }

  const attachConfigCallbacks = (cfg) => {
    cfg.onTokenRefreshed = (newToken) => {
      if (socket) {
        socket.auth = { token: newToken }
      }
    }
    cfg.onAuthRevoked = (reasonMsg) => {
      statusState.socketConnected = false
      statusState.setupRequired = true
      statusState.lastError = reasonMsg || "Oturum sona erdi"
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      if (socket) {
        socket.removeAllListeners()
        socket.close()
        socket = null
      }
    }
  }
  attachConfigCallbacks(config)

  const enqueuePrint = (evt, jk) => {
    inFlightKeys.add(jk)
    printPipeline = printPipeline
      .then(() => handleEvent(evt))
      .catch((e) => error("Print pipeline failed", { error: e instanceof Error ? e.message : String(e) }))
      .finally(() => {
        inFlightKeys.delete(jk)
      })
  }

  const enqueueJobs = (jobs) => {
    for (const job of jobs) {
      const jk = makeJobKey(job)
      if (store.hasPrinted(jk)) {
        maybeAckJob(store, config, job, ackInFlightIds)
        continue
      }
      if (store.hasQueued(jk) || inFlightKeys.has(jk)) {
        continue
      }
      enqueuePrint(job, jk)
    }
  }

  const enqueueKitchenJobsFromPayload = (payload) => {
    const base = normalizeOrderCreated(payload, config.restaurantId)
    if (base) enqueueJobs(expandKitchenPrintJobs(base, config))
  }

  const enqueueOrderPrintJobsFromPayload = (payload) => {
    const evt = normalizePrintJob(payload, config.restaurantId)
    if (!evt) return
    if (evt.emptyJobId) {
      if (!store.hasAcked(evt.emptyJobId) && !ackInFlightIds.has(evt.emptyJobId)) {
        ackInFlightIds.add(evt.emptyJobId)
        void ackPrintJobPrinted(config, evt.emptyJobId)
          .then((ok) => {
            if (ok) store.markAcked(evt.emptyJobId)
          })
          .finally(() => ackInFlightIds.delete(evt.emptyJobId))
      }
      return
    }
    enqueueJobs(expandOrderPrintJob(evt, config))
  }

  const drainQueue = async () => {
    if (isDraining) return
    isDraining = true
    try {
      const ready = store.peekReady(25)
      for (const job of ready) {
        try {
          if (store.hasPrinted(job.jobKey)) {
            store.markPrinted(job.jobKey, job)
            maybeAckJob(store, config, job, ackInFlightIds)
            continue
          }
          await printJob(job, printer, config)
          store.markPrinted(job.jobKey, job)
          info(`Queued job printed: ${job.jobKey}`)
          maybeAckJob(store, config, job, ackInFlightIds)
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

  const flushQueueNow = () => {
    store.resetRetryTimers()
    return scheduleDrainQueue()
  }

  const handleEvent = async (evt) => {
    const jobKey = makeJobKey(evt)
    const job = { ...evt, jobKey, receivedAt: Date.now() }
    if (store.hasPrinted(jobKey)) {
      info(`Duplicate print skipped: ${jobKey}`)
      maybeAckJob(store, config, job, ackInFlightIds)
      return
    }
    if (store.hasQueued(jobKey)) {
      return
    }
    store.enqueue(job)
    try {
      await printJob(job, printer, config)
      store.markPrinted(jobKey, job)
      info(`Print success: ${jobKey}`)
      maybeAckJob(store, config, job, ackInFlightIds)
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown print error"
      warn(`Print failed, queued for retry: ${jobKey}`, { error: message })
      store.requeue(job, message)
    }
  }

  const pullPendingFromHttp = () => {
    if (!config.backendWsUrl || (!config.agentToken && !config.refreshToken) || !config.restaurantId) return
    statusState.lastHttpSyncAt = new Date().toISOString()
    void fetchPendingKitchenOrders(config).then((list) => list.forEach(enqueueKitchenJobsFromPayload))
    void fetchPendingPrintJobs(config).then((list) => list.forEach(enqueueOrderPrintJobsFromPayload))
  }

  const scheduleReconnect = (delayMs = 3000) => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (!statusState.socketConnected && (config.agentToken || config.refreshToken) && config.restaurantId) {
        connect()
      }
    }, delayMs)
    if (typeof reconnectTimer.unref === "function") {
      reconnectTimer.unref()
    }
  }

  const connect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (socket) {
      socket.removeAllListeners()
      socket.close()
      socket = null
    }
    if (!config.backendWsUrl || (!config.agentToken && !config.refreshToken) || !config.restaurantId) {
      statusState.socketConnected = false
      statusState.setupRequired = true
      info("Waiting for Print Agent username and password login in UI")
      return
    }
    if (!config.agentToken && config.refreshToken) {
      void refreshAgentSession(config).then((refreshed) => {
        if (refreshed?.authToken) {
          config.agentToken = refreshed.authToken
          connect()
        } else if (!refreshed?.revoked) {
          scheduleReconnect(5000)
        }
      })
      return
    }

    statusState.setupRequired = false
    info(`Connecting socket.io: ${config.backendWsUrl} (path=${config.backendSocketPath})`)
    socket = io(config.backendWsUrl, {
      path: config.backendSocketPath,
      transports: ["websocket", "polling"],
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
    socket.on("printers:updated", () => {
      if (typeof onContextInvalidated === "function") {
        void Promise.resolve(onContextInvalidated()).catch(() => {})
      }
    })
    socket.on("auth:expired", () => {
      warn("Socket auth token expired; refreshing session")
      if (config.refreshToken) {
        void refreshAgentSession(config).then((refreshed) => {
          if (refreshed?.authToken) {
            config.agentToken = refreshed.authToken
            connect()
          }
        })
      }
    })
    socket.on("disconnect", (reason) => {
      statusState.socketConnected = false
      warn("Socket disconnected", { reason })
      if (reason === "io server disconnect") {
        if (config.refreshToken) {
          void refreshAgentSession(config).then((refreshed) => {
            if (refreshed?.authToken) {
              config.agentToken = refreshed.authToken
              connect()
            } else if (!refreshed?.revoked) {
              scheduleReconnect(4000)
            }
          })
        } else if (config.agentToken) {
          scheduleReconnect(4000)
        }
      }
    })
    socket.on("connect_error", (err) => {
      statusState.socketConnected = false
      statusState.lastError = err.message
      error("Socket connect error", { error: err.message })
      if (config.refreshToken) {
        void refreshAgentSession(config).then((refreshed) => {
          if (refreshed?.authToken && socket) {
            socket.auth = { token: refreshed.authToken }
          }
        })
      }
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
    flushQueue: flushQueueNow,
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
        nextConfig.backendSocketPath !== config.backendSocketPath ||
        nextConfig.restaurantId !== config.restaurantId
      config = nextConfig
      attachConfigCallbacks(config)
      if (printer && typeof printer.updateConfig === "function") printer.updateConfig(nextConfig)
      setupTimers()
      if (reconnectNeeded || !statusState.socketConnected) connect()
      pullPendingFromHttp()
      void scheduleDrainQueue()
    },
    stop() {
      if (queueTimer) clearInterval(queueTimer)
      if (syncTimer) clearInterval(syncTimer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (socket) socket.close()
    },
  }
}

module.exports = {
  startAgent,
  normalizePrintJob,
  normalizeOrderCreated,
  expandOrderPrintJob,
  makeJobKey,
}
