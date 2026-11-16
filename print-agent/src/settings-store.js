const fs = require("fs")
const path = require("path")
const { config: baseConfig } = require("./config")

function getSettingsFilePath() {
  return baseConfig.settingsFile
}

function defaultSettings() {
  return {
    backendUrl: baseConfig.backendHttpUrl,
    backendSocketPath: baseConfig.backendSocketPath || "/ws",
    authToken: "",
    username: "",
    agentId: baseConfig.agentId,
    restaurantId: "",
    restaurantName: "",
    restaurantSlug: "",
    printers: [],
    defaultKitchenPrinterId: "",
    receiptPrinterId: "",
    categoryRoutes: {},
    categories: [],
    printFooterLine: "",
    printTicketStamp: "",
    printUsbDrainMs: baseConfig.printUsbDrainMs,
    kitchenSyncIntervalMs: baseConfig.kitchenSyncIntervalMs,
    queueDrainIntervalMs: baseConfig.queueDrainIntervalMs,
  }
}

function normalizeSettings(raw) {
  const defaults = defaultSettings()
  const merged = { ...defaults, ...(raw || {}) }
  merged.authToken = String(merged.authToken || "").trim()
  merged.username = String(merged.username || "").trim().toLowerCase()
  merged.restaurantId = String(merged.restaurantId || "").trim()
  merged.restaurantName = String(merged.restaurantName || "").trim()
  merged.restaurantSlug = String(merged.restaurantSlug || "").trim()
  merged.printers = Array.isArray(merged.printers)
    ? merged.printers.map((p, idx) => ({
        id: String(p.id || `p-${idx + 1}`),
        name: String(p.name || p.systemPrinterName || p.host || `Printer ${idx + 1}`).trim(),
        mode: p.mode === "network" ? "network" : "system",
        systemPrinterName: String(p.systemPrinterName || "").trim(),
        host: String(p.host || "127.0.0.1").trim(),
        port: Math.min(65535, Math.max(1, Number(p.port) || 9100)),
        paperWidth: Number(p.paperWidth) === 58 ? 58 : 80,
        feedLinesBeforeCut: Math.min(255, Math.max(0, Number(p.feedLinesBeforeCut ?? 6))),
      }))
    : []
  merged.categoryRoutes =
    merged.categoryRoutes && typeof merged.categoryRoutes === "object" && !Array.isArray(merged.categoryRoutes)
      ? { ...merged.categoryRoutes }
      : {}
  merged.categories = Array.isArray(merged.categories) ? merged.categories : []
  if (!merged.defaultKitchenPrinterId && merged.printers[0]) {
    merged.defaultKitchenPrinterId = merged.printers[0].id
  }
  if (!merged.receiptPrinterId && merged.printers[0]) {
    merged.receiptPrinterId = merged.defaultKitchenPrinterId || merged.printers[0].id
  }
  merged.printUsbDrainMs = Math.min(5000, Math.max(0, Number(merged.printUsbDrainMs ?? baseConfig.printUsbDrainMs)))
  return merged
}

function loadSettings() {
  const filePath = getSettingsFilePath()
  try {
    if (fs.existsSync(filePath)) {
      return normalizeSettings(JSON.parse(fs.readFileSync(filePath, "utf8")))
    }
  } catch {
    // Fall back to defaults
  }
  return saveSettings(normalizeSettings(null))
}

function saveSettings(partial) {
  const filePath = getSettingsFilePath()
  let current = {}
  try {
    if (fs.existsSync(filePath)) {
      current = JSON.parse(fs.readFileSync(filePath, "utf8"))
    }
  } catch {
    current = {}
  }
  const next = normalizeSettings({ ...current, ...(partial || {}) })
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const tmpFile = `${filePath}.${process.pid}.tmp`
  const payload = JSON.stringify(next, null, 2)
  try {
    fs.writeFileSync(tmpFile, payload, { encoding: "utf8", mode: 0o600 })
    fs.renameSync(tmpFile, filePath)
  } catch {
    fs.writeFileSync(filePath, payload, { encoding: "utf8", mode: 0o600 })
  }
  return next
}

function getPublicSettings(settingsInput) {
  const s = normalizeSettings(settingsInput || loadSettings())
  const { authToken, backendUrl, backendSocketPath, ...rest } = s
  return {
    ...rest,
    authenticated: Boolean(authToken && s.restaurantId),
  }
}

function buildRuntimeConfig(settingsInput) {
  const settings = normalizeSettings(settingsInput || loadSettings())
  const printersById = Object.fromEntries(settings.printers.map((p) => [p.id, p]))
  const defaultKitchenPrinter = printersById[settings.defaultKitchenPrinterId] || settings.printers[0] || null
  const receiptPrinter = printersById[settings.receiptPrinterId] || defaultKitchenPrinter || null
  const categoryParentMap = {}
  for (const cat of settings.categories || []) {
    if (cat?.id) categoryParentMap[cat.id] = cat.parentId || null
  }
  const categoryPrinterRoutes = {}
  const categoryNetworkRoutes = {}
  for (const [cid, pid] of Object.entries(settings.categoryRoutes || {})) {
    const p = printersById[pid]
    if (!p) continue
    if (p.mode === "network") categoryNetworkRoutes[cid] = `${p.host}:${p.port}`
    else if (p.systemPrinterName) categoryPrinterRoutes[cid] = p.systemPrinterName
  }

  return {
    ...baseConfig,
    backendHttpUrl: settings.backendUrl || baseConfig.backendHttpUrl,
    backendWsUrl: settings.backendUrl || baseConfig.backendWsUrl,
    backendSocketPath: settings.backendSocketPath || "/ws",
    agentToken: settings.authToken,
    username: settings.username,
    agentId: settings.agentId,
    restaurantId: settings.restaurantId,
    restaurantName: settings.restaurantName,
    printerMode: defaultKitchenPrinter?.mode === "network" ? "network_raw" : "system",
    printerName: defaultKitchenPrinter?.systemPrinterName || defaultKitchenPrinter?.name || "KITCHEN",
    printerHost: defaultKitchenPrinter?.host || "127.0.0.1",
    printerPort: Number(defaultKitchenPrinter?.port) || 9100,
    managementReceiptPrinter: receiptPrinter?.systemPrinterName || receiptPrinter?.name || "",
    printFooterLine: settings.printFooterLine || "",
    printTicketStamp: settings.printTicketStamp || "",
    printUsbDrainMs: Number(settings.printUsbDrainMs ?? baseConfig.printUsbDrainMs),
    kitchenSyncIntervalMs: Number(settings.kitchenSyncIntervalMs || 2500),
    queueDrainIntervalMs: Number(settings.queueDrainIntervalMs || 500),
    ticketCharsPerLine: defaultKitchenPrinter?.paperWidth === 58 ? 32 : 42,
    ticketFeedLinesBeforeCut: Number(defaultKitchenPrinter?.feedLinesBeforeCut ?? 6),
    printers: settings.printers,
    printersById,
    defaultKitchenPrinter,
    receiptPrinter,
    categoryRoutes: settings.categoryRoutes || {},
    categoryParentMap,
    categoryPrinterRoutes,
    categoryNetworkRoutes,
  }
}

module.exports = {
  getSettingsFilePath,
  loadSettings,
  saveSettings,
  getPublicSettings,
  buildRuntimeConfig,
}
