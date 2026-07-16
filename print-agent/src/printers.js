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

function execCommand(command, bytes, printerName, usbDrainMs) {
  return new Promise((resolve, reject) => {
    if (!command.trim()) {
      reject(new Error("PRINT_COMMAND is empty"))
      return
    }

    const tempFile = path.join(os.tmpdir(), `corder-print-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`)
    fs.writeFileSync(tempFile, bytes)

    const safePrinterName = (printerName || "").replaceAll("\"", "")
    const resolvedCommand = command
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
 * @param {object} config
 * @param {Buffer|Uint8Array} bytes
 * @param {{ printerName?: string; networkTarget?: string }} opts networkTarget = "host:port"
 */
async function printBytes(config, bytes, opts = {}) {
  const printerName = opts.printerName ?? config.printerName
  const networkTarget = opts.networkTarget?.trim()

  if (config.printerMode === "network_raw") {
    let host = config.printerHost
    let port = config.printerPort
    if (networkTarget) {
      const parts = networkTarget.split(":")
      host = (parts[0] || "").trim() || host
      port = parsePort(parts[1], config.printerPort)
    }
    await sendRawTcp(host, port, bytes)
    const drain = Math.max(0, Number(config.printUsbDrainMs) || 0)
    if (drain > 0) await sleep(drain)
    return
  }

  if (config.printerMode === "command") {
    await execCommand(config.printCommand, bytes, printerName, config.printUsbDrainMs)
    return
  }

  throw new Error(`Unsupported PRINTER_MODE: ${config.printerMode}`)
}

function createPrinter(config) {
  return {
    print: (bytes, opts) => printBytes(config, bytes, opts || {}),
  }
}

module.exports = { createPrinter, printBytes }
