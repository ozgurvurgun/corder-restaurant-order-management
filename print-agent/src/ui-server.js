const http = require("http")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const {
  loadSettings, saveSettings, getPublicSettings, buildRuntimeConfig,
  mapBackendPrinters, mergePrintersWithBackend, seedDepartmentCategoryRoutes, isSamePhysicalPrinter,
} = require("./settings-store")
const {
  discoverSystemPrinters, discoverNetworkPrinters, testTcpPrinterConnection,
} = require("./printer-discovery")
const {
  startNetworkPrinterWatchdog, buildSavedPrinterEntry,
} = require("./network-healer")
const {
  loginPrintAgent, logoutPrintAgent, fetchAgentContext, pushPrintersToBackend, updateBackendVoiceSettings,
} = require("./http-sync")
const {
  announceWaiterCall, getRecentUiAudioEvents,
} = require("./turkish-tts")
const { applyAutoStartSetting } = require("./autostart")
const { buildTestTicket } = require("./escpos")
const { printBytes, purgeSystemPrintQueues } = require("./printers")
const { info, warn, getRecentLogs, clearLogs } = require("./logger")

const PUBLIC_DIR = path.resolve(__dirname, "..", "public")
const MIME_TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" }
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'",
  "Cache-Control": "no-store",
}
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(payload))
}
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on("data", (chunk) => {
      total += chunk.length
      if (total > 256 * 1024) { reject(new Error("Payload too large")); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on("end", () => {
      try { const raw = Buffer.concat(chunks).toString("utf8").trim(); resolve(raw ? JSON.parse(raw) : {}) }
      catch { reject(new Error("Invalid JSON body")) }
    })
    req.on("error", reject)
  })
}
function parseCookies(cookieHeader) {
  const out = {}
  for (const part of String(cookieHeader || "").split(";")) {
    const idx = part.indexOf("=")
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim()
  }
  return out
}
function isLoopbackHost(req) {
  const host = String(req.headers.host || "").toLowerCase().trim()
  return host === "127.0.0.1" || host === "localhost" || host.startsWith("127.0.0.1:") || host.startsWith("localhost:")
}
function safeTokenEqual(candidate, expected) {
  if (!candidate || !expected) return false
  const a = Buffer.from(String(candidate), "utf8"), b = Buffer.from(String(expected), "utf8")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
function isAllowedLoopbackRequest(req, sessionToken) {
  if (!isLoopbackHost(req)) return false
  if (safeTokenEqual(String(req.headers["x-corder-session"] || "").trim(), sessionToken)) return true
  if (!safeTokenEqual(parseCookies(req.headers.cookie).corder_pa_session, sessionToken)) return false
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = String(req.headers.origin || "").toLowerCase()
    if (!origin.startsWith("http://127.0.0.1:") && !origin.startsWith("http://localhost:")) return false
  }
  return true
}
function serveStaticFile(req, res, urlPath, sessionToken) {
  if (!isLoopbackHost(req)) return sendJson(res, 403, { ok: false, error: "Forbidden host" })
  if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { ok: false, error: "Method not allowed" })
  const relPath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "")
  const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "")
  const fullPath = path.join(PUBLIC_DIR, safePath)
  if (!fullPath.startsWith(PUBLIC_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return sendJson(res, 404, { ok: false, error: "Not found" })
  }
  const ext = path.extname(fullPath).toLowerCase()
  const headers = { ...SECURITY_HEADERS, "Content-Type": MIME_TYPES[ext] || "application/octet-stream" }
  if (relPath === "index.html") headers["Set-Cookie"] = `corder_pa_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict`
  res.writeHead(200, headers)
  if (req.method === "HEAD") return res.end()
  fs.createReadStream(fullPath).pipe(res)
}

function createUiServer({ store, agent }) {
  let electronPrinterProvider = null
  let electronAppRef = null
  let lastLocalPrinterMutationAt = 0
  let activePushCount = 0
  const sessionToken = crypto.randomBytes(32).toString("hex")

  const applyAndReload = (partial) => {
    const saved = saveSettings(partial)
    const runtimeConfig = buildRuntimeConfig(saved)
    runtimeConfig.onHealedRuntimeConfig = (nextRuntime) => agent.reloadConfig(nextRuntime)
    agent.reloadConfig(runtimeConfig)
    return { settings: saved, publicSettings: getPublicSettings(saved), runtimeConfig }
  }

  const triggerBackendPrinterSync = (runtimeConfig, settings) => {
    lastLocalPrinterMutationAt = Date.now()
    activePushCount++
    void Promise.resolve(pushPrintersToBackend(runtimeConfig, settings))
      .catch(() => false)
      .finally(() => {
        activePushCount = Math.max(0, activePushCount - 1)
        lastLocalPrinterMutationAt = Date.now()
      })
  }

  startNetworkPrinterWatchdog({ agent, intervalMs: 45000 })

  const syncContextFromBackend = async (reason = "manual") => {
    if (
      reason === "ws-printers-updated" &&
      (activePushCount > 0 || Date.now() - lastLocalPrinterMutationAt < 4000)
    ) {
      const saved = loadSettings()
      return {
        settings: saved,
        publicSettings: getPublicSettings(saved),
        runtimeConfig: buildRuntimeConfig(saved),
      }
    }
    const initial = loadSettings()
    const ctx = await fetchAgentContext(buildRuntimeConfig(initial))
    if (
      reason === "ws-printers-updated" &&
      (activePushCount > 0 || Date.now() - lastLocalPrinterMutationAt < 4000)
    ) {
      const saved = loadSettings()
      return {
        settings: saved,
        publicSettings: getPublicSettings(saved),
        runtimeConfig: buildRuntimeConfig(saved),
      }
    }
    const current = loadSettings()
    const nextCategories = ctx.categories || []
    const nextPrinters = mergePrintersWithBackend(current.printers, ctx.printers)
    const nextRoutes = seedDepartmentCategoryRoutes(
      current.categoryRoutes,
      nextCategories,
      nextPrinters,
    )
    const res = applyAndReload({
      restaurantId: ctx.restaurant?.id || current.restaurantId,
      restaurantName: ctx.restaurant?.name || current.restaurantName,
      ...(ctx.restaurant?.voiceAnnouncementEnabled !== undefined
        ? { voiceAnnouncementEnabled: ctx.restaurant.voiceAnnouncementEnabled !== false }
        : {}),
      categories: nextCategories,
      printers: nextPrinters,
      categoryRoutes: nextRoutes,
    })
    if (reason !== "ws-printers-updated") {
      triggerBackendPrinterSync(res.runtimeConfig, res.settings)
    }
    return res
  }

  const dispatchApi = async (rawMethod, rawPathname, body = {}) => {
    const method = String(rawMethod || "GET").toUpperCase()
    const pathname = String(rawPathname || "").split("?")[0]

    try {
      if (method === "GET" && pathname === "/api/state") {
        const saved = loadSettings()
        return {
          statusCode: 200,
          payload: {
            ok: true,
            platform: process.platform,
            status: agent.getStatus(),
            settings: getPublicSettings(saved),
            queue: store.getPendingJobs(),
            recentPrinted: store.getRecentPrinted(15),
            logs: getRecentLogs().slice(0, 40),
            audioEvents: getRecentUiAudioEvents(),
          },
        }
      }

      if (method === "GET" && pathname === "/api/discover-printers") {
        const extra =
          typeof electronPrinterProvider === "function"
            ? await Promise.resolve(electronPrinterProvider()).catch(() => [])
            : []
        const printers = await discoverSystemPrinters(extra)
        return { statusCode: 200, payload: { ok: true, printers } }
      }

      if ((method === "GET" || method === "POST") && pathname === "/api/discover-network-printers") {
        const result = await discoverNetworkPrinters({ port: Number(body?.port) || 9100 })
        return { statusCode: 200, payload: { ok: true, ...result } }
      }

      if (method === "POST" && pathname === "/api/login") {
        const current = loadSettings()
        const loginResult = await loginPrintAgent(body.username, body.password, current.backendUrl)
        const isSameRestaurant =
          !current.restaurantId || current.restaurantId === loginResult.restaurant?.id
        const basePrinters = isSameRestaurant ? current.printers : []
        const nextPrinters = mergePrintersWithBackend(basePrinters, loginResult.printers)
        const nextCategories = loginResult.categories || []
        const nextRoutes = seedDepartmentCategoryRoutes(
          isSameRestaurant ? current.categoryRoutes : {},
          nextCategories,
          nextPrinters,
        )
        const { settings, publicSettings, runtimeConfig } = applyAndReload({
          backendUrl: loginResult.backendUrl,
          authToken: loginResult.accessToken,
          refreshToken: loginResult.refreshToken,
          username: String(body.username || "").trim().toLowerCase(),
          restaurantId: loginResult.restaurant?.id || "",
          restaurantName: loginResult.restaurant?.name || "",
          ...(loginResult.restaurant?.voiceAnnouncementEnabled !== undefined
            ? { voiceAnnouncementEnabled: loginResult.restaurant.voiceAnnouncementEnabled !== false }
            : {}),
          categories: nextCategories,
          printers: nextPrinters,
          categoryRoutes: nextRoutes,
          printFooterLine: current.printFooterLine || loginResult.restaurant?.name || "",
        })
        void pushPrintersToBackend(runtimeConfig, settings)
        info("Corder Print Agent logged in", {
          username: publicSettings.username,
          restaurantName: publicSettings.restaurantName,
          categories: publicSettings.categories.length,
        })
        return { statusCode: 200, payload: { ok: true, settings: publicSettings } }
      }

      if (method === "POST" && pathname === "/api/logout") {
        const current = loadSettings()
        await logoutPrintAgent(buildRuntimeConfig(current)).catch(() => false)
        const { publicSettings } = applyAndReload({
          authToken: "",
          refreshToken: "",
          restaurantId: "",
          restaurantName: "",
        })
        info("Corder Print Agent logged out")
        return { statusCode: 200, payload: { ok: true, settings: publicSettings } }
      }

      if (method === "POST" && pathname === "/api/sync-context") {
        const { publicSettings } = await syncContextFromBackend()
        info("Branch categories and printers synchronized", {
          categories: publicSettings.categories.length,
          printers: publicSettings.printers.length,
        })
        return { statusCode: 200, payload: { ok: true, settings: publicSettings } }
      }

      if (method === "POST" && pathname === "/api/printers") {
        lastLocalPrinterMutationAt = Date.now()
        const current = loadSettings()
        const printers = [...current.printers]
        const entry = await buildSavedPrinterEntry(body, printers)
        const idx = printers.findIndex(
          (p) => p.id === entry.id || isSamePhysicalPrinter(p, entry),
        )
        if (idx >= 0) {
          entry.id = printers[idx].id
          printers[idx] = { ...printers[idx], ...entry, id: printers[idx].id }
        } else {
          printers.push(entry)
        }

        const hadNoPrinters = current.printers.length === 0
        const { settings, publicSettings, runtimeConfig } = applyAndReload({ printers })
        if (hadNoPrinters && typeof agent.clearPendingQueue === "function") {
          await agent.clearPendingQueue()
        }
        triggerBackendPrinterSync(runtimeConfig, settings)
        info("Printer saved", { id: entry.id, name: entry.name, mode: entry.mode })
        return { statusCode: 200, payload: { ok: true, printer: entry, settings: publicSettings } }
      }

      if (method === "DELETE" && pathname.startsWith("/api/printers/")) {
        lastLocalPrinterMutationAt = Date.now()
        const id = decodeURIComponent(pathname.slice("/api/printers/".length)).trim()
        const current = loadSettings()
        const printers = current.printers.filter((p) => p.id !== id)
        const categoryRoutes = { ...(current.categoryRoutes || {}) }
        for (const [cid, pid] of Object.entries(categoryRoutes)) {
          if (pid === id) delete categoryRoutes[cid]
        }
        const { settings, publicSettings, runtimeConfig } = applyAndReload({
          printers,
          categoryRoutes,
          defaultKitchenPrinterId:
            current.defaultKitchenPrinterId === id ? printers[0]?.id || "" : current.defaultKitchenPrinterId,
          receiptPrinterId: current.receiptPrinterId === id ? printers[0]?.id || "" : current.receiptPrinterId,
        })
        triggerBackendPrinterSync(runtimeConfig, settings)
        info("Printer removed", { id })
        return { statusCode: 200, payload: { ok: true, settings: publicSettings } }
      }

      if (method === "POST" && pathname === "/api/routes") {
        lastLocalPrinterMutationAt = Date.now()
        const current = loadSettings()
        const patch = {}
        for (const k of [
          "defaultKitchenPrinterId",
          "receiptPrinterId",
          "printFooterLine",
        ]) {
          if (body[k] !== undefined) patch[k] = String(body[k] || "").trim()
        }
        if (body.categoryRoutes && typeof body.categoryRoutes === "object") {
          patch.categoryRoutes = body.categoryRoutes
        }
        if (body.printUsbDrainMs !== undefined) patch.printUsbDrainMs = Number(body.printUsbDrainMs || 0)
        if (body.autoStartOnBoot !== undefined) {
          patch.autoStartOnBoot = Boolean(body.autoStartOnBoot)
          await applyAutoStartSetting(patch.autoStartOnBoot, electronAppRef)
        }
        if (body.voiceAnnouncementEnabled !== undefined) {
          patch.voiceAnnouncementEnabled = Boolean(body.voiceAnnouncementEnabled)
        }

        const { settings, publicSettings, runtimeConfig } = applyAndReload({ ...current, ...patch })
        triggerBackendPrinterSync(runtimeConfig, settings)
        if (body.voiceAnnouncementEnabled !== undefined) {
          void updateBackendVoiceSettings(runtimeConfig, patch.voiceAnnouncementEnabled)
        }
        return { statusCode: 200, payload: { ok: true, settings: publicSettings } }
      }

      if (method === "POST" && pathname === "/api/test-voice") {
        const result = announceWaiterCall({
          id: `local-test-${Date.now()}`,
          tableName: String(body?.tableName || "B12").trim() || "B12",
          sectionName: String(body?.sectionName || "Bahçe").trim() || "Bahçe",
          requestType: body?.requestType === "bill" ? "bill" : "waiter",
          isTest: true,
        })
        return {
          statusCode: 200,
          payload: { ok: true, text: result.text || "" },
        }
      }

      if (method === "POST" && pathname === "/api/test-network") {
        const result = await testTcpPrinterConnection(body.host, body.port, 2500)
        return { statusCode: 200, payload: result }
      }

      if (method === "POST" && pathname === "/api/test-print") {
        const settings = loadSettings()
        const runtimeConfig = buildRuntimeConfig(settings)
        const target =
          body.printer ||
          settings.printers.find((p) => p.id === body.printerId) ||
          runtimeConfig.defaultKitchenPrinter
        if (!target) {
          return { statusCode: 400, payload: { ok: false, error: "Test için yazıcı seçilmedi" } }
        }
        const asciiFallback =
          runtimeConfig.asciiFallback === true ||
          (runtimeConfig.asciiFallback !== false && target.mode !== "network")
        const ticket = buildTestTicket(target, {
          asciiFallback,
          feedLinesBeforeCut: Number(target.feedLinesBeforeCut ?? runtimeConfig.ticketFeedLinesBeforeCut ?? 3),
          charsPerLine: target.paperWidth === 58 ? 32 : 42,
        })
        await printBytes(runtimeConfig, ticket, { printer: target })
        info("Diagnostic test ticket printed", {
          printer: target.name,
          mode: target.mode,
          asciiFallback,
        })
        return { statusCode: 200, payload: { ok: true } }
      }

      if (method === "POST" && pathname === "/api/queue/flush") {
        await agent.flushQueue()
        return { statusCode: 200, payload: { ok: true, queue: store.getPendingJobs() } }
      }

      if (method === "POST" && pathname === "/api/queue/clear") {
        const runtimeConfig = buildRuntimeConfig(loadSettings())
        if (typeof agent.clearPendingQueue === "function") {
          await agent.clearPendingQueue()
        } else {
          store.clearQueue()
        }
        await purgeSystemPrintQueues(runtimeConfig)
        info("Pending print queue and OS spooler cleared via UI")
        return { statusCode: 200, payload: { ok: true, queue: [] } }
      }

      if (method === "POST" && pathname === "/api/logs/clear") {
        clearLogs()
        return { statusCode: 200, payload: { ok: true } }
      }

      return { statusCode: 404, payload: { ok: false, error: "API route not found" } }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      warn("UI API request failed", { pathname, error: message })
      return { statusCode: 500, payload: { ok: false, error: message } }
    }
  }

  const handleHttpApi = async (req, res, pathname) => {
    if (!isAllowedLoopbackRequest(req, sessionToken)) {
      sendJson(res, 403, { ok: false, error: "Forbidden local session" })
      return
    }
    const body =
      req.method === "POST" || req.method === "PUT" || req.method === "PATCH"
        ? await readJsonBody(req)
        : {}
    const { statusCode, payload } = await dispatchApi(req.method, pathname, body)
    sendJson(res, statusCode, payload)
  }

  const server = http.createServer(async (req, res) => {
    try {
      const parsed = new URL(req.url || "/", "http://127.0.0.1")
      if (parsed.pathname.startsWith("/api/")) await handleHttpApi(req, res, parsed.pathname)
      else serveStaticFile(req, res, parsed.pathname, sessionToken)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      warn("UI HTTP request failed", { url: req.url, error: message })
      sendJson(res, 500, { ok: false, error: message })
    }
  })

  return {
    server,
    sessionToken,
    dispatchApi,
    syncContextFromBackend,
    setElectronPrinterProvider(fn, electronApp = null) {
      electronPrinterProvider = fn
      if (electronApp) electronAppRef = electronApp
    },
    listen(preferredPort = 0) {
      return new Promise((resolve, reject) => {
        let port = Number(preferredPort) || 0
        const tryListen = (attemptsLeft) => {
          server.once("error", (err) => {
            if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
              port = port ? port + 1 : 0
              tryListen(attemptsLeft - 1)
            } else {
              reject(err)
            }
          })
          server.listen(port, "127.0.0.1", () => {
            const addr = server.address()
            const boundPort = typeof addr === "object" && addr ? addr.port : port
            resolve({ port: boundPort, url: `http://127.0.0.1:${boundPort}` })
          })
        }
        tryListen(10)
      })
    },
  }
}

module.exports = {
  createUiServer,
  mapBackendPrinters,
  mergePrintersWithBackend,
}
