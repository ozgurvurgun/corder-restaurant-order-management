const MAX_LOG_ENTRIES = 60
const MAX_LOG_AGE_MS = 30 * 60 * 1000
const MAX_MESSAGE_LEN = 220
const MAX_META_LEN = 260

const logBuffer = []

function stamp() {
  return new Date().toISOString()
}

function sanitizeMeta(meta) {
  if (meta === undefined || meta === null) return null
  try {
    const raw = typeof meta === "string" ? meta : JSON.stringify(meta)
    return raw.length > MAX_META_LEN ? `${raw.slice(0, MAX_META_LEN)}...` : raw
  } catch {
    return null
  }
}

function pruneOldLogs() {
  if (!logBuffer.length) return
  const cutoff = Date.now() - MAX_LOG_AGE_MS
  while (logBuffer.length > 0) {
    const oldestTs = Date.parse(logBuffer[0].timestamp)
    if (Number.isFinite(oldestTs) && oldestTs < cutoff) {
      logBuffer.shift()
    } else {
      break
    }
  }
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_ENTRIES)
  }
}

const pruneTimer = setInterval(pruneOldLogs, 60000)
if (typeof pruneTimer.unref === "function") {
  pruneTimer.unref()
}

function appendLog(level, message, meta) {
  pruneOldLogs()
  const cleanMsg = String(message || "").slice(0, MAX_MESSAGE_LEN)
  const cleanMeta = sanitizeMeta(meta)

  const last = logBuffer[logBuffer.length - 1]
  if (last && last.level === level && last.message === cleanMsg && last.meta === cleanMeta) {
    last.timestamp = stamp()
    last.repeatCount = (last.repeatCount || 1) + 1
    return last
  }

  const entry = {
    timestamp: stamp(),
    level,
    message: cleanMsg,
    meta: cleanMeta,
    repeatCount: 1,
  }
  logBuffer.push(entry)
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_ENTRIES)
  }
  return entry
}

function info(message, meta) {
  const entry = appendLog("INFO", message, meta)
  if (entry.repeatCount > 1) return
  if (entry.meta) {
    console.log(`[${entry.timestamp}] INFO  ${entry.message} ${entry.meta}`)
    return
  }
  console.log(`[${entry.timestamp}] INFO  ${entry.message}`)
}

function warn(message, meta) {
  const entry = appendLog("WARN", message, meta)
  if (entry.repeatCount > 1) return
  if (entry.meta) {
    console.warn(`[${entry.timestamp}] WARN  ${entry.message} ${entry.meta}`)
    return
  }
  console.warn(`[${entry.timestamp}] WARN  ${entry.message}`)
}

function error(message, meta) {
  const entry = appendLog("ERROR", message, meta)
  if (entry.repeatCount > 1) return
  if (entry.meta) {
    console.error(`[${entry.timestamp}] ERROR ${entry.message} ${entry.meta}`)
    return
  }
  console.error(`[${entry.timestamp}] ERROR ${entry.message}`)
}

function getRecentLogs() {
  pruneOldLogs()
  return [...logBuffer].reverse()
}

function clearLogs() {
  logBuffer.length = 0
}

module.exports = {
  info,
  warn,
  error,
  getRecentLogs,
  clearLogs,
}
