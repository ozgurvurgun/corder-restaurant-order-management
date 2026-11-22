const fs = require("fs")
const net = require("net")
const os = require("os")
const { execFile } = require("child_process")

const SAFE_HOST_RE = /^[a-zA-Z0-9.-]{1,253}$/
const VIRTUAL_IFACE_RE = /^(lo|docker|br-|veth|virbr|tun|tap|wg|tailscale|zt|vmnet|vboxnet)/i

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
      "Get-Printer -ErrorAction SilentlyContinue | Where-Object { [string]$_.PrinterStatus -notmatch 'PendingDeletion|Deleting' } | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json -Compress",
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
  // On Windows inside Electron, webContents.getPrintersAsync() provides native
  // Win32 EnumPrintersW data without spawning PowerShell; bit 0x4 is
  // PRINTER_STATUS_PENDING_DELETION.
  if (process.platform === "win32" && Array.isArray(extraPrinters) && extraPrinters.length > 0) {
    const winPrinters = []
    for (const extra of extraPrinters) {
      const name = String(extra?.name || extra?.displayName || "").trim()
      if (!name) continue
      const statusNum = Number(extra?.status)
      if (Number.isFinite(statusNum) && (statusNum & 0x00000004) !== 0) {
        continue
      }
      if (/pending|deleting/i.test(String(extra?.status || ""))) {
        continue
      }
      winPrinters.push({
        name,
        driverName: String(extra?.driverName || extra?.description || "Windows Spooler").trim(),
        portName: String(extra?.options?.["printer-location"] || "USB / Spooler").trim(),
        status: "Ready",
        isDefault: Boolean(extra?.isDefault),
        source: "windows",
      })
    }
    if (winPrinters.length > 0) return winPrinters
  }

  const discovered =
    process.platform === "win32"
      ? await discoverWindowsPrinters()
      : await discoverCupsAndLinuxUsbPrinters()

  const mergedMap = new Map()
  for (const p of discovered) {
    if (p && p.name) mergedMap.set(p.name, p)
  }
  if (process.platform !== "win32" || discovered.length === 0) {
    for (const extra of extraPrinters || []) {
      const name = String(extra?.name || extra?.displayName || "").trim()
      if (!name || mergedMap.has(name)) continue
      const statusNum = Number(extra?.status)
      if (Number.isFinite(statusNum) && (statusNum & 0x00000004) !== 0) continue
      mergedMap.set(name, {
        name,
        driverName: String(extra?.driverName || extra?.description || "Sistem Yazıcısı").trim(),
        portName: "system",
        status: String(extra?.status ?? "ready"),
        isDefault: Boolean(extra?.isDefault),
        source: "electron",
      })
    }
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

function isPrivateIpv4(ip) {
  const parts = String(ip || "").split(".").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false
  }
  if (parts[0] === 10) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  return false
}

function getLocalPrivateSubnets() {
  const ifaces = os.networkInterfaces()
  const subnets = []
  const seenPrefixes = new Set()

  for (const [ifaceName, addrs] of Object.entries(ifaces || {})) {
    if (VIRTUAL_IFACE_RE.test(ifaceName)) continue
    for (const addr of addrs || []) {
      const family = String(addr.family || "")
      if ((family !== "IPv4" && family !== "4") || addr.internal) continue
      if (!isPrivateIpv4(addr.address)) continue
      const octets = addr.address.split(".")
      const prefix = `${octets[0]}.${octets[1]}.${octets[2]}`
      if (seenPrefixes.has(prefix)) continue
      seenPrefixes.add(prefix)
      subnets.push({
        prefix,
        subnet: `${prefix}.0/24`,
        selfIp: addr.address,
        interfaceName: ifaceName,
      })
    }
  }
  return subnets.slice(0, 3)
}

async function readArpMacMap() {
  const macMap = new Map()
  try {
    if (process.platform === "linux" && fs.existsSync("/proc/net/arp")) {
      const raw = fs.readFileSync("/proc/net/arp", "utf8")
      for (const line of raw.split(/\r?\n/).slice(1)) {
        const cols = line.trim().split(/\s+/)
        if (cols.length >= 4 && cols[3] && cols[3] !== "00:00:00:00:00:00") {
          macMap.set(cols[0], cols[3].toUpperCase())
        }
      }
      return macMap
    }
    const arpOut = await execFileText("arp", ["-a"], 2500)
    for (const line of arpOut.split(/\r?\n/)) {
      const ipMatch = line.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/)
      const macMatch = line.match(/\b([0-9a-f]{1,2}[:-]){5}[0-9a-f]{1,2}\b/i)
      if (ipMatch && macMatch && !/^00[:-]00[:-]00/i.test(macMatch[0])) {
        macMap.set(ipMatch[1], macMatch[0].replace(/-/g, ":").toUpperCase())
      }
    }
  } catch {
    // ignore ARP read errors
  }
  return macMap
}

async function discoverNetworkPrinters(opts = {}) {
  const cleanPort = Number(opts.port) > 0 && Number(opts.port) <= 65535 ? Number(opts.port) : 9100
  const timeoutMs = Number(opts.timeoutMs) > 100 ? Number(opts.timeoutMs) : 360
  const subnets = getLocalPrivateSubnets()
  if (!subnets.length) {
    return { printers: [], scannedSubnets: [], port: cleanPort }
  }

  const arpMap = await readArpMacMap()
  const candidates = []
  for (const sub of subnets) {
    for (let hostNum = 1; hostNum <= 254; hostNum++) {
      const ip = `${sub.prefix}.${hostNum}`
      if (ip === sub.selfIp) continue
      candidates.push({
        ip,
        subnet: sub.subnet,
        interfaceName: sub.interfaceName,
        inArp: arpMap.has(ip),
      })
    }
  }

  candidates.sort((a, b) => Number(b.inArp) - Number(a.inArp))

  const found = []
  const concurrency = 64
  let cursor = 0

  const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, async () => {
    while (cursor < candidates.length) {
      const item = candidates[cursor++]
      const res = await testTcpPrinterConnection(item.ip, cleanPort, timeoutMs)
      if (res.ok) {
        found.push({
          host: item.ip,
          port: cleanPort,
          latencyMs: res.latencyMs,
          mac: arpMap.get(item.ip) || "",
          subnet: item.subnet,
          interfaceName: item.interfaceName,
        })
      }
    }
  })

  await Promise.all(workers)

  if (found.some((f) => !f.mac)) {
    const postArpMap = await readArpMacMap()
    for (const f of found) {
      if (!f.mac && postArpMap.has(f.host)) {
        f.mac = postArpMap.get(f.host) || ""
      }
    }
  }

  found.sort((a, b) => {
    const pa = a.host.split(".").map(Number)
    const pb = b.host.split(".").map(Number)
    for (let i = 0; i < 4; i++) {
      if (pa[i] !== pb[i]) return pa[i] - pb[i]
    }
    return 0
  })

  return {
    printers: found,
    scannedSubnets: subnets.map((s) => `${s.subnet} (${s.interfaceName})`),
    port: cleanPort,
  }
}

module.exports = {
  discoverSystemPrinters,
  discoverNetworkPrinters,
  testTcpPrinterConnection,
  readArpMacMap,
}
