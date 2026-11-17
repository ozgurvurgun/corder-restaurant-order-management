const fs = require("fs")
const os = require("os")
const path = require("path")

/**
 * Embedded Corder Backend URLs.
 * Automatically uses local backend in development if reachable, environment override if set,
 * or saved/production API URL.
 */
const PRODUCTION_SERVER_URL = "https://api.corders.uk"
const LOCAL_DEV_SERVER_URL = "http://localhost:4000"

function getEnvBackendUrl() {
  const raw =
    process.env.CORDER_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.BACKEND_HTTP_URL ||
    process.env.BACKEND_WS_URL ||
    ""
  return String(raw).trim().replace(/\/$/, "")
}

let cachedBackendUrl = null
let lastProbeAt = 0

async function resolveEmbeddedBackendUrl(forceRefresh = false, savedBackendUrl = null) {
  const envUrl = getEnvBackendUrl()
  if (envUrl) {
    cachedBackendUrl = envUrl
    return envUrl
  }

  const now = Date.now()
  if (!forceRefresh && cachedBackendUrl && now - lastProbeAt < 30000) {
    return cachedBackendUrl
  }
  lastProbeAt = now
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 650)
  try {
    const res = await fetch(`${LOCAL_DEV_SERVER_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    })
    if (res.ok) {
      cachedBackendUrl = LOCAL_DEV_SERVER_URL
      return cachedBackendUrl
    }
  } catch {
    // Local dev server not running
  } finally {
    clearTimeout(timer)
  }

  const cleanSaved = String(savedBackendUrl || "").trim().replace(/\/$/, "")
  if (cleanSaved && cleanSaved !== LOCAL_DEV_SERVER_URL) {
    cachedBackendUrl = cleanSaved
    return cachedBackendUrl
  }

  cachedBackendUrl = PRODUCTION_SERVER_URL
  return cachedBackendUrl
}

function getAppDataDir() {
  let dir
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || os.tmpdir()
    dir = path.join(base, "CorderPrintAgent")
  } else if (process.platform === "darwin") {
    dir = path.join(os.homedir(), "Library", "Application Support", "CorderPrintAgent")
  } else {
    const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
    dir = path.join(xdg, "corder-print-agent")
  }
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    return dir
  } catch {
    const fallback = path.join(os.tmpdir(), "corder-print-agent")
    fs.mkdirSync(fallback, { recursive: true, mode: 0o700 })
    return fallback
  }
}

const initialBackendUrl = getEnvBackendUrl() || PRODUCTION_SERVER_URL

const config = {
  productionServerUrl: PRODUCTION_SERVER_URL,
  localDevServerUrl: LOCAL_DEV_SERVER_URL,
  backendHttpUrl: initialBackendUrl,
  backendWsUrl: initialBackendUrl,
  backendSocketPath: "/ws",
  backendOrderEventName: "order:created",
  agentId: `${os.platform()}-${os.hostname().slice(0, 24)}`,
  queueFile: path.join(getAppDataDir(), "print-jobs.json"),
  settingsFile: path.join(getAppDataDir(), "settings.json"),
  socketReconnectionDelayMs: 600,
  socketReconnectionDelayMaxMs: 10000,
  kitchenSyncIntervalMs: 2500,
  queueDrainIntervalMs: 500,
  ticketCharsPerLine: 42,
  ticketFeedLinesBeforeCut: 3,
  asciiFallback: true,
  printUsbDrainMs: process.platform === "win32" ? 400 : 100,
}

module.exports = {
  config,
  getAppDataDir,
  resolveEmbeddedBackendUrl,
  PRODUCTION_SERVER_URL,
}
