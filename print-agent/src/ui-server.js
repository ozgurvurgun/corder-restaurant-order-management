const http = require("http")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { loadSettings, saveSettings, getPublicSettings, buildRuntimeConfig } = require("./settings-store")
const { discoverSystemPrinters, testTcpPrinterConnection } = require("./printer-discovery")
const { loginPrintAgent, fetchAgentContext } = require("./http-sync")
const { buildTestTicket } = require("./escpos")
const { printBytes } = require("./printers")
const { info, warn, getRecentLogs, clearLogs } = require("./logger")

const PUBLIC_DIR = path.resolve(__dirname, "..", "public")
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
  "Cache-Control": "no-store",
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
  })
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on("data", (chunk) => {
      total += chunk.length
      if (total > 256 * 1024) {
        reject(new Error("Payload too large"))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim()
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error("Invalid JSON body"))
      }
    })
    req.on("error", reject)
  })
}

function parseCookies(cookieHeader) {
  const out = {}
  for (const part of String(cookieHeader || "").split(";")) {
    const idx = part.indexOf("=")
    if (idx > 0) {
      out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim()
    }
  }
  return out
}

function isAllowedLoopbackRequest(req, sessionToken) {
  const host = String(req.headers.host || "").toLowerCase()
  if (!host.startsWith("127.0.0.1:") && !host.startsWith("localhost:")) {
    return false
  }
  const headerToken = String(req.headers["x-corder-session"] || "").trim()
  if (headerToken && headerToken === sessionToken) return true

  const cookies = parseCookies(req.headers.cookie)
  if (cookies.corder_pa_session !== sessionToken) return false

  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = String(req.headers.origin || "").toLowerCase()
    if (!origin.startsWith("http://127.0.0.1:") && !origin.startsWith("http://localhost:")) {
      return false
    }
  }
  return true
}

function serveStaticFile(res, urlPath, sessionToken) {
  const relPath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "")
  const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "")
  const fullPath = path.join(PUBLIC_DIR, safePath)
  if (!fullPath.startsWith(PUBLIC_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    sendJson(res, 404, { ok: false, error: "Not found" })
    return
  }
  const ext = path.extname(fullPath).toLowerCase()
  const headers = {
    ...SECURITY_HEADERS,
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
  }
  if (relPath === "index.html") {
    headers["Set-Cookie"] = `corder_pa_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict`
  }
  res.writeHead(200, headers)
  fs.createReadStream(fullPath).pipe(res)
}

function mapBackendPrinters(backendPrinters = []) {
  return backendPrinters
    .filter((p) => p && p.name)
    .map((p, idx) => ({
      id: p.id || `p-cloud-${idx + 1}`,
      name: String(p.name).trim(),
      mode: p.connection === "ethernet" || p.ipAddress ? "network" : "system",
      systemPrinterName: p.connection === "ethernet" ? "" : String(p.name).trim(),
      host: String(p.ipAddress || "127.0.0.1").trim(),
      port: Number(p.port) || 9100,
      paperWidth: Number(p.paperWidth) === 58 ? 58 : 80,
      feedLinesBeforeCut: 6,
    }))
}

function createUiServer({ store, agent }) {
  let electronPrinterProvider = null
  const sessionToken = crypto.randomBytes(32).toString("hex")

  const applyAndReload = (partial) => {
    const saved = saveSettings(partial)
    const runtimeConfig = buildRuntimeConfig(saved)
    agent.reloadConfig(runtimeConfig)
    return { settings: saved, publicSettings: getPublicSettings(saved), runtimeConfig }
  }

  const handleApi = async (req, res, pathname) => {
    if (!isAllowedLoopbackRequest(req, sessionToken)) {
      sendJson(res, 403, { ok: false, error: "Forbidden local session" })
      return
    }

    if (req.method === "GET" && pathname === "/api/state") {
      const saved = loadSettings()
      sendJson(res, 200, {
        ok: true,
        platform: process.platform,
        status: agent.getStatus(),
        settings: getPublicSettings(saved),
        queue: store.getPendingJobs(),
        recentPrinted: store.getRecentPrinted(15),
        logs: getRecentLogs().slice(0, 40),
      })
      return
    }

    if (req.method === "GET" && pathname === "/api/discover-printers") {
      const extra =
        typeof electronPrinterProvider === "function"
          ? await Promise.resolve(electronPrinterProvider()).catch(() => [])
          : []
      const printers = await discoverSystemPrinters(extra)
      sendJson(res, 200, { ok: true, printers })
      return
    }

    if (req.method === "POST" && pathname === "/api/login") {
      const body = await readJsonBody(req)
      const current = loadSettings()
      const loginResult = await loginPrintAgent(body.username, body.password)
      const nextPrinters =
        current.printers.length > 0 ? current.printers : mapBackendPrinters(loginResult.printers)
      const { publicSettings } = applyAndReload({
        backendUrl: loginResult.backendUrl,
        authToken: loginResult.accessToken,
        username: String(body.username || "").trim().toLowerCase(),
        restaurantId: loginResult.restaurant?.id || "",
        restaurantName: loginResult.restaurant?.name || "",
        categories: loginResult.categories || [],
        printers: nextPrinters,
        printFooterLine: current.printFooterLine || loginResult.restaurant?.name || "",
      })
      info("Print Agent authenticated with branch", {
        username: publicSettings.username,
        restaurantName: publicSettings.restaurantName,
        categories: publicSettings.categories.length,
      })
      sendJson(res, 200, { ok: true, settings: publicSettings })
      return
    }

    if (req.method === "POST" && pathname === "/api/logout") {
      const { publicSettings } = applyAndReload({
        authToken: "",
        restaurantId: "",
        restaurantName: "",
      })
      info("Print Agent logged out")
      sendJson(res, 200, { ok: true, settings: publicSettings })
      return
    }

    if (req.method === "POST" && pathname === "/api/sync-context") {
      const current = loadSettings()
      const runtimeConfig = buildRuntimeConfig(current)
      const ctx = await fetchAgentContext(runtimeConfig)
      const nextPrinters = current.printers.length > 0 ? current.printers : mapBackendPrinters(ctx.printers)
      const { publicSettings } = applyAndReload({
        restaurantId: ctx.restaurant?.id || current.restaurantId,
        restaurantName: ctx.restaurant?.name || current.restaurantName,
        categories: ctx.categories || [],
        printers: nextPrinters,
      })
      info("Branch categories synchronized", { categories: publicSettings.categories.length })
      sendJson(res, 200, { ok: true, settings: publicSettings })
      return
    }

    if (req.method === "POST" && pathname === "/api/printers") {
      const body = await readJsonBody(req)
      const current = loadSettings()
      const printers = [...current.printers]
      const incomingId = body.id ? String(body.id).trim() : `p-${Date.now().toString(36)}`
      const entry = {
        id: incomingId,
        name: String(body.name || body.systemPrinterName || body.host || "Printer").trim(),
        mode: body.mode === "network" ? "network" : "system",
        systemPrinterName: String(body.systemPrinterName || "").trim(),
        host: String(body.host || "127.0.0.1").trim(),
        port: Number(body.port) || 9100,
        paperWidth: Number(body.paperWidth) === 58 ? 58 : 80,
        feedLinesBeforeCut: Number(body.feedLinesBeforeCut ?? 6),
      }
      const idx = printers.findIndex((p) => p.id === incomingId)
      if (idx >= 0) printers[idx] = entry
      else printers.push(entry)

      const { publicSettings } = applyAndReload({ printers })
      info("Printer saved", { id: entry.id, name: entry.name, mode: entry.mode })
      sendJson(res, 200, { ok: true, printer: entry, settings: publicSettings })
      return
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/printers/")) {
      const id = decodeURIComponent(pathname.slice("/api/printers/".length)).trim()
      const current = loadSettings()
      const printers = current.printers.filter((p) => p.id !== id)
      const categoryRoutes = { ...(current.categoryRoutes || {}) }
      for (const [cid, pid] of Object.entries(categoryRoutes)) {
        if (pid === id) delete categoryRoutes[cid]
      }
      const { publicSettings } = applyAndReload({
        printers,
        categoryRoutes,
        defaultKitchenPrinterId:
          current.defaultKitchenPrinterId === id ? printers[0]?.id || "" : current.defaultKitchenPrinterId,
        receiptPrinterId: current.receiptPrinterId === id ? printers[0]?.id || "" : current.receiptPrinterId,
      })
      info("Printer removed", { id })
      sendJson(res, 200, { ok: true, settings: publicSettings })
      return
    }

    if (req.method === "POST" && pathname === "/api/routes") {
      const body = await readJsonBody(req)
      const current = loadSettings()
      const patch = {}
      for (const k of [
        "defaultKitchenPrinterId",
        "receiptPrinterId",
        "printFooterLine",
        "printTicketStamp",
      ]) {
        if (body[k] !== undefined) patch[k] = String(body[k] || "").trim()
      }
      if (body.categoryRoutes && typeof body.categoryRoutes === "object") {
        patch.categoryRoutes = body.categoryRoutes
      }
      if (body.printUsbDrainMs !== undefined) patch.printUsbDrainMs = Number(body.printUsbDrainMs || 0)

      const { publicSettings } = applyAndReload({ ...current, ...patch })
      sendJson(res, 200, { ok: true, settings: publicSettings })
      return
    }

    if (req.method === "POST" && pathname === "/api/test-network") {
      const body = await readJsonBody(req)
      sendJson(res, 200, await testTcpPrinterConnection(body.host, body.port, 2500))
      return
    }

    if (req.method === "POST" && pathname === "/api/test-print") {
      const body = await readJsonBody(req)
      const settings = loadSettings()
      const runtimeConfig = buildRuntimeConfig(settings)
      const target =
        body.printer ||
        settings.printers.find((p) => p.id === body.printerId) ||
        runtimeConfig.defaultKitchenPrinter
      if (!target) {
        sendJson(res, 400, { ok: false, error: "Test için yazıcı seçilmedi" })
        return
      }
      await printBytes(runtimeConfig, buildTestTicket(target), { printer: target })
      info("Diagnostic test ticket printed", { printer: target.name, mode: target.mode })
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === "POST" && pathname === "/api/queue/flush") {
      await agent.flushQueue()
      sendJson(res, 200, { ok: true, queue: store.getPendingJobs() })
      return
    }

    if (req.method === "POST" && pathname === "/api/queue/clear") {
      store.clearQueue()
      info("Pending print queue cleared via UI")
      sendJson(res, 200, { ok: true, queue: [] })
      return
    }

    if (req.method === "POST" && pathname === "/api/logs/clear") {
      clearLogs()
      sendJson(res, 200, { ok: true })
      return
    }

    sendJson(res, 404, { ok: false, error: "API route not found" })
  }

  const server = http.createServer(async (req, res) => {
    try {
      const parsed = new URL(req.url || "/", "http://127.0.0.1")
      if (parsed.pathname.startsWith("/api/")) await handleApi(req, res, parsed.pathname)
      else serveStaticFile(res, parsed.pathname, sessionToken)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      warn("UI API request failed", { url: req.url, error: message })
      sendJson(res, 500, { ok: false, error: message })
    }
  })

  return {
    server,
    sessionToken,
    setElectronPrinterProvider(fn) {
      electronPrinterProvider = fn
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

module.exports = { createUiServer }
