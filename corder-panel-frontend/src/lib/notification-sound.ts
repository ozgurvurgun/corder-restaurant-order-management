import { getBase, getToken } from "./api"

export interface NotificationPrefs {
  waiterCallEnabled: boolean
  browserPushEnabled: boolean
}

const NOTIF_PREFS_KEY = "corder-panel-notification-prefs"

const DEFAULT_PREFS: NotificationPrefs = {
  waiterCallEnabled: true,
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

export function getNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>
    return {
      waiterCallEnabled:
        typeof parsed.waiterCallEnabled === "boolean"
          ? parsed.waiterCallEnabled
          : DEFAULT_PREFS.waiterCallEnabled,
      browserPushEnabled:
        typeof parsed.browserPushEnabled === "boolean"
          ? parsed.browserPushEnabled
          : DEFAULT_PREFS.browserPushEnabled,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveNotificationPrefs(
  prefs: Partial<NotificationPrefs>,
): NotificationPrefs {
  const next: NotificationPrefs = {
    ...getNotificationPrefs(),
    ...prefs,
  }
  try {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next))
  } catch {
    // ignore storage quota errors
  }
  return next
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission
}

export async function ensurePanelServiceWorker(): Promise<ServiceWorkerRegistration | null> {
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

export async function syncPanelWebPushSubscription(
  explicitToken?: string | null,
): Promise<void> {
  if (typeof window === "undefined" || pushSubscribeInFlight) return
  if (getBrowserNotificationPermission() !== "granted") return
  const token = explicitToken ?? getToken()
  if (!token) return

  pushSubscribeInFlight = true
  try {
    const reg = await ensurePanelServiceWorker()
    if (!reg || !("pushManager" in reg)) return

    const base = getBase()
    const keyRes = await fetch(`${base}/restaurant/push/vapid-public-key`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!keyRes.ok) return
    const keyData = (await keyRes.json()) as { publicKey?: string }
    const publicKey = keyData?.publicKey?.trim()
    if (!publicKey) return

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
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
        appType: "merchant",
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
    // ignore push subscription errors
  } finally {
    pushSubscribeInFlight = false
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  if (Notification.permission === "granted") {
    saveNotificationPrefs({ browserPushEnabled: true })
    void syncPanelWebPushSubscription()
    return "granted"
  }
  try {
    const perm = await Notification.requestPermission()
    if (perm === "granted") {
      saveNotificationPrefs({ browserPushEnabled: true })
      void syncPanelWebPushSubscription()
    }
    return perm
  } catch {
    return Notification.permission
  }
}

export function installPanelPushAutoSetup(): void {
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
    void ensurePanelServiceWorker().then(() => {
      if (getBrowserNotificationPermission() === "granted") {
        void syncPanelWebPushSubscription()
      }
    })
  }

  let gesturePromptAttempted = false
  const handleFirstGesture = () => {
    if (gesturePromptAttempted) return
    const perm = getBrowserNotificationPermission()
    if (perm !== "default") {
      if (perm === "granted") void syncPanelWebPushSubscription()
      return
    }
    const prefs = getNotificationPrefs()
    if (!prefs.browserPushEnabled) return
    gesturePromptAttempted = true
    void requestBrowserNotificationPermission()
  }

  window.addEventListener("click", handleFirstGesture, { passive: true })
}

export function showBrowserNotification(
  title: string,
  body: string,
  tag = `corder-${Date.now()}`,
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return
  const prefs = getNotificationPrefs()
  if (!prefs.browserPushEnabled || Notification.permission !== "granted") return

  pruneRecentShownTags()
  if (recentShownTags.has(tag)) return
  recentShownTags.set(tag, Date.now())

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
    void ensurePanelServiceWorker()
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
              // ignore getNotifications errors
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
          // ignore browser notification errors
        }
      })
    return
  }

  try {
    new Notification(title, options)
  } catch {
    // ignore browser notification errors
  }
}
