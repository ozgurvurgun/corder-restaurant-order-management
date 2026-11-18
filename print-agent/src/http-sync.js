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
      if (res.status === 401 || res.status === 403) {
        warn("Print Agent refresh token revoked or expired; clearing session", { status: res.status })
        saveSettings({ authToken: "", refreshToken: "" })
        config.agentToken = ""
        config.refreshToken = ""
        if (typeof config.onAuthRevoked === "function") {
          config.onAuthRevoked("Oturum süresi doldu veya parola değiştirildi. Lütfen tekrar giriş yapın.")
        }
        return { revoked: true }
      }
      if (!res.ok) {
        warn("Print Agent token refresh temporary failure", { status: res.status })
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
      if (typeof config.onTokenRefreshed === "function") {
        config.onTokenRefreshed(saved.authToken)
      }
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

  if (!config.agentToken && config.refreshToken) {
    const refreshed = await refreshAgentSession(config)
    if (!refreshed?.authToken) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
    }
  }

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
    if (!config.agentToken && !config.refreshToken) return false
    try {
      const res = await authorizedFetch(config, url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      })
      if (res.ok) {
        if (i > 0) info(`${logLabel} ack succeeded after retry`, { ...meta, attempt: i + 1 })
        return true
      }
      if (res.status === 404) {
        warn(`${logLabel} ack target no longer pending (404); treating as settled`, meta)
        return true
      }
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        lastErr = await res.text()
        break
      }
      lastErr = await res.text()
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
    await new Promise((r) => setTimeout(r, 350 * (i + 1)))
  }
  warn(`${logLabel} ack failed`, { ...meta, lastErr: lastErr?.slice?.(0, 180) })
  return false
}

async function ackKitchenPrinted(config, orderId) {
  const base = httpBaseUrl(config)
  if (!base || !orderId || (!config.agentToken && !config.refreshToken)) return false
  const url = `${base}/restaurant/print-agent/orders/${encodeURIComponent(orderId)}/kitchen-printed`
  return patchWithRetry(config, url, "Kitchen", { orderId })
}

async function ackPrintJobPrinted(config, jobId) {
  const base = httpBaseUrl(config)
  if (!base || !jobId || (!config.agentToken && !config.refreshToken)) return false
  const url = `${base}/restaurant/print-agent/print-jobs/${encodeURIComponent(jobId)}/printed`
  return patchWithRetry(config, url, "PrintJob", { jobId })
}

async function fetchPendingKitchenOrders(config) {
  const base = httpBaseUrl(config)
  if (!base || (!config.agentToken && !config.refreshToken)) return []
  const url = `${base}/restaurant/print-agent/pending-kitchen-orders`
  try {
    const res = await authorizedFetch(config, url)
    if (!res.ok) {
      if (res.status !== 401) warn("pending-kitchen HTTP failed", { status: res.status })
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
  if (!base || (!config.agentToken && !config.refreshToken)) return []
  const url = `${base}/restaurant/print-agent/pending-print-jobs`
  try {
    const res = await authorizedFetch(config, url)
    if (!res.ok) {
      if (res.status !== 401) warn("pending-print-jobs HTTP failed", { status: res.status })
      return []
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (e) {
    warn("pending-print-jobs HTTP error", { error: e instanceof Error ? e.message : String(e) })
    return []
  }
}

async function loginPrintAgent(username, password, preferredBackendUrl = null) {
  const cleanUser = String(username || "").trim().toLowerCase()
  const cleanPass = String(password || "")
  if (!cleanUser || !cleanPass) {
    throw new Error("Kullanıcı adı ve parola zorunludur.")
  }

  const base = await resolveEmbeddedBackendUrl(true, preferredBackendUrl)
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

async function pushPrintersToBackend(config, settings) {
  const base = httpBaseUrl(config)
  if (!base || (!config?.agentToken && !config?.refreshToken)) return false
  const printers = Array.isArray(settings?.printers) ? settings.printers : []
  const receiptPrinterId = String(settings?.receiptPrinterId || "")
  const defaultKitchenPrinterId = String(settings?.defaultKitchenPrinterId || "")
  const url = `${base}/restaurant/print-agent/printers/sync`
  try {
    const res = await authorizedFetch(config, url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printers: printers.map((p) => ({
          id: p.id,
          name: p.name,
          mode: p.mode,
          host: p.host,
          port: p.port,
          systemPrinterName: p.systemPrinterName,
          paperWidth: p.paperWidth,
          department: p.department || null,
          autoCut: p.autoCut !== false,
          role: p.id && p.id === receiptPrinterId ? "receipt" : "kitchen",
        })),
        receiptPrinterId,
        defaultKitchenPrinterId,
      }),
    })
    return res.ok
  } catch (e) {
    warn("pushPrintersToBackend error", { error: e instanceof Error ? e.message : String(e) })
    return false
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
  pushPrintersToBackend,
}
