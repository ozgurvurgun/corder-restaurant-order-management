const fs = require("fs")
const os = require("os")
const path = require("path")
const { execFile } = require("child_process")
const { info, warn } = require("./logger")

const APP_ROOT = path.resolve(__dirname, "..")
const MAIN_ENTRY = path.join(APP_ROOT, "electron", "main.js")
const WIN_REG_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"
const WIN_REG_NAME = "CorderPrintAgent"

function getLinuxAutostartFile() {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
  return path.join(configHome, "autostart", "corder-print-agent.desktop")
}

function resolveLaunchCommand() {
  const electronBin = path.join(
    APP_ROOT,
    "node_modules",
    "electron",
    "dist",
    process.platform === "win32" ? "electron.exe" : "electron",
  )
  if (fs.existsSync(electronBin)) {
    const args = process.platform === "linux" ? ["--no-sandbox", MAIN_ENTRY] : [MAIN_ENTRY]
    return { binary: electronBin, args }
  }
  return { binary: process.execPath, args: [MAIN_ENTRY] }
}

function configureLinuxAutostart(enabled) {
  const desktopFile = getLinuxAutostartFile()
  try {
    if (!enabled) {
      if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile)
      return true
    }
    const { binary, args } = resolveLaunchCommand()
    const execLine = [binary, ...args].map((part) => `"${part}"`).join(" ")
    const content = [
      "[Desktop Entry]",
      "Type=Application",
      "Version=1.0",
      "Name=Corder Print Agent",
      "Comment=Corder Print Agent automatic thermal ticket service",
      `Exec=${execLine}`,
      `Path=${APP_ROOT}`,
      "Terminal=false",
      "StartupNotify=false",
      "X-GNOME-Autostart-enabled=true",
    ].join("\n")
    fs.mkdirSync(path.dirname(desktopFile), { recursive: true })
    fs.writeFileSync(desktopFile, `${content}\n`, { encoding: "utf8", mode: 0o644 })
    return true
  } catch (err) {
    warn("Linux autostart configuration skipped", { error: err.message })
    return false
  }
}

function configureWindowsRegistryAutostart(enabled) {
  return new Promise((resolve) => {
    const { binary, args } = resolveLaunchCommand()
    const commandValue = `"${binary}" ${args.map((a) => `"${a}"`).join(" ")}`
    const regArgs = enabled
      ? ["add", WIN_REG_KEY, "/v", WIN_REG_NAME, "/t", "REG_SZ", "/d", commandValue, "/f"]
      : ["delete", WIN_REG_KEY, "/v", WIN_REG_NAME, "/f"]

    execFile("reg.exe", regArgs, { windowsHide: true, shell: false, timeout: 5000 }, (err) => {
      if (err && enabled) {
        warn("Windows startup registry update failed", { error: err.message })
        resolve(false)
        return
      }
      resolve(true)
    })
  })
}

async function applyAutoStartSetting(enabled, electronApp = null) {
  const shouldEnable = enabled !== false
  try {
    if (electronApp && typeof electronApp.setLoginItemSettings === "function" && (process.platform === "win32" || process.platform === "darwin")) {
      const { binary, args } = resolveLaunchCommand()
      electronApp.setLoginItemSettings({
        openAtLogin: shouldEnable,
        path: binary,
        args,
      })
    }
    if (process.platform === "win32") {
      await configureWindowsRegistryAutostart(shouldEnable)
    } else if (process.platform === "linux") {
      configureLinuxAutostart(shouldEnable)
    }
    info(`Auto-start on boot ${shouldEnable ? "enabled" : "disabled"}`, { platform: process.platform })
    return true
  } catch (err) {
    warn("Failed to apply auto-start setting", { error: err.message })
    return false
  }
}

module.exports = { applyAutoStartSetting }
