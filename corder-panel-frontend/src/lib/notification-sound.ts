import { getBase, getRestaurant, getToken } from "./api"

export interface NotificationPrefs {
  waiterCallEnabled: boolean
  browserPushEnabled: boolean
  voiceAnnouncementEnabled: boolean
}

const NOTIF_PREFS_KEY = "corder-panel-notification-prefs"
export const NOTIF_PREFS_UPDATED_EVENT = "corder:notification-prefs-updated"

const DEFAULT_PREFS: NotificationPrefs = {
  waiterCallEnabled: true,
  browserPushEnabled: true,
  voiceAnnouncementEnabled: true,
}

const recentShownTags = new Map<string, number>()
const recentSpokenTags = new Map<string, number>()
const DEDUP_TTL_MS = 45_000
let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null
let pushSetupInstalled = false
let pushSubscribeInFlight = false
let cachedVapidPublicKey: string | null = null
let lastSyncedPushSignature: string | null = null

function pruneRecentShownTags(): void {
  const now = Date.now()
  for (const [k, ts] of recentShownTags.entries()) {
    if (now - ts > DEDUP_TTL_MS) {
      recentShownTags.delete(k)
    }
  }
  for (const [k, ts] of recentSpokenTags.entries()) {
    if (now - ts > DEDUP_TTL_MS) {
      recentSpokenTags.delete(k)
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
      voiceAnnouncementEnabled:
        typeof parsed.voiceAnnouncementEnabled === "boolean"
          ? parsed.voiceAnnouncementEnabled
          : DEFAULT_PREFS.voiceAnnouncementEnabled,
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(NOTIF_PREFS_UPDATED_EVENT, { detail: next }))
    }
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
  force = false,
): Promise<void> {
  if (typeof window === "undefined" || pushSubscribeInFlight) return
  if (getBrowserNotificationPermission() !== "granted") return
  const token = explicitToken ?? getToken()
  if (!token) return
  const activeRestId = getRestaurant()?.id || ""
  const sessionSig = `${token}:${activeRestId}`
  if (!force && lastSyncedPushSignature === sessionSig) return

  pushSubscribeInFlight = true
  try {
    const reg = await ensurePanelServiceWorker()
    if (!reg || !("pushManager" in reg)) return

    const base = getBase()
    const authHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(activeRestId ? { "x-restaurant-id": activeRestId } : {}),
    }
    let publicKey = cachedVapidPublicKey
    if (!publicKey) {
      const keyRes = await fetch(`${base}/restaurant/push/vapid-public-key`, {
        headers: authHeaders,
      })
      if (!keyRes.ok) return
      const keyData = (await keyRes.json()) as { publicKey?: string }
      publicKey = keyData?.publicKey?.trim() || null
      if (!publicKey) return
      cachedVapidPublicKey = publicKey
    }

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

    const subRes = await fetch(`${base}/restaurant/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
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
    if (subRes.ok) {
      lastSyncedPushSignature = sessionSig
    }
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
    gesturePromptAttempted = true
    window.removeEventListener("click", handleFirstGesture)
    const perm = getBrowserNotificationPermission()
    if (perm !== "default") {
      if (perm === "granted") void syncPanelWebPushSubscription()
      return
    }
    const prefs = getNotificationPrefs()
    if (!prefs.browserPushEnabled) return
    void requestBrowserNotificationPermission()
  }

  window.addEventListener("click", handleFirstGesture, { passive: true, once: true })
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

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  )
}

export function buildWaiterCallSpeechText(params: {
  tableName?: string | null
  sectionName?: string | null
  requestType?: string | null
}): string {
  const rawTable = (params.tableName ?? "").trim()
  let spokenTable = "Masa"
  if (rawTable) {
    spokenTable = /^\d+$/.test(rawTable) ? `Masa ${rawTable}` : rawTable
  }

  const rawSection = (params.sectionName ?? "").trim()
  const includeSection =
    Boolean(rawSection) &&
    rawSection.toLocaleLowerCase("tr-TR") !== "salon" &&
    !spokenTable.toLocaleLowerCase("tr-TR").includes(rawSection.toLocaleLowerCase("tr-TR"))

  const subject = includeSection ? `${rawSection} ${spokenTable}` : spokenTable
  const actionText =
    params.requestType === "bill" ? "hesap talebinde bulundu" : "garson çağırıyor"

  return `${subject} ${actionText}.`
}

export function speakWaiterCallAnnouncement(params: {
  id?: string | null
  tableName?: string | null
  sectionName?: string | null
  requestType?: string | null
  force?: boolean
}): boolean {
  if (!isSpeechSynthesisSupported()) return false

  if (!params.force) {
    const prefs = getNotificationPrefs()
    if (!prefs.waiterCallEnabled || !prefs.voiceAnnouncementEnabled) return false
  }

  const dedupKey = params.id ? `waiter-voice-${params.id}` : ""
  if (!params.force && dedupKey) {
    pruneRecentShownTags()
    if (recentSpokenTags.has(dedupKey)) return false
    recentSpokenTags.set(dedupKey, Date.now())
  }

  const text = buildWaiterCallSpeechText(params)
  try {
    const synth = window.speechSynthesis
    if (params.force) {
      synth.cancel()
    } else if (synth.paused) {
      synth.resume()
    }

    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.lang = "tr-TR"
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    const voices = synth.getVoices?.() ?? []
    const turkishVoice =
      voices.find((v) => v.lang?.toLowerCase() === "tr-tr" && v.localService) ||
      voices.find((v) => v.lang?.toLowerCase() === "tr-tr") ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("tr"))
    if (turkishVoice) {
      utterance.voice = turkishVoice
    }

    synth.speak(utterance)
    return true
  } catch {
    return false
  }
}

