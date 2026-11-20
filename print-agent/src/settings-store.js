const fs = require("fs")
const os = require("os")
const path = require("path")
const crypto = require("crypto")
const { config: baseConfig } = require("./config")

function getSettingsFilePath() {
  return baseConfig.settingsFile
}

let cachedMachineKey = null
function getMachineKey() {
  if (cachedMachineKey) return cachedMachineKey
  let user = "default"
  try {
    user = os.userInfo().username || "default"
  } catch {
    // ignore
  }
  const material = `corder-pa:${os.platform()}:${os.hostname()}:${user}`
  cachedMachineKey = crypto.scryptSync(material, "corder-print-agent-key-v1", 32)
  return cachedMachineKey
}

function getElectronSafeStorage() {
  try {
    const el = require("electron")
    if (el && typeof el === "object" && el.safeStorage && el.safeStorage.isEncryptionAvailable()) {
      return el.safeStorage
    }
  } catch {
    // Not in Electron main process or safeStorage unavailable
  }
  return null
}

function encryptSecret(plain) {
  const clean = String(plain || "").trim()
  if (!clean) return ""
  if (clean.startsWith("enc:safe:") || clean.startsWith("enc:gcm:")) return clean

  const safeStorage = getElectronSafeStorage()
  if (safeStorage) {
    try {
      const buf = safeStorage.encryptString(clean)
      return `enc:safe:${buf.toString("base64")}`
    } catch {
      // Fall back to AES-256-GCM
    }
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getMachineKey(), iv)
  const encrypted = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:gcm:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

function decryptSecret(stored) {
  const clean = String(stored || "").trim()
  if (!clean) return ""
  if (clean.startsWith("enc:safe:")) {
    const safeStorage = getElectronSafeStorage()
    if (!safeStorage) return ""
    try {
      const buf = Buffer.from(clean.slice("enc:safe:".length), "base64")
      return safeStorage.decryptString(buf)
    } catch {
      return ""
    }
  }
  if (clean.startsWith("enc:gcm:")) {
    try {
      const parts = clean.slice("enc:gcm:".length).split(":")
      if (parts.length !== 3) return ""
      const [ivHex, tagHex, dataHex] = parts
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        getMachineKey(),
        Buffer.from(ivHex, "hex"),
      )
      decipher.setAuthTag(Buffer.from(tagHex, "hex"))
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, "hex")),
        decipher.final(),
      ])
      return decrypted.toString("utf8")
    } catch {
      return ""
    }
  }
  return clean
}

function mapBackendPrinters(backendPrinters = [], localPrinters = []) {
  return backendPrinters
    .filter((p) => p && p.name)
    .map((p) => {
      const isNetwork =
        p.connection === "network" ||
        p.connection === "ethernet" ||
        (!p.connection && Boolean(p.ipAddress))
      const existing = Array.isArray(localPrinters)
        ? localPrinters.find(
            (lp) =>
              (lp.id && p.id && lp.id === p.id) ||
              (lp.name && lp.name.toLowerCase() === String(p.name).trim().toLowerCase()),
          )
        : null
      return {
        id: p.id || crypto.randomUUID(),
        name: String(p.name).trim(),
        type: String(p.type || "thermal").trim(),
        mode: isNetwork ? "network" : "system",
        systemPrinterName: isNetwork ? "" : String(p.systemPrinterName || p.ipAddress || existing?.systemPrinterName || p.name).trim(),
        host: isNetwork ? String(p.ipAddress || "127.0.0.1").trim() : "127.0.0.1",
        port: isNetwork ? Number(p.port) || 9100 : 9100,
        department: p.department ? String(p.department).trim() : null,
        paperWidth: Number(p.paperWidth) === 58 ? 58 : 80,
        feedLinesBeforeCut: 3,
        autoCut: p.autoCut !== false,
      }
    })
}

function mergePrintersWithBackend(localPrinters = [], backendPrinters = []) {
  const mappedCloud = mapBackendPrinters(backendPrinters, localPrinters)
  if (!localPrinters.length) return mappedCloud
  if (!mappedCloud.length) return localPrinters

  const result = localPrinters.map((lp) => ({ ...lp }))
  for (const cp of mappedCloud) {
    const existingIdx = result.findIndex(
      (lp) => lp.id === cp.id || lp.name.toLowerCase() === cp.name.toLowerCase(),
    )
    if (existingIdx >= 0) {
      const existing = result[existingIdx]
      result[existingIdx] = {
        ...existing,
        id: cp.id || existing.id,
        type: cp.type || existing.type,
        department: cp.department ?? existing.department ?? null,
        paperWidth: cp.paperWidth || existing.paperWidth,
        autoCut: cp.autoCut,
        ...(cp.mode === "network" && cp.host && cp.host !== "127.0.0.1"
          ? { mode: "network", host: cp.host, port: cp.port, systemPrinterName: "" }
          : {
              systemPrinterName: String(
                (existing.systemPrinterName && existing.systemPrinterName !== existing.name
                  ? existing.systemPrinterName
                  : cp.systemPrinterName) ||
                  existing.systemPrinterName ||
                  cp.name,
              ).trim(),
            }),
      }
    } else {
      result.push(cp)
    }
  }
  return result
}

function normalizeMatchToken(str) {
  if (!str) return ""
  return String(str)
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("\u0131", "i").replaceAll("\u015f", "s").replaceAll("\u011f", "g")
    .replaceAll("\u00fc", "u").replaceAll("\u00f6", "o").replaceAll("\u00e7", "c")
}

function seedDepartmentCategoryRoutes(existingRoutes = {}, categories = [], printers = []) {
  const nextRoutes = { ...(existingRoutes || {}) }
  for (const cat of categories) {
    if (!cat?.id || nextRoutes[cat.id]) continue
    const catNorm = normalizeMatchToken(cat.name)
    if (!catNorm) continue
    const matched = printers.find((p) => p.department && normalizeMatchToken(p.department) === catNorm)
    if (matched) nextRoutes[cat.id] = matched.id
  }
  return nextRoutes
}

function defaultSettings() {
  return {
    backendUrl: baseConfig.backendHttpUrl,
    backendSocketPath: baseConfig.backendSocketPath || "/ws",
    authToken: "",
    refreshToken: "",
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
    printUsbDrainMs: baseConfig.printUsbDrainMs,
    autoStartOnBoot: true,
    kitchenSyncIntervalMs: baseConfig.kitchenSyncIntervalMs,
    queueDrainIntervalMs: baseConfig.queueDrainIntervalMs,
  }
}

function normalizeSettings(raw) {
  const defaults = defaultSettings()
  const merged = { ...defaults, ...(raw || {}) }
  merged.authToken = decryptSecret(merged.authToken)
  merged.refreshToken = decryptSecret(merged.refreshToken)
  merged.username = String(merged.username || "").trim().toLowerCase()
  merged.restaurantId = String(merged.restaurantId || "").trim()
  merged.restaurantName = String(merged.restaurantName || "").trim()
  merged.restaurantSlug = String(merged.restaurantSlug || "").trim()
  merged.autoStartOnBoot = merged.autoStartOnBoot !== false
  merged.printers = Array.isArray(merged.printers)
    ? merged.printers.map((p, idx) => ({
        id: String(p.id || `p-${idx + 1}`),
        name: String(p.name || p.systemPrinterName || p.host || `Printer ${idx + 1}`).trim(),
        type: String(p.type || "thermal").trim(),
        mode: p.mode === "network" ? "network" : "system",
        systemPrinterName: p.mode === "network" ? "" : String(p.systemPrinterName || p.name || "").trim(),
        host: String(p.host || "127.0.0.1").trim(),
        port: Math.min(65535, Math.max(1, Number(p.port) || 9100)),
        department: p.department ? String(p.department).trim() : null,
        paperWidth: Number(p.paperWidth) === 58 ? 58 : 80,
        feedLinesBeforeCut: Math.min(255, Math.max(0, Number(p.feedLinesBeforeCut ?? 3))),
        autoCut: p.autoCut !== false,
      }))
    : []
  merged.categoryRoutes =
    merged.categoryRoutes && typeof merged.categoryRoutes === "object" && !Array.isArray(merged.categoryRoutes)
      ? { ...merged.categoryRoutes }
      : {}
  merged.categories = Array.isArray(merged.categories) ? merged.categories : []

  if (!merged.defaultKitchenPrinterId && merged.printers.length > 0) {
    const kitchenCandidate =
      merged.printers.find((p) => p.type === "kitchen" || p.type === "bar") || merged.printers[0]
    merged.defaultKitchenPrinterId = kitchenCandidate.id
  }
  if (!merged.receiptPrinterId && merged.printers.length > 0) {
    const receiptCandidate =
      merged.printers.find((p) => p.type === "receipt" || p.type === "cashier" || p.type === "kasa") ||
      (merged.defaultKitchenPrinterId !== "none"
        ? merged.printers.find((p) => p.id === merged.defaultKitchenPrinterId)
        : null) ||
      merged.printers[0]
    merged.receiptPrinterId = receiptCandidate.id
  }

  merged.printUsbDrainMs = Math.min(5000, Math.max(0, Number(merged.printUsbDrainMs ?? baseConfig.printUsbDrainMs)))
  return merged
}

function readRawDiskSettings(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"))
    }
  } catch {
    // ignore
  }
  return null
}

function loadSettings() {
  const filePath = getSettingsFilePath()
  const raw = readRawDiskSettings(filePath)
  if (raw) {
    return normalizeSettings(raw)
  }
  return saveSettings(normalizeSettings(null))
}

function saveSettings(partial) {
  const filePath = getSettingsFilePath()
  const current = normalizeSettings(readRawDiskSettings(filePath))
  const next = normalizeSettings({ ...current, ...(partial || {}) })
  const diskRecord = {
    ...next,
    authToken: encryptSecret(next.authToken),
    refreshToken: encryptSecret(next.refreshToken),
  }
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const tmpFile = `${filePath}.${process.pid}.tmp`
  const payload = JSON.stringify(diskRecord, null, 2)
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
  const { authToken, refreshToken, backendUrl, backendSocketPath, ...rest } = s
  return {
    ...rest,
    authenticated: Boolean((authToken || refreshToken) && s.restaurantId),
  }
}

function buildRuntimeConfig(settingsInput) {
  const settings = normalizeSettings(settingsInput || loadSettings())
  const printersById = Object.fromEntries(settings.printers.map((p) => [p.id, p]))
  const defaultKitchenPrinter =
    settings.defaultKitchenPrinterId === "none"
      ? null
      : printersById[settings.defaultKitchenPrinterId] || settings.printers[0] || null
  const receiptPrinter =
    settings.receiptPrinterId === "none"
      ? null
      : printersById[settings.receiptPrinterId] || defaultKitchenPrinter || null

  const categoryParentMap = {}
  const categoriesById = {}
  for (const cat of settings.categories || []) {
    if (cat?.id) {
      categoryParentMap[cat.id] = cat.parentId || null
      categoriesById[cat.id] = cat
    }
  }

  return {
    ...baseConfig,
    backendHttpUrl: settings.backendUrl || baseConfig.backendHttpUrl,
    backendWsUrl: settings.backendUrl || baseConfig.backendWsUrl,
    backendSocketPath: settings.backendSocketPath || "/ws",
    agentToken: settings.authToken,
    refreshToken: settings.refreshToken,
    username: settings.username,
    agentId: settings.agentId,
    restaurantId: settings.restaurantId,
    restaurantName: settings.restaurantName,
    autoStartOnBoot: settings.autoStartOnBoot !== false,
    printerMode: defaultKitchenPrinter?.mode === "network" ? "network_raw" : "system",
    printerName: defaultKitchenPrinter?.systemPrinterName || defaultKitchenPrinter?.name || "",
    printerHost: defaultKitchenPrinter?.host || "127.0.0.1",
    printerPort: Number(defaultKitchenPrinter?.port) || 9100,
    printFooterLine: settings.printFooterLine || "",
    printUsbDrainMs: Number(settings.printUsbDrainMs ?? baseConfig.printUsbDrainMs),
    kitchenSyncIntervalMs: Number(settings.kitchenSyncIntervalMs || 2500),
    queueDrainIntervalMs: Number(settings.queueDrainIntervalMs || 500),
    ticketCharsPerLine: defaultKitchenPrinter?.paperWidth === 58 ? 32 : 42,
    ticketFeedLinesBeforeCut: Number(defaultKitchenPrinter?.feedLinesBeforeCut ?? 3),
    asciiFallback: settings.asciiFallback !== false,
    printers: settings.printers,
    printersById,
    defaultKitchenPrinterId: settings.defaultKitchenPrinterId,
    receiptPrinterId: settings.receiptPrinterId,
    defaultKitchenPrinter,
    receiptPrinter,
    categoryRoutes: settings.categoryRoutes || {},
    categoryParentMap,
    categoriesById,
  }
}

module.exports = {
  getSettingsFilePath,
  loadSettings,
  saveSettings,
  getPublicSettings,
  buildRuntimeConfig,
  encryptSecret,
  decryptSecret,
  mapBackendPrinters,
  mergePrintersWithBackend,
  seedDepartmentCategoryRoutes,
}
