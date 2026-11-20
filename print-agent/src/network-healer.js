const crypto = require("crypto")
const {
  discoverNetworkPrinters,
  testTcpPrinterConnection,
  readArpMacMap,
} = require("./printer-discovery")
const { loadSettings, saveSettings, buildRuntimeConfig } = require("./settings-store")
const { pushPrintersToBackend } = require("./http-sync")
const { info, warn } = require("./logger")

const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/

function normalizeMacAddress(raw) {
  if (!raw) return ""
  const cleaned = String(raw)
    .trim()
    .toUpperCase()
    .replace(/-/g, ":")
  if (cleaned === "00:00:00:00:00:00" || !MAC_RE.test(cleaned)) {
    return ""
  }
  return cleaned
}

let healInFlightPromise = null

async function runHealNetworkPrinters({
  forceScan = false,
  targetPrinterId = null,
  onHealed = null,
} = {}) {
  const settings = loadSettings()
  const printers = Array.isArray(settings.printers)
    ? settings.printers.map((p) => ({ ...p, mac: normalizeMacAddress(p.mac) }))
    : []
  const netPrinters = printers.filter(
    (p) => p.mode === "network" && p.host && p.host !== "127.0.0.1",
  )
  if (!netPrinters.length) {
    return { changed: false, printers, healedPrinter: null }
  }

  const preArpMap = await readArpMacMap()
  let changed = false
  const unreachable = []

  for (const np of netPrinters) {
    if (targetPrinterId && np.id !== targetPrinterId && !forceScan) {
      const cachedMac = normalizeMacAddress(preArpMap.get(np.host))
      if (!np.mac && cachedMac) {
        np.mac = cachedMac
        changed = true
      }
      continue
    }

    const probe = await testTcpPrinterConnection(np.host, np.port || 9100, 1400)
    if (probe.ok) {
      let mac = np.mac || normalizeMacAddress(preArpMap.get(np.host))
      if (!mac) {
        const postProbeArp = await readArpMacMap()
        mac = normalizeMacAddress(postProbeArp.get(np.host))
      }
      if (mac && mac !== np.mac) {
        np.mac = mac
        changed = true
        info("Ağ yazıcısının donanım (MAC) adresi otomatik kaydedildi", {
          printer: np.name,
          host: np.host,
          mac,
        })
      }
    } else {
      unreachable.push(np)
    }
  }

  let healedTarget = null
  if (unreachable.length > 0 || forceScan) {
    const portsToScan = [
      ...new Set(
        (unreachable.length > 0 ? unreachable : netPrinters).map(
          (p) => Number(p.port) || 9100,
        ),
      ),
    ]

    const discoveredByPort = new Map()
    for (const port of portsToScan) {
      const scanRes = await discoverNetworkPrinters({ port, timeoutMs: 340 })
      discoveredByPort.set(port, scanRes.printers || [])
    }

    for (const np of netPrinters) {
      const port = Number(np.port) || 9100
      const discoveredList = discoveredByPort.get(port) || []
      if (!discoveredList.length) continue

      if (!np.mac) {
        const sameHostHit = discoveredList.find((d) => d.host === np.host && d.mac)
        if (sameHostHit) {
          np.mac = normalizeMacAddress(sameHostHit.mac)
          if (np.mac) changed = true
        }
      }
    }

    const assignedHosts = new Set(
      netPrinters
        .filter((p) => !unreachable.includes(p))
        .map((p) => `${p.host}:${Number(p.port) || 9100}`),
    )
    const assignedMacs = new Set(
      netPrinters.map((p) => normalizeMacAddress(p.mac)).filter(Boolean),
    )

    for (const np of unreachable) {
      const port = Number(np.port) || 9100
      const discoveredList = discoveredByPort.get(port) || []
      if (!discoveredList.length) continue

      let match = null
      if (np.mac) {
        match = discoveredList.find(
          (d) => normalizeMacAddress(d.mac) === np.mac,
        )
      }

      if (!match) {
        const unassignedCandidates = discoveredList.filter((d) => {
          const hostKey = `${d.host}:${Number(d.port) || 9100}`
          const dMac = normalizeMacAddress(d.mac)
          if (assignedHosts.has(hostKey)) return false
          if (dMac && assignedMacs.has(dMac)) return false
          return true
        })
        const unreachableWithoutMacOnPort = unreachable.filter(
          (u) => (Number(u.port) || 9100) === port,
        )
        if (
          unassignedCandidates.length === 1 &&
          unreachableWithoutMacOnPort.length === 1
        ) {
          match = unassignedCandidates[0]
        }
      }

      if (match && match.host) {
        const oldHost = np.host
        const nextMac = normalizeMacAddress(match.mac) || np.mac
        if (match.host !== oldHost || nextMac !== np.mac) {
          np.host = match.host
          if (nextMac) np.mac = nextMac
          changed = true
          assignedHosts.add(`${np.host}:${port}`)
          if (np.mac) assignedMacs.add(np.mac)
          if ( !targetPrinterId || np.id === targetPrinterId) {
            healedTarget = np
          }
          info("Modem/DHCP IP değişimi tespit edildi; yazıcı IP adresi otomatik güncellendi", {
            printer: np.name,
            oldHost: `${oldHost}:${port}`,
            newHost: `${np.host}:${port}`,
            mac: np.mac || "-",
          })
        }
      }
    }
  }

  if (changed) {
    const saved = saveSettings({ printers })
    if (typeof onHealed === "function") {
      try {
        await onHealed(saved)
      } catch (err) {
        warn("Failed to propagate healed printer config", {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  if (!healedTarget && targetPrinterId) {
    healedTarget = printers.find((p) => p.id === targetPrinterId) || null
  }

  return { changed, printers, healedPrinter: healedTarget }
}

function healNetworkPrinters(opts = {}) {
  if (healInFlightPromise) {
    return healInFlightPromise
  }
  healInFlightPromise = runHealNetworkPrinters(opts).finally(() => {
    healInFlightPromise = null
  })
  return healInFlightPromise
}

function startNetworkPrinterWatchdog({ agent, intervalMs = 45000 } = {}) {
  const onHealed = async (savedSettings) => {
    const nextRuntime = buildRuntimeConfig(savedSettings)
    if (agent && typeof agent.reloadConfig === "function") {
      agent.reloadConfig(nextRuntime)
    }
    void pushPrintersToBackend(nextRuntime, savedSettings)
  }

  const initialTimer = setTimeout(() => {
    void healNetworkPrinters({ forceScan: false, onHealed }).catch(() => {})
  }, 3500)
  if (typeof initialTimer.unref === "function") initialTimer.unref()

  const timer = setInterval(() => {
    void healNetworkPrinters({ forceScan: false, onHealed }).catch(() => {})
  }, intervalMs)
  if (typeof timer.unref === "function") timer.unref()

  return {
    onHealed,
    stop: () => {
      clearTimeout(initialTimer)
      clearInterval(timer)
    },
  }
}

async function buildSavedPrinterEntry(body = {}, existingPrinters = []) {
  const incomingId = body.id ? String(body.id).trim() : crypto.randomUUID()
  const isNet = body.mode === "network"
  const existingEntry = existingPrinters.find((p) => p.id === incomingId)
  let resolvedMac = isNet
    ? normalizeMacAddress(body.mac || existingEntry?.mac || "")
    : ""
  if (isNet && !resolvedMac && body.host) {
    const arpMap = await readArpMacMap()
    resolvedMac = normalizeMacAddress(arpMap.get(String(body.host).trim()))
  }
  return {
    id: incomingId,
    name: String(body.name || body.systemPrinterName || body.host || "Printer").trim(),
    type: String(body.type || "thermal").trim(),
    mode: isNet ? "network" : "system",
    systemPrinterName: isNet ? "" : String(body.systemPrinterName || "").trim(),
    host: String(body.host || "127.0.0.1").trim(),
    port: Number(body.port) || 9100,
    mac: resolvedMac,
    department: body.department ? String(body.department).trim() : null,
    paperWidth: Number(body.paperWidth) === 58 ? 58 : 80,
    feedLinesBeforeCut: Number(body.feedLinesBeforeCut ?? 6),
    autoCut: body.autoCut !== false,
  }
}

module.exports = {
  normalizeMacAddress,
  healNetworkPrinters,
  startNetworkPrinterWatchdog,
  buildSavedPrinterEntry,
}
