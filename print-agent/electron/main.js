const path = require("path")
const { app, BrowserWindow, shell } = require("electron")
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
