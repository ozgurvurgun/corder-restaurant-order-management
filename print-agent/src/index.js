const path = require("path")
const os = require("os")
const { config, validateConfig } = require("./config")
const { JobStore } = require("./job-store")
const { createPrinter } = require("./printers")
const { startAgent } = require("./agent")
const { httpBaseUrl } = require("./http-sync")
const { info, error } = require("./logger")

try {
  validateConfig()
  const store = new JobStore(config.queueFile)
  const printer = createPrinter(config)
  const agent = startAgent({ config, store, printer })

  const pkg = require("../package.json")
  info("Print agent started", {
    version: pkg.version,
    escposPath: path.resolve(__dirname, "escpos.js"),
    agentId: config.agentId,
    restaurantId: config.restaurantId,
    queueSize: store.getQueueSize(),
    printerMode: config.printerMode,
    backendHttpBase: httpBaseUrl(config) || "(unset)",
    kitchenSyncIntervalMs: config.kitchenSyncIntervalMs,
    categoryPrinterRoutes: Object.keys(config.categoryPrinterRoutes || {}).length,
    categoryNetworkRoutes: Object.keys(config.categoryNetworkRoutes || {}).length,
    managementReceiptPrinter: config.managementReceiptPrinter || "(use PRINTER_NAME)",
  })

  if (os.platform() === "win32" && config.printerMode === "command") {
    info(
      "USB+Winspool: if tickets only appear after unplugging, prefer Ethernet with PRINTER_MODE=network_raw when possible. 'Print error' + very slow prints: clear the spooler queue (Settings → Printers → CompartPrinter → queue) or restart Print Spooler; after the first print, compilation is cached via scripts\\RawPrinterHelper.dll.",
    )
  }

  setImmediate(() => {
    void agent.flushQueue()
  })

  process.on("SIGINT", () => {
    info("Shutting down print agent (SIGINT)")
    agent.stop()
    process.exit(0)
  })

  process.on("SIGTERM", () => {
    info("Shutting down print agent (SIGTERM)")
    agent.stop()
    process.exit(0)
  })
} catch (e) {
  error("Print agent failed to start", { error: e instanceof Error ? e.message : String(e) })
  process.exit(1)
}
