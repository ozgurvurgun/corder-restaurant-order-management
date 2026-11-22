process.noDeprecation = true

const path = require("path")
const { spawn, execFileSync } = require("child_process")
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
const { loadSettings } = require("../src/settings-store")
const { applyAutoStartSetting } = require("../src/autostart")
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
    title: "Corder Print Agent v1.2.0",
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

function terminateOlderRunningInstances() {
  try {
    if (process.platform === "win32") {
      const selfPid = process.pid
      const parentPid = process.ppid || 0
      const ps = `
        $self = ${selfPid}
        $parent = ${parentPid}
        $procs = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
          $_.Name -like 'Corder*Print*Agent*' -or $_.Name -eq 'corder-print-agent.exe'
        })
        $keep = New-Object System.Collections.Generic.HashSet[int]
        [void]$keep.Add($self)
        if ($parent -gt 0) { [void]$keep.Add($parent) }
        foreach ($p in $procs) {
          if ($p.ProcessId -eq $self -and $p.ParentProcessId -gt 0) {
            [void]$keep.Add([int]$p.ParentProcessId)
          }
          if ($p.ParentProcessId -eq $self -or ($parent -gt 0 -and $p.ParentProcessId -eq $parent)) {
            [void]$keep.Add([int]$p.ProcessId)
          }
        }
        foreach ($p in $procs) {
          if (-not $keep.Contains([int]$p.ProcessId)) {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
          }
        }
        Start-Sleep -Milliseconds 600
      `.trim()
      execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
        timeout: 8000,
        windowsHide: true,
      })
    }
  } catch {
    // ignore process termination errors
  }
}

let singleInstanceLock = app.requestSingleInstanceLock()
if (!singleInstanceLock && process.platform === "win32" && !process.argv.includes("--replaced-old")) {
  terminateOlderRunningInstances()
  singleInstanceLock = app.requestSingleInstanceLock()
  if (!singleInstanceLock) {
    app.relaunch({ args: [...process.argv.slice(1), "--replaced-old"] })
    app.exit(0)
  }
}

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
      const initialSettings = loadSettings()
      await applyAutoStartSetting(initialSettings.autoStartOnBoot !== false, app).catch(() => {})
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
