const { info, warn } = require("./logger")

function normalizeHttpOrigin(rawUrl) {
  const clean = String(rawUrl || "").trim()
  if (!clean) return ""
  try {
    const u = new URL(clean)
    u.protocol = u.protocol === "wss:" ? "https:" : u.protocol === "ws:" ? "http:" : u.protocol
    return u.origin
  } catch {
    return clean.replace(/\/$/, "")
  }
}

function httpBaseUrl(config) {
  const explicit = (config?.backendHttpUrl || "").trim()
  if (explicit) return normalizeHttpOrigin(explicit)
  return normalizeHttpOrigin(config?.backendWsUrl || "")
}

async function patchWithRetry(config, url, logLabel, meta) {
  let lastErr = ""
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${config.agentToken}`,
          "Content-Type": "application/json",
        },
      })
      if (res.ok) {
        if (i > 0) info(`${logLabel} ack succeeded after retry`, { ...meta, attempt: i + 1 })
        return true
      }
      lastErr = await res.text()
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
    await new Promise((r) => setTimeout(r, 350 * (i + 1)))
  }
  warn(`${logLabel} ack failed after retries`, { ...meta, lastErr: lastErr?.slice?.(0, 200) })
  return false
}

async function ackKitchenPrinted(config, orderId) {
  const base = httpBaseUrl(config)
  if (!base || !orderId || !config.agentToken) return false
  const url = `${base}/restaurant/print-agent/orders/${encodeURIComponent(orderId)}/kitchen-printed`
  return patchWithRetry(config, url, "Kitchen", { orderId })
}

async function ackPrintJobPrinted(config, jobId) {
  const base = httpBaseUrl(config)
  if (!base || !jobId || !config.agentToken) return false
  const url = `${base}/restaurant/print-agent/print-jobs/${encodeURIComponent(jobId)}/printed`
  return patchWithRetry(config, url, "PrintJob", { jobId })
}

async function fetchPendingKitchenOrders(config) {
  const base = httpBaseUrl(config)
  if (!base || !config.agentToken) return []
  const url = `${base}/restaurant/print-agent/pending-kitchen-orders`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.agentToken}` },
    })
    if (!res.ok) {
      warn("pending-kitchen HTTP failed", { status: res.status })
      return []
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (e) {
    warn("pending-kitchen HTTP error", { error: e instanceof Error ? e.message : String(e) })
    return []
  }
}

async function fetchPendingPrintJobs(config) {
  const base = httpBaseUrl(config)
  if (!base || !config.agentToken) return []
  const url = `${base}/restaurant/print-agent/pending-print-jobs`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.agentToken}` },
    })
    if (!res.ok) {
      warn("pending-print-jobs HTTP failed", { status: res.status })
      return []
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (e) {
    warn("pending-print-jobs HTTP error", { error: e instanceof Error ? e.message : String(e) })
    return []
  }
}

async function fetchAgentContext(backendUrlOrConfig, tokenArg) {
  const base =
    typeof backendUrlOrConfig === "object"
      ? httpBaseUrl(backendUrlOrConfig)
      : normalizeHttpOrigin(backendUrlOrConfig)
  const token =
    typeof backendUrlOrConfig === "object"
      ? String(backendUrlOrConfig?.agentToken || "").trim()
      : String(tokenArg || "").trim()

  if (!base) {
    throw new Error("Backend URL is required")
  }
  if (!token) {
    throw new Error("Agent token is required")
  }

  const url = `${base}/restaurant/print-agent/context`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "")
    throw new Error(`HTTP ${res.status}: ${bodyText.slice(0, 200) || res.statusText}`)
  }
  const data = await res.json()
  return {
    restaurant: data?.restaurant || null,
    categories: Array.isArray(data?.categories) ? data.categories : [],
    printers: Array.isArray(data?.printers) ? data.printers : [],
  }
}

module.exports = {
  httpBaseUrl,
  ackKitchenPrinted,
  ackPrintJobPrinted,
  fetchPendingKitchenOrders,
  fetchPendingPrintJobs,
  fetchAgentContext,
}
