const fs = require("fs")
const net = require("net")
const { execFile } = require("child_process")

const SAFE_HOST_RE = /^[a-zA-Z0-9.-]{1,253}$/

function execFileText(binary, args, timeoutMs = 6000) {
  return new Promise((resolve) => {
    execFile(
      binary,
      args,
      { timeout: timeoutMs, windowsHide: true, shell: false, maxBuffer: 512 * 1024 },
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
  const raw = await execFileText(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json -Compress",
    ],
    8000,
  )
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list
      .filter((item) => item && item.Name)
      .map((item) => ({
        name: String(item.Name).trim(),
        driverName: String(item.DriverName || "Windows Spooler").trim(),
        portName: String(item.PortName || "USB").trim(),
        status: String(item.PrinterStatus ?? "Ready"),
        isDefault: false,
        source: "windows",
      }))
  } catch {
    return []
  }
}

async function discoverCupsAndLinuxUsbPrinters() {
  const [lpstatA, lpstatD, lpstatV] = await Promise.all([
    execFileText("lpstat", ["-a"], 4000),
    execFileText("lpstat", ["-d"], 4000),
    execFileText("lpstat", ["-v"], 4000),
  ])

  let defaultPrinter = ""
  const defMatch = lpstatD.match(/:\s*(\S+)/)
  if (defMatch) defaultPrinter = defMatch[1].trim()

  const deviceUriMap = new Map()
  for (const line of lpstatV.split(/\r?\n/).filter(Boolean)) {
    const m = line.match(/\sfor\s+([^\s:]+):\s*(.+)$/i)
    if (m) deviceUriMap.set(m[1].trim(), m[2].trim())
  }

  const printers = []
  for (const line of lpstatA.split(/\r?\n/).filter(Boolean)) {
    const firstToken = line.trim().split(/\s+/)[0]
    if (!firstToken || firstToken.includes(":")) continue
    printers.push({
      name: firstToken,
      driverName: "CUPS (Linux/macOS)",
      portName: deviceUriMap.get(firstToken) || "CUPS Queue",
      status: "ready",
      isDefault: firstToken === defaultPrinter,
      source: "cups",
    })
  }

  // Same physical USB printer often appears both as a CUPS queue (usb://…)
  // and as /dev/usb/lpN. Prefer CUPS when present to avoid duplicate rows and
  // EACCES noise when the agent user cannot open the raw device node.
  const cupsHasUsb = printers.some((p) =>
    /^usb:/i.test(String(p.portName || "").trim()),
  )

  if (process.platform === "linux" && !cupsHasUsb) {
    for (let i = 0; i <= 9; i++) {
      const devPath = `/dev/usb/lp${i}`
      if (!fs.existsSync(devPath)) continue
      try {
        fs.accessSync(devPath, fs.constants.W_OK)
      } catch {
        continue
      }
      printers.push({
        name: devPath,
        driverName: "Linux Doğrudan USB Termal",
        portName: devPath,
        status: "ready",
        isDefault: printers.length === 0,
        source: "linux-usb",
      })
    }
  }

  return printers
}

async function discoverSystemPrinters(extraPrinters = []) {
  const discovered =
    process.platform === "win32"
      ? await discoverWindowsPrinters()
      : await discoverCupsAndLinuxUsbPrinters()

  const mergedMap = new Map()
  for (const p of discovered) {
    if (p && p.name) mergedMap.set(p.name, p)
  }
  for (const extra of extraPrinters || []) {
    const name = String(extra?.name || extra?.displayName || "").trim()
    if (!name || mergedMap.has(name)) continue
    mergedMap.set(name, {
      name,
      driverName: String(extra?.driverName || extra?.description || "Sistem Yazıcısı").trim(),
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
    if (!cleanHost || !SAFE_HOST_RE.test(cleanHost)) {
      resolve({ ok: false, error: "Geçersiz IP veya sunucu adresi" })
      return
    }
    if (cleanPort < 1 || cleanPort > 65535) {
      resolve({ ok: false, error: "Geçersiz port numarası (1-65535)" })
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
      finish({ ok: false, error: `Bağlantı zaman aşımına uğradı (${timeoutMs}ms)` })
    })

    socket.on("error", (err) => {
      socket.destroy()
      finish({ ok: false, error: err.message || "TCP bağlantısı kurulamadı" })
    })
  })
}

module.exports = {
  discoverSystemPrinters,
  testTcpPrinterConnection,
}
