const path = require("path")
const { spawn } = require("child_process")
const electronModule = require("electron")

if (typeof electronModule === "string") {
  const cleanEnv = { ...process.env }
  delete cleanEnv.ELECTRON_RUN_AS_NODE
  const args = [__filename, ...process.argv.slice(2)]
  if (process.platform === "linux" && !args.includes("--no-sandbox")) {
    args.unshift("--no-sandbox")
  }
  const child = spawn(electronModule, args, {
    stdio: "inherit",
    env: cleanEnv,
  })
  child.on("exit", (code) => process.exit(code ?? 0))
  return
}

const { app, BrowserWindow, shell } = electronModule
const { startPrintAgentApp } = require("../src/index")
const { info, error } = require("../src/logger")

let mainWindow = null
let agentApp = null

async function createMainWindow(uiUrl, uiServer) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "Corder Print Agent",
    autoHideMenuBar: true,
    backgroundColor: "#f4f6f9",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (uiServer && typeof uiServer.setElectronPrinterProvider === "function") {
    uiServer.setElectronPrinterProvider(async () => {
      if (!mainWindow || mainWindow.isDestroyed()) return []
      if (typeof mainWindow.webContents.getPrintersAsync === "function") {
        return mainWindow.webContents.getPrintersAsync()
      }
      return []
    })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  await mainWindow.loadURL(uiUrl)

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

const singleInstanceLock = app.requestSingleInstanceLock()
if (!singleInstanceLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    try {
      agentApp = await startPrintAgentApp({ openBrowser: false })
      await createMainWindow(agentApp.uiUrl, agentApp.uiServer)
    } catch (err) {
      error("Failed to launch Electron Print Agent", {
        error: err instanceof Error ? err.message : String(err),
      })
      app.quit()
    }
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      if (agentApp) agentApp.stop()
      app.quit()
    }
  })

  app.on("before-quit", () => {
    info("Shutting down Electron Print Agent")
    if (agentApp) agentApp.stop()
  })
}
