const MAX_LOG_ENTRIES = 150
const logBuffer = []

function stamp() {
  return new Date().toISOString()
}

function appendLog(level, message, meta) {
  const entry = {
    timestamp: stamp(),
    level,
    message: String(message || ""),
    meta: meta !== undefined ? meta : null,
  }
  logBuffer.push(entry)
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_ENTRIES)
  }
  return entry
}

function info(message, meta) {
  const entry = appendLog("INFO", message, meta)
  if (meta !== undefined) {
    console.log(`[${entry.timestamp}] INFO  ${entry.message}`, meta)
    return
  }
  console.log(`[${entry.timestamp}] INFO  ${entry.message}`)
}

function warn(message, meta) {
  const entry = appendLog("WARN", message, meta)
  if (meta !== undefined) {
    console.warn(`[${entry.timestamp}] WARN  ${entry.message}`, meta)
    return
  }
  console.warn(`[${entry.timestamp}] WARN  ${entry.message}`)
}

function error(message, meta) {
  const entry = appendLog("ERROR", message, meta)
  if (meta !== undefined) {
    console.error(`[${entry.timestamp}] ERROR ${entry.message}`, meta)
    return
  }
  console.error(`[${entry.timestamp}] ERROR ${entry.message}`)
}

function getRecentLogs() {
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
