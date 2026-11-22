const fs = require("fs")
const os = require("os")
const path = require("path")
const { info, warn } = require("./logger")

const APP_ROOT = path.resolve(__dirname, "..")
const MAIN_ENTRY = path.join(APP_ROOT, "electron", "main.js")

function getLinuxAutostartFile() {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
  return path.join(configHome, "autostart", "corder-print-agent.desktop")
}

function getMacLaunchAgentFile() {
  return path.join(os.homedir(), "Library", "LaunchAgents", "com.corder.print-agent.plist")
}

function resolveAppRoot(electronApp = null) {
  if (electronApp && electronApp.isPackaged) {
    return path.dirname(process.execPath)
  }
  return APP_ROOT
}

function resolveLaunchCommand(electronApp = null) {
  if (electronApp && electronApp.isPackaged) {
    const args = process.platform === "linux" ? ["--no-sandbox"] : []
    return { binary: process.execPath, args, cwd: resolveAppRoot(electronApp) }
  }
  const electronBin = path.join(
    APP_ROOT,
    "node_modules",
    "electron",
    "dist",
    process.platform === "win32" ? "electron.exe" : "electron",
  )
  if (fs.existsSync(electronBin)) {
    const args = process.platform === "linux" ? ["--no-sandbox", MAIN_ENTRY] : [MAIN_ENTRY]
    return { binary: electronBin, args, cwd: APP_ROOT }
  }
  return { binary: process.execPath, args: [MAIN_ENTRY], cwd: APP_ROOT }
}

function configureLinuxAutostart(enabled, electronApp = null) {
  const desktopFile = getLinuxAutostartFile()
  try {
    if (!enabled) {
      if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile)
      return true
    }
    const { binary, args, cwd } = resolveLaunchCommand(electronApp)
    const execLine = [binary, ...args].map((part) => `"${part}"`).join(" ")
    const content = [
      "[Desktop Entry]",
      "Type=Application",
      "Version=1.0",
      "Name=Corder Print Agent",
      "Comment=Corder Print Agent automatic thermal ticket service",
      `Exec=${execLine}`,
      `Path=${cwd || APP_ROOT}`,
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

function configureMacAutostart(enabled, electronApp = null) {
  const plistFile = getMacLaunchAgentFile()
  try {
    if (!enabled) {
      if (fs.existsSync(plistFile)) fs.unlinkSync(plistFile)
      return true
    }
    const { binary, args, cwd } = resolveLaunchCommand(electronApp)
    const escXml = (s) =>
      String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
    const programArgs = [binary, ...args].map((a) => `    <string>${escXml(a)}</string>`).join("\n")
    const content = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      "<dict>",
      "  <key>Label</key>",
      "  <string>com.corder.print-agent</string>",
      "  <key>ProgramArguments</key>",
      "  <array>",
      programArgs,
      "  </array>",
      "  <key>WorkingDirectory</key>",
      `  <string>${escXml(cwd || APP_ROOT)}</string>`,
      "  <key>RunAtLoad</key>",
      "  <true/>",
      "</dict>",
      "</plist>",
    ].join("\n")
    fs.mkdirSync(path.dirname(plistFile), { recursive: true })
    fs.writeFileSync(plistFile, `${content}\n`, { encoding: "utf8", mode: 0o644 })
    return true
  } catch (err) {
    warn("macOS autostart configuration skipped", { error: err.message })
    return false
  }
}

async function applyAutoStartSetting(enabled, electronApp = null) {
  const shouldEnable = enabled !== false
  try {
    if (
      electronApp &&
      typeof electronApp.setLoginItemSettings === "function" &&
      (process.platform === "win32" || process.platform === "darwin")
    ) {
      const { binary, args } = resolveLaunchCommand(electronApp)
      electronApp.setLoginItemSettings({
        openAtLogin: shouldEnable,
        path: binary,
        args,
      })
    } else if (process.platform === "linux") {
      configureLinuxAutostart(shouldEnable, electronApp)
    } else if (process.platform === "darwin" && !electronApp) {
      configureMacAutostart(shouldEnable, null)
    }
    info(`Auto-start on boot ${shouldEnable ? "enabled" : "disabled"}`, { platform: process.platform })
    return true
  } catch (err) {
    warn("Failed to apply auto-start setting", { error: err.message })
    return false
  }
}

module.exports = { applyAutoStartSetting }
