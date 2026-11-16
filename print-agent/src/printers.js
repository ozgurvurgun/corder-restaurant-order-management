const net = require("net")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { exec } = require("child_process")
const { info, warn } = require("./logger")

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parsePort(p, fallback) {
  const n = parseInt(String(p || "").trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function sendRawTcp(host, port, bytes) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host, port }, () => {
      try {
        client.setNoDelay(true)
      } catch {
        // noop
      }
      client.write(bytes, (err) => {
        if (err) {
          client.destroy()
          reject(err)
          return
        }
        client.end()
      })
    })

    client.on("error", reject)
    client.on("close", () => resolve())
  })
}

function resolveSystemPrintCommand(configCommand) {
  const raw = String(configCommand || "").trim()
  if (process.platform === "win32") {
    return (
      raw ||
      'powershell -NoProfile -ExecutionPolicy Bypass -File "./scripts/send-raw-printer.ps1" -PrinterName "{PRINTER_NAME}" -FilePath "{FILE}"'
    )
  }
  if (!raw || raw.toLowerCase().includes("powershell")) {
    return 'lp -d "{PRINTER_NAME}" -o raw "{FILE}"'
  }
  return raw
}

function execCommand(command, bytes, printerName, usbDrainMs) {
  return new Promise((resolve, reject) => {
    const resolvedBase = resolveSystemPrintCommand(command)
    if (!resolvedBase) {
      reject(new Error("PRINT_COMMAND is empty"))
      return
    }

    const tempFile = path.join(
      os.tmpdir(),
      `corder-print-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`,
    )
    fs.writeFileSync(tempFile, bytes)

    const safePrinterName = String(printerName || "").replaceAll('"', "")
    const resolvedCommand = resolvedBase
      .replaceAll("{FILE}", tempFile)
      .replaceAll("{PRINTER_NAME}", safePrinterName)

    const started = Date.now()
    exec(
      resolvedCommand,
      {
        timeout: 120000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const ms = Date.now() - started
        try {
          fs.unlinkSync(tempFile)
        } catch {
          // noop
        }

        if (error) {
          const errTail = stderr ? String(stderr).trim().slice(0, 800) : ""
          warn(`Print command failed after ${ms}ms`, {
            error: error.message,
            stderr: errTail || undefined,
          })
          reject(error)
          return
        }
        if (ms > 5000) {
          info(`Print command slow: ${ms}ms`, { printerName: safePrinterName })
        }
        const drain = Math.max(0, Number(usbDrainMs) || 0)
        if (drain > 0) {
          sleep(drain).then(resolve)
        } else {
          resolve()
        }
      },
    )
  })
}

/**
 * Supports mixed-mode per-job printer targets (system/USB or network raw TCP).
 */
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
    await sendRawTcp(host, port, bytes)
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
    await execCommand(config.printCommand, bytes, sysName, config.printUsbDrainMs)
    return
  }

  if (config.printerMode === "network_raw") {
    const host = config.printerHost || "127.0.0.1"
    const port = parsePort(config.printerPort, 9100)
    await sendRawTcp(host, port, bytes)
    const drain = Math.max(0, Number(config.printUsbDrainMs) || 0)
    if (drain > 0) await sleep(drain)
    return
  }

  if (config.printerMode === "command") {
    await execCommand(config.printCommand, bytes, config.printerName, config.printUsbDrainMs)
    return
  }

  throw new Error(`Unsupported PRINTER_MODE: ${config.printerMode}`)
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

module.exports = { createPrinter, printBytes }
