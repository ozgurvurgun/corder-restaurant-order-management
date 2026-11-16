const fs = require("fs")
const os = require("os")
const path = require("path")
const { config: baseConfig } = require("./config")

const defaultUsbDrainMs = process.platform === "win32" ? 600 : 0

function getSettingsFilePath() {
  if (process.env.SETTINGS_FILE) return path.resolve(process.cwd(), process.env.SETTINGS_FILE)
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || os.tmpdir()
    return path.join(base, "CorderPrintAgent", "settings.json")
  }
  return path.join(os.homedir(), ".corder", "print-agent-settings.json")
}

function parseHostPort(raw, defaultPort = 9100) {
  const parts = String(raw || "").trim().split(":")
  return { host: (parts[0] || "127.0.0.1").trim(), port: Number(parts[1]) || defaultPort }
}

function seedSettingsFromEnv() {
  const printers = []
  const categoryRoutes = {}
  const paperWidth = baseConfig.ticketCharsPerLine <= 34 ? 58 : 80
  const feedLinesBeforeCut = baseConfig.ticketFeedLinesBeforeCut || 6

  const findOrAddSystemPrinter = (sysName, labelPrefix = "") => {
    const clean = String(sysName || "").trim()
    if (!clean || clean === "REPLACE_WITH_WINDOWS_PRINTER_NAME") return null
    const existing = printers.find((p) => p.mode === "system" && p.systemPrinterName === clean)
    if (existing) return existing
    const created = {
      id: `p-${printers.length + 1}`,
      name: labelPrefix ? `${labelPrefix} (${clean})` : clean,
      mode: "system",
      systemPrinterName: clean,
      host: "127.0.0.1",
      port: 9100,
      paperWidth,
      feedLinesBeforeCut,
    }
    printers.push(created)
    return created
  }

  const findOrAddNetworkPrinter = (hostPort, label = "") => {
    const { host, port } = parseHostPort(hostPort, baseConfig.printerPort || 9100)
    const existing = printers.find((p) => p.mode === "network" && p.host === host && Number(p.port) === Number(port))
    if (existing) return existing
    const created = {
      id: `p-${printers.length + 1}`,
      name: label || `IP Printer (${host}:${port})`,
      mode: "network",
      systemPrinterName: "",
      host,
      port,
      paperWidth,
      feedLinesBeforeCut,
    }
    printers.push(created)
    return created
  }

  const defaultKitchenPrinter =
    baseConfig.printerMode === "network_raw"
      ? findOrAddNetworkPrinter(`${baseConfig.printerHost}:${baseConfig.printerPort}`, baseConfig.printerName || "Kitchen IP")
      : baseConfig.printerName
        ? findOrAddSystemPrinter(baseConfig.printerName)
        : null

  const receiptPrinter = baseConfig.managementReceiptPrinter
    ? findOrAddSystemPrinter(baseConfig.managementReceiptPrinter) || defaultKitchenPrinter
    : defaultKitchenPrinter

  for (const [cid, pName] of Object.entries(baseConfig.categoryPrinterRoutes || {})) {
    const p = findOrAddSystemPrinter(pName)
    if (p) categoryRoutes[cid] = p.id
  }
  for (const [cid, netTarget] of Object.entries(baseConfig.categoryNetworkRoutes || {})) {
    const p = findOrAddNetworkPrinter(netTarget)
    if (p) categoryRoutes[cid] = p.id
  }

  return {
    backendUrl: baseConfig.backendHttpUrl || baseConfig.backendWsUrl || "https://api.corders.uk",
    backendSocketPath: baseConfig.backendSocketPath || "/ws",
    agentToken: baseConfig.agentToken === "replace-with-static-print-agent-token" ? "" : baseConfig.agentToken || "",
    agentId: baseConfig.agentId || "windows-pos-1",
    restaurantId: baseConfig.restaurantId || "*",
    restaurantName: "",
    uiPort: Number(process.env.UI_PORT) || 4190,
    printers,
    defaultKitchenPrinterId: defaultKitchenPrinter?.id || "",
    receiptPrinterId: receiptPrinter?.id || defaultKitchenPrinter?.id || "",
    categoryRoutes,
    categories: [],
    printFooterLine: baseConfig.printFooterLine || "",
    printTicketStamp: baseConfig.printTicketStamp || "",
    printUsbDrainMs: Number.isFinite(baseConfig.printUsbDrainMs) ? baseConfig.printUsbDrainMs : defaultUsbDrainMs,
    kitchenSyncIntervalMs: baseConfig.kitchenSyncIntervalMs || 2500,
    queueDrainIntervalMs: baseConfig.queueDrainIntervalMs || 500,
  }
}

function normalizeSettings(raw) {
  const seeded = seedSettingsFromEnv()
  const merged = { ...seeded, ...(raw || {}) }
  merged.printers = Array.isArray(merged.printers)
    ? merged.printers.map((p, idx) => ({
        id: String(p.id || `p-${idx + 1}`),
        name: String(p.name || p.systemPrinterName || p.host || `Printer ${idx + 1}`).trim(),
        mode: p.mode === "network" ? "network" : "system",
        systemPrinterName: String(p.systemPrinterName || "").trim(),
        host: String(p.host || "127.0.0.1").trim(),
        port: Number(p.port) || 9100,
        paperWidth: Number(p.paperWidth) === 58 ? 58 : 80,
        feedLinesBeforeCut: Math.min(255, Math.max(0, Number(p.feedLinesBeforeCut ?? 6))),
      }))
    : seeded.printers
  merged.categoryRoutes =
    merged.categoryRoutes && typeof merged.categoryRoutes === "object" ? { ...merged.categoryRoutes } : {}
  merged.categories = Array.isArray(merged.categories) ? merged.categories : []
  if (!merged.defaultKitchenPrinterId && merged.printers[0]) merged.defaultKitchenPrinterId = merged.printers[0].id
  if (!merged.receiptPrinterId && merged.printers[0]) {
    merged.receiptPrinterId = merged.defaultKitchenPrinterId || merged.printers[0].id
  }
  return merged
}

function syncDotEnvFile(settings) {
  if (process.env.SETTINGS_FILE) return
  try {
    const envPath = path.resolve(process.cwd(), ".env")
    const defP = settings.printers.find((p) => p.id === settings.defaultKitchenPrinterId) || settings.printers[0]
    const recP = settings.printers.find((p) => p.id === settings.receiptPrinterId) || defP
    const sysRoutes = {}
    const netRoutes = {}
    for (const [cid, pid] of Object.entries(settings.categoryRoutes || {})) {
      const p = settings.printers.find((item) => item.id === pid)
      if (!p) continue
      if (p.mode === "network") netRoutes[cid] = `${p.host}:${p.port}`
      else if (p.systemPrinterName) sysRoutes[cid] = p.systemPrinterName
    }
    const lines = [
      `BACKEND_WS_URL=${settings.backendUrl || "https://api.corders.uk"}`,
      `BACKEND_SOCKET_PATH=${settings.backendSocketPath || "/ws"}`,
      `BACKEND_ORDER_EVENT_NAME=order:created`,
      `AGENT_TOKEN=${settings.agentToken || ""}`,
      `AGENT_ID=${settings.agentId || "windows-pos-1"}`,
      `RESTAURANT_ID=${settings.restaurantId || "*"}`,
      `PRINTER_MODE=${defP?.mode === "network" ? "network_raw" : "command"}`,
      `PRINTER_NAME=${defP?.systemPrinterName || defP?.name || "KITCHEN"}`,
      `PRINTER_HOST=${defP?.host || "127.0.0.1"}`,
      `PRINTER_PORT=${defP?.port || 9100}`,
      `PRINT_COMMAND=powershell -NoProfile -ExecutionPolicy Bypass -File ".\\scripts\\send-raw-printer.ps1" -PrinterName "{PRINTER_NAME}" -FilePath "{FILE}"`,
      `MANAGEMENT_RECEIPT_PRINTER=${recP?.systemPrinterName || recP?.name || ""}`,
      `PRINT_CATEGORY_ROUTES=${JSON.stringify(sysRoutes)}`,
      `PRINT_CATEGORY_NETWORK=${JSON.stringify(netRoutes)}`,
      `PRINT_FOOTER_LINE=${settings.printFooterLine || ""}`,
      `PRINT_TICKET_STAMP=${settings.printTicketStamp || ""}`,
      `PRINT_USB_DRAIN_MS=${settings.printUsbDrainMs ?? defaultUsbDrainMs}`,
      `QUEUE_DRAIN_MS=${settings.queueDrainIntervalMs || 500}`,
    ]
    fs.writeFileSync(envPath, `${lines.join("\n")}\n`, "utf8")
  } catch {
    // Non-fatal
  }
}

function loadSettings() {
  const filePath = getSettingsFilePath()
  try {
    if (fs.existsSync(filePath)) return normalizeSettings(JSON.parse(fs.readFileSync(filePath, "utf8")))
  } catch {
    // Fall back to seeded env
  }
  return saveSettings(normalizeSettings(null))
}

function saveSettings(partial) {
  const filePath = getSettingsFilePath()
  let current = {}
  try {
    if (fs.existsSync(filePath)) current = JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    current = {}
  }
  const next = normalizeSettings({ ...current, ...(partial || {}) })
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf8")
  syncDotEnvFile(next)
  return next
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
  const defaultPrintCmd =
    process.platform === "win32"
      ? 'powershell -NoProfile -ExecutionPolicy Bypass -File "./scripts/send-raw-printer.ps1" -PrinterName "{PRINTER_NAME}" -FilePath "{FILE}"'
      : 'lp -d "{PRINTER_NAME}" -o raw "{FILE}"'

  return {
    ...baseConfig,
    backendHttpUrl: (settings.backendUrl || "").trim(),
    backendWsUrl: (settings.backendUrl || "").trim(),
    backendSocketPath: settings.backendSocketPath || "/ws",
    agentToken: (settings.agentToken || "").trim(),
    agentId: settings.agentId || "windows-pos-1",
    restaurantId: settings.restaurantId || "*",
    restaurantName: settings.restaurantName || "",
    printerMode: defaultKitchenPrinter?.mode === "network" ? "network_raw" : "command",
    printerName: defaultKitchenPrinter?.systemPrinterName || defaultKitchenPrinter?.name || baseConfig.printerName,
    printerHost: defaultKitchenPrinter?.host || baseConfig.printerHost || "127.0.0.1",
    printerPort: Number(defaultKitchenPrinter?.port) || baseConfig.printerPort || 9100,
    managementReceiptPrinter: receiptPrinter?.systemPrinterName || receiptPrinter?.name || "",
    printCommand: baseConfig.printCommand || defaultPrintCmd,
    printFooterLine: settings.printFooterLine || "",
    printTicketStamp: settings.printTicketStamp || "",
    printUsbDrainMs: Number(settings.printUsbDrainMs ?? defaultUsbDrainMs),
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

module.exports = { getSettingsFilePath, loadSettings, saveSettings, buildRuntimeConfig }
