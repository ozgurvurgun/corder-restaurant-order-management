const { info, warn } = require("./logger")
const { resolveEmbeddedBackendUrl, PRODUCTION_SERVER_URL } = require("./config")
const { saveSettings } = require("./settings-store")

let refreshInFlight = null

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

async function refreshAgentSession(config) {
  if (!config?.refreshToken) return null
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const base = httpBaseUrl(config)
    const url = `${base}/restaurant/print-agent/refresh`
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: config.refreshToken }),
      })
      if (!res.ok) {
        warn("Print Agent token refresh rejected", { status: res.status })
        return null
      }
      const data = await res.json()
      if (!data?.accessToken) return null
      const saved = saveSettings({
        authToken: String(data.accessToken),
        refreshToken: String(data.refreshToken || config.refreshToken),
      })
      config.agentToken = saved.authToken
      config.refreshToken = saved.refreshToken
      info("Print Agent session token refreshed automatically")
      return saved
    } catch (e) {
      warn("Print Agent token refresh network error", { error: e instanceof Error ? e.message : String(e) })
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

async function authorizedFetch(config, url, options = {}) {
  const doCall = (token) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })

  let res = await doCall(config.agentToken)
  if (res.status === 401 && config.refreshToken) {
    const refreshed = await refreshAgentSession(config)
    if (refreshed?.authToken) {
      res = await doCall(refreshed.authToken)
    }
  }
  return res
}

async function patchWithRetry(config, url, logLabel, meta) {
  let lastErr = ""
  for (let i = 0; i < 6; i++) {
    try {
      const res = await authorizedFetch(config, url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
    const res = await authorizedFetch(config, url)
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
    const res = await authorizedFetch(config, url)
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
    refreshToken: String(data?.refreshToken || ""),
    restaurant: data?.restaurant || null,
    categories: Array.isArray(data?.categories) ? data.categories : [],
    printers: Array.isArray(data?.printers) ? data.printers : [],
  }
}

async function fetchAgentContext(config) {
  const base = httpBaseUrl(config)
  if (!config?.agentToken && !config?.refreshToken) {
    throw new Error("Lütfen önce kullanıcı adı ve parolanızla giriş yapın.")
  }
  const url = `${base}/restaurant/print-agent/context`
  const res = await authorizedFetch(config, url)
  if (!res.ok) {
    throw new Error(`Kategori bilgileri çekilemedi (HTTP ${res.status})`)
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
  refreshAgentSession,
  fetchAgentContext,
}
