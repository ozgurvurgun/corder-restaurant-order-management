const { info, warn } = require("./logger")
const { resolveEmbeddedBackendUrl, PRODUCTION_SERVER_URL } = require("./config")

function normalizeHttpOrigin(rawUrl) {
  const clean = String(rawUrl || "").trim()
  if (!clean) return PRODUCTION_SERVER_URL
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
  return normalizeHttpOrigin(config?.backendWsUrl || PRODUCTION_SERVER_URL)
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
  warn(`${logLabel} ack failed after retries`, { ...meta, lastErr: lastErr?.slice?.(0, 180) })
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

async function loginPrintAgent(username, password) {
  const cleanUser = String(username || "").trim().toLowerCase()
  const cleanPass = String(password || "")
  if (!cleanUser || !cleanPass) {
    throw new Error("Kullanıcı adı ve parola zorunludur.")
  }

  const base = await resolveEmbeddedBackendUrl(true)
  const url = `${base}/restaurant/print-agent/login`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: cleanUser, password: cleanPass }),
  })
  if (!res.ok) {
    let errMsg = `Giriş başarısız (${res.status})`
    try {
      const body = await res.json()
      if (body?.message) {
        errMsg = Array.isArray(body.message) ? body.message.join(", ") : String(body.message)
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg)
  }
  const data = await res.json()
  return {
    backendUrl: base,
    accessToken: String(data?.accessToken || ""),
    restaurant: data?.restaurant || null,
    categories: Array.isArray(data?.categories) ? data.categories : [],
    printers: Array.isArray(data?.printers) ? data.printers : [],
  }
}

async function fetchAgentContext(config) {
  const base = httpBaseUrl(config)
  const token = String(config?.agentToken || config?.authToken || "").trim()
  if (!token) {
    throw new Error("Önce mekan kullanıcı adı ve parolası ile giriş yapın.")
  }
  const url = `${base}/restaurant/print-agent/context`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Kategori ve şube bilgileri çekilemedi (HTTP ${res.status})`)
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
  loginPrintAgent,
  fetchAgentContext,
}
