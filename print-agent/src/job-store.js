const fs = require("fs")
const path = require("path")

const MAX_PRINTED_ENTRIES = 2000
const MAX_PRINTED_AGE_MS = 7 * 24 * 60 * 60 * 1000

function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  try {
    fs.mkdirSync(dir, { recursive: true })
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
    const loaded = readJson(filePath, { printed: {}, queue: [] })
    this.state = {
      printed: loaded && typeof loaded.printed === "object" && loaded.printed ? loaded.printed : {},
      queue: Array.isArray(loaded?.queue) ? loaded.queue : [],
    }
    if (this.prunePrinted()) {
      this.save()
    }
  }

  prunePrinted() {
    const entries = Object.entries(this.state.printed)
    if (!entries.length) return false

    const cutoff = Date.now() - MAX_PRINTED_AGE_MS
    let changed = false
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
    return changed
  }

  save() {
    ensureDir(this.filePath)
    const payload = JSON.stringify(this.state, null, 2)
    const tmpPath = `${this.filePath}.${process.pid}.tmp`
    try {
      fs.writeFileSync(tmpPath, payload, "utf8")
      fs.renameSync(tmpPath, this.filePath)
    } catch {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
      } catch {
        // noop
      }
      fs.writeFileSync(this.filePath, payload, "utf8")
    }
  }

  hasPrinted(jobKey) {
    return Boolean(this.state.printed[jobKey])
  }

  /**
   * Marks a job as printed ONLY after the printer succeeded, removing it from the queue
   * and pruning the bounded `printed` history.
   */
  markPrinted(jobKey) {
    this.state.printed[jobKey] = {
      printedAt: new Date().toISOString(),
    }
    this.state.queue = this.state.queue.filter((item) => item.jobKey !== jobKey)
    this.prunePrinted()
    this.save()
  }

  enqueue(job) {
    if (this.hasPrinted(job.jobKey)) return
    if (this.state.queue.some((item) => item.jobKey === job.jobKey)) return
    this.state.queue.push({
      ...job,
      retryCount: job.retryCount || 0,
      nextAttemptAt: job.nextAttemptAt || Date.now(),
      lastError: job.lastError || "",
    })
    this.save()
  }

  /**
   * Returns ready jobs WITHOUT deleting them from the queue before printing.
   * Jobs are removed from `queue` only in `markPrinted` once printing succeeds.
   */
  peekReady(limit = 10) {
    const now = Date.now()
    return this.state.queue.filter((item) => item.nextAttemptAt <= now).slice(0, limit)
  }

  requeue(job, errorText) {
    const idx = this.state.queue.findIndex((item) => item.jobKey === job.jobKey)
    const prevRetry = idx >= 0 ? this.state.queue[idx].retryCount || 0 : job.retryCount || 0
    const retryCount = prevRetry + 1
    const delay = Math.min(15000, 400 * retryCount)
    const updated = {
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
}

module.exports = { JobStore }
