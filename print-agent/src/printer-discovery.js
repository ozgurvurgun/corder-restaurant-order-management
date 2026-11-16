const net = require("net")
const { exec } = require("child_process")

function execText(cmd, timeoutMs = 8000) {
  return new Promise((resolve) => {
    exec(
      cmd,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          resolve("")
          return
        }
        resolve(String(stdout || "").trim())
      },
    )
  })
}

async function discoverWindowsPrinters() {
  const psCmd =
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json -Compress"'
  const raw = await execText(psCmd, 10000)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list
      .filter((item) => item && item.Name)
      .map((item) => ({
        name: String(item.Name).trim(),
        driverName: String(item.DriverName || "Windows Spooler").trim(),
        portName: String(item.PortName || "").trim(),
        status: String(item.PrinterStatus ?? "Ready"),
        isDefault: false,
        source: "windows",
      }))
  } catch {
    return []
  }
}

async function discoverCupsPrinters() {
  const [lpstatA, lpstatD] = await Promise.all([
    execText("lpstat -a", 5000),
    execText("lpstat -d", 5000),
  ])
  let defaultPrinter = ""
  const defMatch = lpstatD.match(/:\s*(\S+)/)
  if (defMatch) {
    defaultPrinter = defMatch[1].trim()
  }
  if (!lpstatA) return []
  const lines = lpstatA.split(/\r?\n/).filter(Boolean)
  const printers = []
  for (const line of lines) {
    const firstToken = line.trim().split(/\s+/)[0]
    if (!firstToken || firstToken.includes(":")) continue
    printers.push({
      name: firstToken,
      driverName: "CUPS",
      portName: "local",
      status: "ready",
      isDefault: firstToken === defaultPrinter,
      source: "cups",
    })
  }
  return printers
}

async function discoverSystemPrinters(extraPrinters = []) {
  const discovered =
    process.platform === "win32"
      ? await discoverWindowsPrinters()
      : await discoverCupsPrinters()

  const mergedMap = new Map()
  for (const p of discovered) {
    if (p && p.name) {
      mergedMap.set(p.name, p)
    }
  }
  for (const extra of extraPrinters || []) {
    const name = String(extra?.name || extra?.displayName || "").trim()
    if (!name || mergedMap.has(name)) continue
    mergedMap.set(name, {
      name,
      driverName: String(extra?.driverName || extra?.description || "System").trim(),
      portName: "system",
      status: String(extra?.status ?? "ready"),
      isDefault: Boolean(extra?.isDefault),
      source: "electron",
    })
  }
  return [...mergedMap.values()]
}

function testTcpPrinterConnection(host, port = 9100, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const cleanHost = String(host || "").trim()
    const cleanPort = Number(port) || 9100
    if (!cleanHost) {
      resolve({ ok: false, error: "Host cannot be empty" })
      return
    }

    const startedAt = Date.now()
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const socket = net.createConnection({ host: cleanHost, port: cleanPort })
    socket.setTimeout(timeoutMs)

    socket.on("connect", () => {
      const latencyMs = Date.now() - startedAt
      socket.destroy()
      finish({ ok: true, latencyMs })
    })

    socket.on("timeout", () => {
      socket.destroy()
      finish({ ok: false, error: `Connection timed out (${timeoutMs}ms)` })
    })

    socket.on("error", (err) => {
      socket.destroy()
      finish({ ok: false, error: err.message || "TCP connection failed" })
    })
  })
}

module.exports = {
  discoverSystemPrinters,
  testTcpPrinterConnection,
}
