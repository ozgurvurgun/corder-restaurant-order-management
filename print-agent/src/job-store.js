const fs = require("fs")
const path = require("path")

const MAX_PRINTED_ENTRIES = 2000
const MAX_PRINTED_AGE_MS = 24 * 60 * 60 * 1000
const MAX_QUEUE_ENTRIES = 500
const MAX_ACKED_ENTRIES = 1000

function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    throw new Error(`Queue directory create failed (${dir}): ${message}`)
  }
}

function readJson(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) return fallbackValue
    const content = fs.readFileSync(filePath, "utf8")
    return JSON.parse(content)
  } catch {
    return fallbackValue
  }
}

class JobStore {
  constructor(filePath) {
    this.filePath = filePath
    ensureDir(filePath)
    const loaded = readJson(filePath, { printed: {}, acked: {}, queue: [] })
    this.state = {
      printed: loaded && typeof loaded.printed === "object" && loaded.printed ? loaded.printed : {},
      acked: loaded && typeof loaded.acked === "object" && loaded.acked ? loaded.acked : {},
      queue: Array.isArray(loaded?.queue) ? loaded.queue : [],
    }
    if (this.prunePrinted()) {
      this.save()
    }
  }

  prunePrinted() {
    const cutoff = Date.now() - MAX_PRINTED_AGE_MS
    let changed = false

    const entries = Object.entries(this.state.printed)
    if (entries.length) {
      const valid = []
      for (const [key, meta] of entries) {
        const ts = meta?.printedAt ? Date.parse(meta.printedAt) : NaN
        if (!Number.isFinite(ts) || ts < cutoff) {
          changed = true
          continue
        }
        valid.push([key, meta, ts])
      }
      if (valid.length > MAX_PRINTED_ENTRIES) {
        valid.sort((a, b) => a[2] - b[2])
        valid.splice(0, valid.length - MAX_PRINTED_ENTRIES)
        changed = true
      }
      if (changed) {
        const nextPrinted = {}
        for (const [key, meta] of valid) {
          nextPrinted[key] = meta
        }
        this.state.printed = nextPrinted
      }
    }

    const ackEntries = Object.entries(this.state.acked || {})
    if (ackEntries.length) {
      let ackChanged = false
      const validAck = []
      for (const [jobId, ackedAt] of ackEntries) {
        const ts = typeof ackedAt === "string" ? Date.parse(ackedAt) : Number(ackedAt)
        if (!Number.isFinite(ts) || ts < cutoff) {
          ackChanged = true
          continue
        }
        validAck.push([jobId, ackedAt, ts])
      }
      if (validAck.length > MAX_ACKED_ENTRIES) {
        validAck.sort((a, b) => a[2] - b[2])
        validAck.splice(0, validAck.length - MAX_ACKED_ENTRIES)
        ackChanged = true
      }
      if (ackChanged) {
        const nextAcked = {}
        for (const [jobId, ackedAt] of validAck) {
          nextAcked[jobId] = ackedAt
        }
        this.state.acked = nextAcked
        changed = true
      }
    }

    return changed
  }

  save() {
    ensureDir(this.filePath)
    if (this.state.queue.length > MAX_QUEUE_ENTRIES) {
      this.state.queue.splice(0, this.state.queue.length - MAX_QUEUE_ENTRIES)
    }
    const payload = JSON.stringify(this.state, null, 2)
    const tmpPath = `${this.filePath}.${process.pid}.tmp`
    try {
      fs.writeFileSync(tmpPath, payload, { encoding: "utf8", mode: 0o600 })
      fs.renameSync(tmpPath, this.filePath)
    } catch {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
      } catch {
        // noop
      }
      fs.writeFileSync(this.filePath, payload, { encoding: "utf8", mode: 0o600 })
    }
  }

  hasPrinted(jobKey) {
    return Boolean(this.state.printed[jobKey])
  }

  hasQueued(jobKey) {
    return this.state.queue.some((item) => item.jobKey === jobKey)
  }

  hasAcked(jobId) {
    return Boolean(this.state.acked && this.state.acked[jobId])
  }

  markAcked(jobId) {
    if (!jobId) return
    if (!this.state.acked) this.state.acked = {}
    if (this.state.acked[jobId]) return
    this.state.acked[jobId] = new Date().toISOString()
    this.prunePrinted()
    this.save()
  }

  markPrinted(jobKey, extraMeta = {}) {
    const queuedItem = this.state.queue.find((item) => item.jobKey === jobKey)
    const rawTotal = extraMeta.total !== undefined ? extraMeta.total : queuedItem?.total
    this.state.printed[jobKey] = {
      printedAt: new Date().toISOString(),
      tableName: extraMeta.tableName || queuedItem?.tableName || "-",
      printType: extraMeta.printType || queuedItem?.printType || "kitchen",
      printerName:
        extraMeta.printerName ||
        queuedItem?.targetPrinter?.name ||
        queuedItem?.targetPrinterName ||
        queuedItem?.targetNetwork ||
        "-",
      total: Number.isFinite(Number(rawTotal)) ? Number(rawTotal) : 0,
    }
    this.state.queue = this.state.queue.filter((item) => item.jobKey !== jobKey)
    this.prunePrinted()
    this.save()
  }

  enqueue(job) {
    if (this.hasPrinted(job.jobKey)) return
    if (this.hasQueued(job.jobKey)) return
    this.state.queue.push({
      ...job,
      retryCount: job.retryCount || 0,
      nextAttemptAt: job.nextAttemptAt || Date.now(),
      lastError: job.lastError || "",
    })
    this.save()
  }

  peekReady(limit = 20) {
    const now = Date.now()
    return this.state.queue.filter((item) => (item.nextAttemptAt || 0) <= now).slice(0, limit)
  }

  resetRetryTimers() {
    if (!this.state.queue.length) return
    const now = Date.now()
    for (const item of this.state.queue) {
      item.nextAttemptAt = now
    }
    this.save()
  }

  requeue(job, errorText) {
    const idx = this.state.queue.findIndex((item) => item.jobKey === job.jobKey)
    const prevRetry = idx >= 0 ? this.state.queue[idx].retryCount || 0 : job.retryCount || 0
    const retryCount = prevRetry + 1
    const expDelay = Math.min(30000, 500 * Math.pow(2, Math.min(retryCount - 1, 6)))
    const jitter = Math.floor(Math.random() * 200)
    const delay = expDelay + jitter
    const updated = {
      ...(idx >= 0 ? this.state.queue[idx] : job),
      ...job,
      retryCount,
      lastError: errorText || "",
      nextAttemptAt: Date.now() + delay,
    }
    if (idx >= 0) {
      this.state.queue[idx] = updated
    } else {
      this.state.queue.push(updated)
    }
    this.save()
  }

  getQueueSize() {
    return this.state.queue.length
  }

  getPendingJobs() {
    return [...this.state.queue]
  }

  getRecentPrinted(limit = 30) {
    const entries = Object.entries(this.state.printed).map(([jobKey, meta]) => ({
      jobKey,
      printedAt: meta?.printedAt || "",
      tableName: meta?.tableName || "-",
      printType: meta?.printType || "kitchen",
      printerName: meta?.printerName || "-",
      total: Number(meta?.total || 0),
    }))
    entries.sort((a, b) => Date.parse(b.printedAt || 0) - Date.parse(a.printedAt || 0))
    return entries.slice(0, limit)
  }

  clearQueue() {
    this.state.queue = []
    this.save()
  }
}

module.exports = { JobStore }
