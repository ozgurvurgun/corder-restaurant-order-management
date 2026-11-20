const { io } = require("socket.io-client")
const {
  ackPrintJobPrinted,
  fetchPendingKitchenOrders,
  fetchPendingPrintJobs,
  refreshAgentSession,
} = require("./http-sync")
const { expandKitchenPrintJobs } = require("./kitchen-split")
const {
  makeJobKey,
  normalizePrintJob,
  normalizeOrderCreated,
  maybeAckJob,
  printJob,
  expandOrderPrintJob,
} = require("./job-normalizer")
const { info, warn, error } = require("./logger")

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
      if (socket) socket.auth = { token: newToken }
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

  const handleEvent = async (evt) => {
    const jobKey = makeJobKey(evt)
    const job = { ...evt, jobKey, receivedAt: Date.now() }
    if (store.hasPrinted(jobKey)) {
      info(`Duplicate print skipped: ${jobKey}`)
      maybeAckJob(store, config, job, ackInFlightIds)
      return
    }
    if (store.hasQueued(jobKey)) return
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

  const enqueuePrint = (evt, jk) => {
    inFlightKeys.add(jk)
    printPipeline = printPipeline
      .then(() => handleEvent(evt))
      .catch((e) => error("Print pipeline failed", { error: e instanceof Error ? e.message : String(e) }))
      .finally(() => inFlightKeys.delete(jk))
  }

  const enqueueJobs = (jobs) => {
    for (const job of jobs) {
      const jk = makeJobKey(job)
      if (store.hasPrinted(jk)) {
        maybeAckJob(store, config, job, ackInFlightIds)
        continue
      }
      if (store.hasQueued(jk) || inFlightKeys.has(jk)) continue
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
          warn(`Queued job failed: ${job.jobKey}`, {
            error: message,
            retryCount: (job.retryCount || 0) + 1,
          })
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

  const settleJobsAsSkipped = (jobs) => {
    for (const job of jobs) {
      const jk = job.jobKey || makeJobKey(job)
      store.markPrinted(jk, { ...job, jobKey: jk })
      maybeAckJob(store, config, { ...job, jobKey: jk }, ackInFlightIds)
    }
  }

  const clearPendingQueueNow = async () => {
    const queued = store.getPendingJobs()
    settleJobsAsSkipped(queued)
    store.clearQueue()

    if (config.backendWsUrl && (config.agentToken || config.refreshToken) && config.restaurantId) {
      const [pendingKitchen, pendingJobs] = await Promise.all([
        fetchPendingKitchenOrders(config).catch(() => []),
        fetchPendingPrintJobs(config).catch(() => []),
      ])
      for (const payload of pendingKitchen) {
        const base = normalizeOrderCreated(payload, config.restaurantId)
        if (base) settleJobsAsSkipped(expandKitchenPrintJobs(base, config))
      }
      for (const payload of pendingJobs) {
        const evt = normalizePrintJob(payload, config.restaurantId)
        if (!evt) continue
        if (evt.emptyJobId) {
          void ackPrintJobPrinted(config, evt.emptyJobId).then((ok) => {
            if (ok) store.markAcked(evt.emptyJobId)
          })
          continue
        }
        settleJobsAsSkipped(expandOrderPrintJob(evt, config))
      }
    }
  }

  const pullPendingFromHttp = () => {
    if (!config.backendWsUrl || (!config.agentToken && !config.refreshToken) || !config.restaurantId) {
      return
    }
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
    if (typeof reconnectTimer.unref === "function") reconnectTimer.unref()
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
        void Promise.resolve(onContextInvalidated("ws-printers-updated")).catch(() => {})
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
      const msg = String(err?.message || "").toLowerCase()
      const isAuthErr =
        msg.includes("unauthorized") ||
        msg.includes("jwt") ||
        msg.includes("token") ||
        msg.includes("forbidden") ||
        msg.includes("auth")
      if (isAuthErr && config.refreshToken) {
        void refreshAgentSession(config).then((refreshed) => {
          if (refreshed?.authToken && socket) socket.auth = { token: refreshed.authToken }
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
    clearPendingQueue: clearPendingQueueNow,
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
