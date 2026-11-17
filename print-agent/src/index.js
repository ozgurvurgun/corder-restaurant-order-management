const { execFile } = require("child_process")
const { loadSettings, saveSettings, buildRuntimeConfig } = require("./settings-store")
const { resolveEmbeddedBackendUrl } = require("./config")
const { JobStore } = require("./job-store")
const { createPrinter } = require("./printers")
const { startAgent } = require("./agent")
const { createUiServer } = require("./ui-server")
const { applyAutoStartSetting } = require("./autostart")
const { info, error } = require("./logger")

function openDesktopBrowser(url) {
  if (process.platform === "win32") {
    execFile("cmd.exe", ["/d", "/s", "/c", "start", "", url], { windowsHide: true }, () => {})
  } else if (process.platform === "darwin") {
    execFile("open", [url], () => {})
  } else {
    execFile("xdg-open", [url], () => {})
  }
}

async function startPrintAgentApp(options = {}) {
  const existingSettings = loadSettings()
  const detectedBackendUrl = await resolveEmbeddedBackendUrl(true, existingSettings.backendUrl)
  const settings = saveSettings({ backendUrl: detectedBackendUrl })
  await applyAutoStartSetting(settings.autoStartOnBoot, options.electronApp || null)
  const config = buildRuntimeConfig(settings)
  const store = new JobStore(config.queueFile)
  const printer = createPrinter(config)
  let uiServer = null
  const agent = startAgent({
    config,
    store,
    printer,
    onContextInvalidated: () => uiServer?.syncContextFromBackend?.(),
  })
  uiServer = createUiServer({ store, agent })

  const enableHttpServer = options.enableHttpServer !== false
  let port = null
  let uiUrl = "ipc://desktop"

  if (enableHttpServer) {
    const preferredPort = options.port !== undefined ? Number(options.port) : 4190
    const bound = await uiServer.listen(preferredPort)
    port = bound.port
    uiUrl = bound.url
  }

  const pkg = require("../package.json")
  info("Corder Print Agent & Control Center started", {
    version: pkg.version,
    platform: process.platform,
    mode: enableHttpServer ? uiUrl : "desktop-ipc",
    restaurantName: config.restaurantName || "(giriş bekleniyor)",
    printersCount: config.printers.length,
    queueSize: store.getQueueSize(),
  })

  const shouldOpenBrowser = enableHttpServer && (options.openBrowser ?? process.argv.includes("--open"))
  if (shouldOpenBrowser) {
    openDesktopBrowser(uiUrl)
  }

  return {
    port,
    uiUrl,
    sessionToken: uiServer.sessionToken,
    store,
    printer,
    agent,
    uiServer,
    stop() {
      agent.stop()
      if (enableHttpServer && uiServer.server.listening) {
        uiServer.server.close()
      }
    },
  }
}

if (require.main === module) {
  startPrintAgentApp({ enableHttpServer: true })
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
