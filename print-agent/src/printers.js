const net = require("net")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { execFile } = require("child_process")
const { info, warn } = require("./logger")
const { healNetworkPrinters } = require("./network-healer")
const { loadSettings, saveSettings, buildRuntimeConfig } = require("./settings-store")
const { pushPrintersToBackend } = require("./http-sync")
const { getWindowsBinary } = require("./windows-usb-direct")
const { WIN_RAW_SPOOL_PS } = require("./windows-raw-print")

const SAFE_PRINTER_NAME_RE = /^[\p{L}\p{N}_. \-()+@#/:]{1,128}$/u
const LINUX_USB_DEV_RE = /^\/dev\/(usb\/)?lp[0-9]$/
const SAFE_HOST_RE = /^[a-zA-Z0-9.-]{1,253}$/

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parsePort(p, fallback = 9100) {
  const n = parseInt(String(p || "").trim(), 10)
  return Number.isFinite(n) && n > 0 && n <= 65535 ? n : fallback
}

function assertSafePrinterName(name) {
  const clean = String(name || "").trim()
  if (!clean || !SAFE_PRINTER_NAME_RE.test(clean) || clean.includes("..")) {
    throw new Error(`Invalid or unsafe printer identifier: "${clean.slice(0, 40)}"`)
  }
  return clean
}

function sendRawTcp(host, port, bytes, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const cleanHost = String(host || "").trim()
    if (!cleanHost || !SAFE_HOST_RE.test(cleanHost)) {
      reject(new Error(`Invalid printer host: ${cleanHost}`))
      return
    }
    let settled = false
    const done = (err) => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve()
    }

    const client = net.createConnection({ host: cleanHost, port }, () => {
      try {
        client.setNoDelay(true)
      } catch {
        // noop
      }
      client.write(bytes, (err) => {
        if (err) {
          client.destroy()
          done(err)
          return
        }
        client.end()
      })
    })

    client.setTimeout(timeoutMs)
    client.on("timeout", () => {
      client.destroy()
      done(new Error(`TCP printer timeout (${cleanHost}:${port})`))
    })
    client.on("error", (err) => done(err))
    client.on("close", () => done(null))
  })
}

function runExecFile(binary, args, timeoutMs = 25000, extraEnv = null) {
  return new Promise((resolve, reject) => {
    execFile(
      getWindowsBinary(binary),
      args,
      {
        timeout: timeoutMs,
        windowsHide: true,
        shell: false,
        maxBuffer: 512 * 1024,
        ...(extraEnv ? { env: { ...process.env, ...extraEnv } } : {}),
      },
      (err, stdout, stderr) => {
        if (err) {
          const detail = stderr ? String(stderr).trim().slice(0, 300) : err.message
          reject(new Error(detail || err.message))
          return
        }
        resolve(String(stdout || ""))
      },
    )
  })
}

function hasLinuxUsbPrinterDevice() {
  for (const devPath of ["/dev/usb/lp0", "/dev/usb/lp1", "/dev/usb/lp2", "/dev/lp0", "/dev/lp1"]) {
    if (fs.existsSync(devPath)) return true
  }
  try {
    const base = "/sys/bus/usb/devices"
    if (fs.existsSync(base)) {
      for (const entry of fs.readdirSync(base)) {
        const clsFile = path.join(base, entry, "bInterfaceClass")
        if (fs.existsSync(clsFile) && fs.readFileSync(clsFile, "utf8").trim() === "07") {
          return true
        }
      }
    }
  } catch {
    // ignore sysfs read errors
  }
  return false
}

async function assertLinuxCupsPrinterReady(safeName) {
  if (process.platform !== "linux") return
  try {
    const out = await runExecFile("lpstat", ["-v", safeName], 3000)
    if (out.toLowerCase().includes("usb://") && !hasLinuxUsbPrinterDevice()) {
      await runExecFile("cancel", ["-a", safeName], 3000).catch(() => {})
      throw new Error(`USB yazıcı bilgisayara bağlı değil veya kapalı (${safeName})`)
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("USB yazıcı bilgisayara bağlı değil")) {
      throw err
    }
  }
}

async function purgeSystemPrintQueues(config = {}) {
  const names = new Set()
  if (config?.printerName) names.add(String(config.printerName).trim())
  if (Array.isArray(config?.printers)) {
    for (const p of config.printers) {
      if (p && p.mode !== "network") {
        const candidate = String(p.systemPrinterName || p.name || "").trim()
        if (candidate) names.add(candidate)
      }
    }
  }

  const safeNames = []
  for (const raw of names) {
    try {
      const clean = assertSafePrinterName(raw)
      if (!LINUX_USB_DEV_RE.test(clean)) safeNames.push(clean)
    } catch {
      // skip invalid identifier
    }
  }

  if (process.platform === "win32") {
    for (const safeName of safeNames) {
      const ps = `
        $p = $env:CORDER_PRINTER_NAME
        Get-PrintJob -PrinterName $p -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
      `.trim()
      await runExecFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", ps],
        8000,
        { CORDER_PRINTER_NAME: safeName },
      ).catch(() => {})
    }
    return
  }

  for (const safeName of safeNames) {
    await runExecFile("cancel", ["-a", safeName], 4000).catch(() => {})
    if (process.platform === "linux") {
      await runExecFile("cupsenable", [safeName], 3000).catch(() => {})
      await runExecFile("cupsaccept", [safeName], 3000).catch(() => {})
    }
  }
  await runExecFile("cancel", ["-a"], 4000).catch(() => {})
}

async function sendToWindowsPrinter(tempFile, safeName) {
  const stdout = await runExecFile(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", WIN_RAW_SPOOL_PS],
    25000,
    { CORDER_PRINTER_NAME: safeName, CORDER_PRINT_FILE: tempFile },
  )
  const match = String(stdout || "").match(/HEALED_PRINTER:(.+)/)
  return match && match[1] ? match[1].trim() : null
}

async function sendToSystemPrinter(bytes, printerName, usbDrainMs) {
  const safeName = assertSafePrinterName(printerName)

  if (process.platform === "linux" && LINUX_USB_DEV_RE.test(safeName)) {
    await fs.promises.writeFile(safeName, bytes)
    const drain = Math.max(0, Number(usbDrainMs) || 0)
    if (drain > 0) await sleep(drain)
    return
  }

  const tempFile = path.join(
    os.tmpdir(),
    `corder-job-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`,
  )
  fs.writeFileSync(tempFile, bytes, { mode: 0o600 })

  const started = Date.now()
  let healedPrinterName = null
  try {
    if (process.platform === "win32") {
      healedPrinterName = await sendToWindowsPrinter(tempFile, safeName)
    } else {
      if (process.platform === "linux") {
        await assertLinuxCupsPrinterReady(safeName)
        await runExecFile("cupsenable", [safeName], 3000).catch(() => {})
        await runExecFile("cupsaccept", [safeName], 3000).catch(() => {})
      }
      try {
        await runExecFile("lp", ["-d", safeName, "-o", "raw", tempFile])
      } catch (lpErr) {
        await runExecFile("lpr", ["-P", safeName, "-o", "raw", tempFile]).catch(() => {
          throw lpErr
        })
      }
    }
    const elapsed = Date.now() - started
    if (elapsed > 4000) {
      info(`System print completed slowly (${elapsed}ms)`, { printer: safeName })
    }
  } catch (err) {
    warn("System print failed", { printer: safeName, error: err.message })
    throw err
  } finally {
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
    } catch {
      // noop
    }
  }

  const drain = Math.max(0, Number(usbDrainMs) || 0)
  if (drain > 0) await sleep(drain)
  return healedPrinterName
}

async function printBytes(config, bytes, opts = {}) {
  const targetPrinter = opts.printer || null
  const networkTarget = opts.networkTarget ? String(opts.networkTarget).trim() : ""
  const explicitPrinterName = opts.printerName ? String(opts.printerName).trim() : ""

  if (targetPrinter?.mode === "network" || networkTarget) {
    let host = targetPrinter?.host || config.printerHost || "127.0.0.1"
    let port = parsePort(targetPrinter?.port, config.printerPort || 9100)
    if (networkTarget) {
      const parts = networkTarget.split(":")
      host = (parts[0] || "").trim() || host
      port = parsePort(parts[1], port)
    }
    try {
      await sendRawTcp(host, port, bytes)
    } catch (tcpErr) {
      const healRes = await healNetworkPrinters({
        forceScan: true,
        targetPrinterId: targetPrinter?.id || null,
        onHealed: async (savedSettings) => {
          const nextRuntime = buildRuntimeConfig(savedSettings)
          if (typeof config.onHealedRuntimeConfig === "function") {
            config.onHealedRuntimeConfig(nextRuntime)
          }
          void pushPrintersToBackend(nextRuntime, savedSettings)
        },
      }).catch(() => null)
      const healed = healRes?.healedPrinter
      if (healed?.host && healed.host !== host) {
        if (targetPrinter) targetPrinter.host = healed.host
        host = healed.host
        port = parsePort(healed.port, port)
        await sendRawTcp(host, port, bytes)
      } else {
        throw tcpErr
      }
    }
    const drain = Math.max(0, Number(config.printUsbDrainMs) || 0)
    if (drain > 0) await sleep(drain)
    return
  }

  if (targetPrinter?.mode === "system" || explicitPrinterName) {
    const sysName =
      targetPrinter?.systemPrinterName ||
      targetPrinter?.name ||
      explicitPrinterName ||
      config.printerName
    const healedName = await sendToSystemPrinter(bytes, sysName, config.printUsbDrainMs)
    if (healedName && healedName !== sysName) {
      info(`Windows printer queue self-healed: "${sysName}" -> "${healedName}"`)
      if (targetPrinter) targetPrinter.systemPrinterName = healedName
      try {
        const current = loadSettings()
        let updated = false
        const nextPrinters = (current.printers || []).map((p) => {
          if (
            (targetPrinter?.id && p.id === targetPrinter.id) ||
            p.systemPrinterName === sysName ||
            p.name === sysName
          ) {
            updated = true
            return { ...p, systemPrinterName: healedName }
          }
          return p
        })
        if (updated) {
          const saved = saveSettings({ printers: nextPrinters })
          const nextRuntime = buildRuntimeConfig(saved)
          if (typeof config.onHealedRuntimeConfig === "function") {
            config.onHealedRuntimeConfig(nextRuntime)
          }
          void pushPrintersToBackend(nextRuntime, saved)
        }
      } catch {
        // ignore persistence error after successful print
      }
    }
    return
  }

  if (config.printerMode === "network_raw") {
    const host = config.printerHost || "127.0.0.1"
    const port = parsePort(config.printerPort, 9100)
    await sendRawTcp(host, port, bytes)
    return
  }

  await sendToSystemPrinter(bytes, config.printerName, config.printUsbDrainMs)
}

function createPrinter(initialConfig) {
  let currentConfig = initialConfig
  return {
    print: (bytes, opts) => printBytes(currentConfig, bytes, opts || {}),
    updateConfig: (nextConfig) => {
      currentConfig = nextConfig
    },
  }
}

module.exports = { createPrinter, printBytes, purgeSystemPrintQueues }
