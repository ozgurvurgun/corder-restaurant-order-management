const path = require("path")
const os = require("os")
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") })

/** Extra wait after PowerShell returns; pairs with send-raw-printer.ps1 ClosePrinter delay. */
const defaultUsbDrainMs = process.platform === "win32" ? 600 : 0

function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function defaultQueueFilePath() {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || os.tmpdir()
    return path.join(base, "CorderPrintAgent", "print-jobs.json")
  }
  return path.join(os.homedir(), ".corder", "print-jobs.json")
}

function resolveQueueFile() {
  const raw = process.env.QUEUE_FILE
  if (raw && path.isAbsolute(raw)) return raw
  if (raw) return path.resolve(process.cwd(), raw)
  return defaultQueueFilePath()
}

/** JSON env: {"category-uuid":"Windows Printer Name", ...} — use with PRINTER_MODE=command. */
function parseJsonEnv(key, fallback = {}) {
  try {
    const raw = process.env[key]
    if (!raw || !String(raw).trim()) return fallback
    const v = JSON.parse(String(raw))
    return v && typeof v === "object" && !Array.isArray(v) ? v : fallback
  } catch {
    return fallback
  }
}

const config = {
  /** REST API base URL (e.g. https://api.example.com). If empty, derived from BACKEND_WS_URL. */
  backendHttpUrl: (process.env.BACKEND_HTTP_URL || "").trim(),
  backendWsUrl: process.env.BACKEND_WS_URL || process.env.BACKEND_SOCKET_URL || "",
  backendSocketPath: process.env.BACKEND_SOCKET_PATH || "/ws",
  backendOrderEventName: process.env.BACKEND_ORDER_EVENT_NAME || "order:created",
  agentToken: process.env.AGENT_TOKEN || "",
  agentId: process.env.AGENT_ID || "windows-pos-1",
  restaurantId: process.env.RESTAURANT_ID || "",
  printerMode: process.env.PRINTER_MODE || "network_raw",
  printerName: process.env.PRINTER_NAME || "KITCHEN",
  /** Management panel cash receipt (receiptMode=consolidated). Falls back to PRINTER_NAME if empty. */
  managementReceiptPrinter: (process.env.MANAGEMENT_RECEIPT_PRINTER || "").trim(),
  printerHost: process.env.PRINTER_HOST || "127.0.0.1",
  printerPort: toNumber(process.env.PRINTER_PORT, 9100),
  printCommand: process.env.PRINT_COMMAND || "",
  queueFile: resolveQueueFile(),
  /** Initial WS reconnect delay (ms); lower = retries sooner after disconnect. */
  reconnectMs: toNumber(process.env.RECONNECT_MS, 800),
  /** socket.io client (reconnectionDelay) */
  socketReconnectionDelayMs: Math.max(200, toNumber(process.env.SOCKET_RECONNECT_DELAY_MS, 500)),
  socketReconnectionDelayMaxMs: Math.max(2000, toNumber(process.env.SOCKET_RECONNECT_MAX_MS, 12000)),
  /** Even if WebSocket drops, poll pending kitchen orders over HTTP (ms). 0 = disabled. */
  kitchenSyncIntervalMs: Math.max(0, toNumber(process.env.KITCHEN_SYNC_INTERVAL_MS, 2500)),
  pingIntervalMs: toNumber(process.env.PING_INTERVAL_MS, 15000),
  /** How often queued print jobs are retried (ms). Lower = snappier after failures. */
  queueDrainIntervalMs: Math.max(100, toNumber(process.env.QUEUE_DRAIN_MS, 500)),
  /** Optional first line on ticket to confirm deployed agent version (e.g. `v0.2`). */
  printTicketStamp: (process.env.PRINT_TICKET_STAMP || "").trim(),
  /** Centered last line on the ticket (e.g. restaurant / branch name). */
  printFooterLine: (process.env.PRINT_FOOTER_LINE || "").trim(),
  /** Monospace columns; typical 58mm ~ 32–42, 80mm ~ 48. */
  ticketCharsPerLine: Math.max(24, toNumber(process.env.TICKET_CHARS_PER_LINE, 42)),
  /**
   * ESC d n — lines fed before cut (plus 2 LFs in escpos). Increase if total clips.
   * 0–255; default 6.
   */
  ticketFeedLinesBeforeCut: Math.min(
    255,
    Math.max(0, Math.floor(toNumber(process.env.TICKET_FEED_LINES_BEFORE_CUT, 6))),
  ),
  /**
   * After Windows RAW print (PowerShell), wait this many ms so USB stack / driver drains before next job.
   * Helps when the job only appears after unplugging the cable. 0 disables.
   */
  printUsbDrainMs: Math.max(0, Math.floor(toNumber(process.env.PRINT_USB_DRAIN_MS, defaultUsbDrainMs))),
  /**
   * Category UUID -> Windows printer display name (same as Settings → Printers).
   * Example: PRINT_CATEGORY_ROUTES={"8f2c...":"KITCHEN","a1b3...":"BAR PRINTER"}
   */
  categoryPrinterRoutes: parseJsonEnv("PRINT_CATEGORY_ROUTES"),
  /**
   * Category UUID -> network printer host:port (PRINTER_MODE=network_raw). TCP target for that category.
   * Example: PRINT_CATEGORY_NETWORK={"8f2c...":"192.168.0.50:9100"}
   */
  categoryNetworkRoutes: parseJsonEnv("PRINT_CATEGORY_NETWORK"),
}

function validateConfig() {
  const missing = []
  if (!config.backendWsUrl) missing.push("BACKEND_WS_URL (or BACKEND_SOCKET_URL)")
  if (!config.agentToken) missing.push("AGENT_TOKEN")
  if (!config.restaurantId) missing.push("RESTAURANT_ID")

  if (missing.length) {
    throw new Error(`Missing required env values: ${missing.join(", ")}`)
  }
}

module.exports = { config, validateConfig }
