const os = require("os")
const { exec } = require("child_process")
const { loadSettings, buildRuntimeConfig } = require("./settings-store")
const { JobStore } = require("./job-store")
const { createPrinter } = require("./printers")
const { startAgent } = require("./agent")
const { createUiServer } = require("./ui-server")
const { httpBaseUrl } = require("./http-sync")
const { info, error } = require("./logger")

function openDesktopBrowser(url) {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`
  exec(cmd, { windowsHide: true }, () => {})
}

async function startPrintAgentApp(options = {}) {
  const settings = loadSettings()
  const config = buildRuntimeConfig(settings)
  const store = new JobStore(config.queueFile)
  const printer = createPrinter(config)
  const agent = startAgent({ config, store, printer })
  const uiServer = createUiServer({ store, agent })

  const preferredPort = Number(options.port || settings.uiPort || 4190)
  const { port, url: uiUrl } = await uiServer.listen(preferredPort)

  const pkg = require("../package.json")
  info("Corder Print Agent & Control Center started", {
    version: pkg.version,
    uiUrl,
    agentId: config.agentId,
    restaurantId: config.restaurantId,
    restaurantName: config.restaurantName || "(not synced)",
    printersCount: config.printers.length,
    queueSize: store.getQueueSize(),
    backendHttpBase: httpBaseUrl(config) || "(unset)",
  })

  if (os.platform() === "win32" && config.printerMode === "command") {
    info("Windows Raw Printer helper ready (scripts/send-raw-printer.ps1)")
  }

  const shouldOpenBrowser =
    options.openBrowser ??
    (process.argv.includes("--open") || process.env.OPEN_BROWSER === "1")

  if (shouldOpenBrowser) {
    openDesktopBrowser(uiUrl)
  }

  return {
    port,
    uiUrl,
    store,
    printer,
    agent,
    uiServer,
    stop() {
      agent.stop()
      uiServer.server.close()
    },
  }
}

if (require.main === module) {
  startPrintAgentApp()
    .then((appInstance) => {
      process.on("SIGINT", () => {
        info("Shutting down print agent (SIGINT)")
        appInstance.stop()
        process.exit(0)
      })
      process.on("SIGTERM", () => {
        info("Shutting down print agent (SIGTERM)")
        appInstance.stop()
        process.exit(0)
      })
    })
    .catch((e) => {
      error("Print agent failed to start", {
        error: e instanceof Error ? e.message : String(e),
      })
      process.exit(1)
    })
}

module.exports = { startPrintAgentApp }
