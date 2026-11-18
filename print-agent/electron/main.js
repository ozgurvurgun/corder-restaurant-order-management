process.noDeprecation = true

const path = require("path")
const { spawn } = require("child_process")
const electronModule = require("electron")

const LINUX_SAFE_FLAGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu-sandbox",
  "--no-zygote",
]

if (typeof electronModule === "string") {
  const cleanEnv = { ...process.env, CORDER_LINUX_REEXEC: "1" }
  delete cleanEnv.ELECTRON_RUN_AS_NODE
  const userArgs = process.argv.slice(2)
  const extraFlags =
    process.platform === "linux"
      ? LINUX_SAFE_FLAGS.filter((f) => !userArgs.includes(f))
      : []
  const args = [...extraFlags, __filename, ...userArgs]
  const child = spawn(electronModule, args, {
    stdio: "inherit",
    env: cleanEnv,
  })
  child.on("exit", (code) => process.exit(code ?? 0))
  return
}

if (
  process.platform === "linux" &&
  process.env.CORDER_LINUX_REEXEC !== "1" &&
  (!process.argv.includes("--no-sandbox") || !process.argv.includes("--disable-dev-shm-usage"))
) {
  const existingArgs = process.argv.slice(1)
  const missingFlags = LINUX_SAFE_FLAGS.filter((f) => !existingArgs.includes(f))
  const child = spawn(process.execPath, [...missingFlags, ...existingArgs], {
    stdio: "inherit",
    env: { ...process.env, CORDER_LINUX_REEXEC: "1" },
  })
  child.on("exit", (code) => process.exit(code ?? 0))
  return
}

const { app, BrowserWindow, ipcMain } = electronModule
const { getAppDataDir } = require("../src/config")
const { startPrintAgentApp } = require("../src/index")
const { info, error } = require("../src/logger")

app.setName("corder-print-agent")
app.setPath("userData", path.join(getAppDataDir(), "desktop-profile"))

if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox")
  app.commandLine.appendSwitch("disable-setuid-sandbox")
  app.commandLine.appendSwitch("disable-dev-shm-usage")
  app.commandLine.appendSwitch("disable-gpu-sandbox")
  app.commandLine.appendSwitch("no-zygote")
}

let mainWindow = null
let agentApp = null

async function createMainWindow(uiServer) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "Corder Print Agent",
    icon: path.join(__dirname, "..", "public", "corder-logo.png"),
    autoHideMenuBar: true,
    backgroundColor: "#f4f6f9",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  if (uiServer && typeof uiServer.setElectronPrinterProvider === "function") {
    uiServer.setElectronPrinterProvider(async () => {
      if (!mainWindow || mainWindow.isDestroyed()) return []
      if (typeof mainWindow.webContents.getPrintersAsync === "function") {
        return mainWindow.webContents.getPrintersAsync()
      }
      return []
    }, app)
  }

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" }
  })

  const indexHtmlPath = path.join(__dirname, "..", "public", "index.html")
  await mainWindow.loadFile(indexHtmlPath)

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
      agentApp = await startPrintAgentApp({
        enableHttpServer: false,
        openBrowser: false,
        electronApp: app,
      })

      ipcMain.handle("corder:api", async (_event, req) => {
        const res = await agentApp.uiServer.dispatchApi(
          req?.method,
          req?.pathname,
          req?.body || {},
        )
        return res.payload
      })

      await createMainWindow(agentApp.uiServer)
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
