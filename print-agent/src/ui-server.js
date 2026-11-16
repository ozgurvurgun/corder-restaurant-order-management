const http = require("http")
const fs = require("fs")
const path = require("path")
const { loadSettings, saveSettings, buildRuntimeConfig } = require("./settings-store")
const { discoverSystemPrinters, testTcpPrinterConnection } = require("./printer-discovery")
const { fetchAgentContext } = require("./http-sync")
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on("data", (chunk) => {
      total += chunk.length
      if (total > 1024 * 1024) {
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

function serveStaticFile(res, urlPath) {
  const relPath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "")
  const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "")
  const fullPath = path.join(PUBLIC_DIR, safePath)
  if (!fullPath.startsWith(PUBLIC_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    sendJson(res, 404, { ok: false, error: "Not found" })
    return
  }
  const ext = path.extname(fullPath).toLowerCase()
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  })
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

  const applyAndReload = (partial) => {
    const saved = saveSettings(partial)
    const runtimeConfig = buildRuntimeConfig(saved)
    agent.reloadConfig(runtimeConfig)
    return { settings: saved, runtimeConfig }
  }

  const handleApi = async (req, res, pathname) => {
    if (req.method === "GET" && pathname === "/api/state") {
      sendJson(res, 200, {
        ok: true,
        platform: process.platform,
        status: agent.getStatus(),
        settings: loadSettings(),
        queue: store.getPendingJobs(),
        recentPrinted: store.getRecentPrinted(30),
        logs: getRecentLogs(),
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

    if (req.method === "POST" && pathname === "/api/connect") {
      const body = await readJsonBody(req)
      const current = loadSettings()
      const backendUrl = String(body.backendUrl ?? current.backendUrl ?? "").trim()
      const agentToken = String(body.agentToken ?? current.agentToken ?? "").trim()
      const ctx = await fetchAgentContext(backendUrl, agentToken)
      const nextPrinters = current.printers.length > 0 ? current.printers : mapBackendPrinters(ctx.printers)
      const { settings } = applyAndReload({
        backendUrl,
        agentToken,
        restaurantId: ctx.restaurant?.id || current.restaurantId || "*",
        restaurantName: ctx.restaurant?.name || current.restaurantName || "",
        categories: ctx.categories || [],
        printers: nextPrinters,
        printFooterLine: current.printFooterLine || ctx.restaurant?.name || "",
      })
      info("Connected to Corder branch context", {
        restaurantName: settings.restaurantName,
        categories: settings.categories.length,
      })
      sendJson(res, 200, { ok: true, context: ctx, settings })
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

      const { settings } = applyAndReload({ printers })
      info("Printer saved", { id: entry.id, name: entry.name, mode: entry.mode })
      sendJson(res, 200, { ok: true, printer: entry, settings })
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
      const { settings } = applyAndReload({
        printers,
        categoryRoutes,
        defaultKitchenPrinterId:
          current.defaultKitchenPrinterId === id ? printers[0]?.id || "" : current.defaultKitchenPrinterId,
        receiptPrinterId: current.receiptPrinterId === id ? printers[0]?.id || "" : current.receiptPrinterId,
      })
      info("Printer removed", { id })
      sendJson(res, 200, { ok: true, settings })
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
        "backendUrl",
        "agentToken",
      ]) {
        if (body[k] !== undefined) patch[k] = String(body[k] || "").trim()
      }
      if (body.categoryRoutes && typeof body.categoryRoutes === "object") {
        patch.categoryRoutes = body.categoryRoutes
      }
      if (body.printUsbDrainMs !== undefined) patch.printUsbDrainMs = Number(body.printUsbDrainMs || 0)

      const { settings } = applyAndReload({ ...current, ...patch })
      sendJson(res, 200, { ok: true, settings })
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
        sendJson(res, 400, { ok: false, error: "No printer selected for test print" })
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
      else serveStaticFile(res, parsed.pathname)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      warn("UI API request failed", { url: req.url, error: message })
      sendJson(res, 500, { ok: false, error: message })
    }
  })

  return {
    server,
    setElectronPrinterProvider(fn) {
      electronPrinterProvider = fn
    },
    listen(preferredPort = 4190) {
      return new Promise((resolve, reject) => {
        let port = Number(preferredPort) || 4190
        const tryListen = (attemptsLeft) => {
          server.once("error", (err) => {
            if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
              port += 1
              tryListen(attemptsLeft - 1)
            } else {
              reject(err)
            }
          })
          server.listen(port, "127.0.0.1", () => resolve({ port, url: `http://127.0.0.1:${port}` }))
        }
        tryListen(10)
      })
    },
  }
}

module.exports = { createUiServer }
