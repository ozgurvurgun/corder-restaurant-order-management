const { info, warn } = require("./logger")

function httpBaseUrl(config) {
  const explicit = (config.backendHttpUrl || "").trim()
  if (explicit) return explicit.replace(/\/$/, "")
  try {
    const u = new URL(config.backendWsUrl)
    u.protocol = u.protocol === "wss:" ? "https:" : u.protocol === "ws:" ? "http:" : u.protocol
    return u.origin
  } catch {
    return ""
  }
}

/**
 * Acknowledges to the server that the kitchen ticket was printed (clears the queue even if WS drops).
 * Retries a few times.
 */
async function ackKitchenPrinted(config, orderId) {
  const base = httpBaseUrl(config)
  if (!base || !orderId) return false
  const url = `${base}/restaurant/print-agent/orders/${encodeURIComponent(orderId)}/kitchen-printed`
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
        if (i > 0) info("Kitchen ack succeeded after retry", { orderId, attempt: i + 1 })
        return true
      }
      lastErr = await res.text()
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
    await new Promise((r) => setTimeout(r, 350 * (i + 1)))
  }
  warn("Kitchen ack failed after retries", { orderId, lastErr: lastErr?.slice?.(0, 200) })
  return false
}

async function fetchPendingKitchenOrders(config) {
  const base = httpBaseUrl(config)
  if (!base) return []
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

module.exports = { httpBaseUrl, ackKitchenPrinted, fetchPendingKitchenOrders }
