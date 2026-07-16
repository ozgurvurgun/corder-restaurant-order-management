const fs = require("fs")
const path = require("path")

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
    this.state = readJson(filePath, { printed: {}, queue: [] })
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

  markPrinted(jobKey) {
    this.state.printed[jobKey] = {
      printedAt: new Date().toISOString(),
    }
    this.save()
  }

  enqueue(job) {
    if (this.state.queue.some((item) => item.jobKey === job.jobKey)) return
    this.state.queue.push({
      ...job,
      retryCount: job.retryCount || 0,
      nextAttemptAt: job.nextAttemptAt || Date.now(),
      lastError: job.lastError || "",
    })
    this.save()
  }

  dequeueReady(limit = 10) {
    const now = Date.now()
    const snapshot = [...this.state.queue]
    const ready = snapshot.filter((item) => item.nextAttemptAt <= now).slice(0, limit)

    // Remove only the jobs we are about to attempt in this drain cycle.
    const readyKeys = new Set(ready.map((j) => j.jobKey))
    this.state.queue = snapshot.filter((item) => !readyKeys.has(item.jobKey))
    this.save()
    return ready
  }

  requeue(job, errorText) {
    const retryCount = (job.retryCount || 0) + 1
    const delay = Math.min(15000, 400 * retryCount)
    this.enqueue({
      ...job,
      retryCount,
      lastError: errorText || "",
      nextAttemptAt: Date.now() + delay,
    })
  }

  getQueueSize() {
    return this.state.queue.length
  }
}

module.exports = { JobStore }
