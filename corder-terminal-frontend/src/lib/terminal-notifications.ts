import { getBase, getToken } from "./api"
import { formatTitleCase } from "./format"

export const TERMINAL_NOTIF_PREFS_KEY = "corder_terminal_notif_prefs_v2"

export interface TerminalNotificationPrefs {
  enabled: boolean
  browserPushEnabled: boolean
}

export interface ActiveWaiterCall {
  id: string
  tableId: string
  tableName: string
  sectionName?: string | null
  requestType: "waiter" | "bill"
  note?: string | null
  createdAt: string
}

const DEFAULT_PREFS: TerminalNotificationPrefs = {
  enabled: true,
  browserPushEnabled: true,
}

const recentShownTags = new Map<string, number>()
const DEDUP_TTL_MS = 45_000
let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null
let pushSetupInstalled = false
let pushSubscribeInFlight = false

function pruneRecentShownTags(): void {
  const now = Date.now()
  for (const [k, ts] of recentShownTags.entries()) {
    if (now - ts > DEDUP_TTL_MS) {
      recentShownTags.delete(k)
    }
  }
}

export function getTerminalNotificationPrefs(): TerminalNotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(TERMINAL_NOTIF_PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<TerminalNotificationPrefs>
    const enabled =
      typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_PREFS.enabled
    const browserPushEnabled =
      typeof parsed.browserPushEnabled === "boolean"
        ? parsed.browserPushEnabled
        : enabled
    return {
      enabled,
      browserPushEnabled: enabled ? browserPushEnabled : false,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveTerminalNotificationPrefs(
  prefs: Partial<TerminalNotificationPrefs>
): TerminalNotificationPrefs {
  const current = getTerminalNotificationPrefs()
  const nextEnabled =
    typeof prefs.enabled === "boolean" ? prefs.enabled : current.enabled
  const nextPush =
    typeof prefs.browserPushEnabled === "boolean"
      ? prefs.browserPushEnabled
      : typeof prefs.enabled === "boolean"
        ? prefs.enabled
        : current.browserPushEnabled
  const next: TerminalNotificationPrefs = {
    enabled: nextEnabled,
    browserPushEnabled: nextEnabled ? nextPush : false,
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(TERMINAL_NOTIF_PREFS_KEY, JSON.stringify(next))
      window.dispatchEvent(new CustomEvent("corder:terminal-notif-prefs", { detail: next }))
    } catch {
      // Ignore storage quota errors
    }
  }
  return next
}

export function getTerminalPushPermissionStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported"
  return Notification.permission
}

function emitPermissionChanged(perm: NotificationPermission | "unsupported"): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("corder:terminal-push-permission", { detail: perm })
  )
}

export async function ensureTerminalServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => null)
  }
  const reg = await swRegistrationPromise
  if (reg?.active) return reg
  try {
    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
    ])
    return readyReg ?? reg
  } catch {
    return reg
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function syncTerminalWebPushSubscription(
  explicitToken?: string | null
): Promise<void> {
  if (typeof window === "undefined" || pushSubscribeInFlight) return
  if (getTerminalPushPermissionStatus() !== "granted") return
  const token = explicitToken ?? getToken()
  if (!token) return

  pushSubscribeInFlight = true
  try {
    const reg = await ensureTerminalServiceWorker()
    if (!reg || !("pushManager" in reg)) return

    const base = getBase()
    const keyRes = await fetch(`${base}/restaurant/push/vapid-public-key`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!keyRes.ok) return
    const keyData = (await keyRes.json()) as { publicKey?: string }
    const publicKey = keyData?.publicKey?.trim()
    if (!publicKey) return

    const expectedKey = urlBase64ToUint8Array(publicKey)
    let sub = await reg.pushManager.getSubscription()
    if (sub && sub.options?.applicationServerKey) {
      const currentKey = new Uint8Array(sub.options.applicationServerKey)
      const sameKey =
        currentKey.length === expectedKey.length &&
        currentKey.every((byte, idx) => byte === expectedKey[idx])
      if (!sameKey) {
        await sub.unsubscribe().catch(() => {})
        sub = null
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedKey as unknown as BufferSource,
      })
    }

    const subJson = sub.toJSON()
    if (!subJson?.endpoint || !subJson?.keys?.p256dh || !subJson?.keys?.auth) return

    await fetch(`${base}/restaurant/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        appType: "terminal",
        subscription: {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
        },
      }),
    })
  } catch {
    // Ignore push subscription errors
  } finally {
    pushSubscribeInFlight = false
  }
}

export async function requestTerminalPushPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported"
  try {
    const result = await Notification.requestPermission()
    if (result === "granted") {
      saveTerminalNotificationPrefs({ enabled: true, browserPushEnabled: true })
      void syncTerminalWebPushSubscription()
    }
    emitPermissionChanged(result)
    return result
  } catch {
    const fallback = Notification.permission
    emitPermissionChanged(fallback)
    return fallback
  }
}

export function installTerminalPushAutoSetup(): void {
  if (typeof window === "undefined" || pushSetupInstalled) return
  pushSetupInstalled = true

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data as { type?: string; tag?: string } | undefined
      if (data?.type === "CORDER_TAG_SHOWN" && typeof data.tag === "string" && data.tag) {
        pruneRecentShownTags()
        recentShownTags.set(data.tag, Date.now())
      }
    })
    void ensureTerminalServiceWorker().then(() => {
      if (getTerminalPushPermissionStatus() === "granted") {
        void syncTerminalWebPushSubscription()
      }
    })
  }

  let gesturePromptAttempted = false
  const handleFirstGesture = () => {
    if (gesturePromptAttempted) return
    const perm = getTerminalPushPermissionStatus()
    if (perm !== "default") {
      if (perm === "granted") void syncTerminalWebPushSubscription()
      return
    }
    const prefs = getTerminalNotificationPrefs()
    if (!prefs.enabled) return
    gesturePromptAttempted = true
    void requestTerminalPushPermission()
  }

  window.addEventListener("click", handleFirstGesture, { passive: true })
}

export function triggerTerminalPushNotification(
  title: string,
  body: string,
  tag = `corder-waiter-call-${Date.now()}`
): void {
  if (typeof window === "undefined" || typeof Notification === "undefined") return
  if (Notification.permission !== "granted") return

  pruneRecentShownTags()
  if (recentShownTags.has(tag)) return
  recentShownTags.set(tag, Date.now())

  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // Ignore vibration errors
  }

  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body,
    icon: "/icon-192x192.png",
    badge: "/icon-96x96.png",
    tag,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
  }

  if ("serviceWorker" in navigator) {
    void ensureTerminalServiceWorker()
      .then(async (reg) => {
        if (reg && typeof reg.showNotification === "function") {
          reg.active?.postMessage({ type: "CORDER_MARK_TAG_SHOWN", tag })
          if (typeof reg.getNotifications === "function") {
            try {
              const existing = await reg.getNotifications({ tag })
              if (Array.isArray(existing) && existing.length > 0) {
                return
              }
            } catch {
              // Ignore getNotifications error
            }
          }
          await reg.showNotification(title, options)
          return
        }
        new Notification(title, options)
      })
      .catch(() => {
        try {
          new Notification(title, options)
        } catch {
          // Ignore Notification constructor errors
        }
      })
    return
  }

  try {
    new Notification(title, options)
  } catch {
    // Ignore Notification constructor errors
  }
}

export function normalizeWaiterCallPayload(raw: unknown): ActiveWaiterCall | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const tableId = typeof obj.tableId === "string" ? obj.tableId.trim() : ""
  const tableName = typeof obj.tableName === "string" ? obj.tableName.trim() : ""
  if (!tableId && !tableName) return null
  const id =
    typeof obj.id === "string" && obj.id.trim()
      ? obj.id.trim()
      : `${tableId || tableName}-${Date.now()}`
  return {
    id,
    tableId: tableId || id,
    tableName: tableName ? formatTitleCase(tableName) : "Masa",
    sectionName:
      typeof obj.sectionName === "string" && obj.sectionName.trim()
        ? formatTitleCase(obj.sectionName)
        : null,
    requestType: obj.requestType === "bill" ? "bill" : "waiter",
    note: typeof obj.note === "string" && obj.note.trim() ? obj.note.trim() : null,
    createdAt:
      typeof obj.createdAt === "string" && obj.createdAt.trim()
        ? obj.createdAt
        : new Date().toISOString(),
  }
}
