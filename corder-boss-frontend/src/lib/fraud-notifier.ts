import type {
  BossPlatformNotificationDto,
  FraudAlertDto,
  FraudSeverity,
} from "./types"
import { getApiBase, getBossToken } from "./api"
import { formatMoney } from "./format"

const PUSH_SOUND_PREF_KEY = "corder-boss-fraud-push-sound-enabled"
const BOSS_READ_NOTIFS_KEY = "corder-boss-read-notifs"
const BOSS_DISMISSED_NOTIFS_KEY = "corder-boss-dismissed-notifs"

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

export async function ensureBossServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            void registration.update().catch(() => {})
          }
        })
        return registration
      })
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

export async function syncBossWebPushSubscription(
  explicitToken?: string | null
): Promise<void> {
  if (typeof window === "undefined" || pushSubscribeInFlight) return
  if (!("Notification" in window) || Notification.permission !== "granted") return
  const token = explicitToken ?? getBossToken()
  if (!token) return

  pushSubscribeInFlight = true
  try {
    const reg = await ensureBossServiceWorker()
    if (!reg || !("pushManager" in reg)) return

    const base = getApiBase()
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
        appType: "boss",
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

export function installBossPushAutoSetup(): void {
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
    void ensureBossServiceWorker().then(() => {
      if ("Notification" in window && Notification.permission === "granted") {
        void syncBossWebPushSubscription()
      }
    })
  }

  let gesturePromptAttempted = false
  const handleFirstGesture = () => {
    if (gesturePromptAttempted) return
    if (!("Notification" in window)) return
    if (Notification.permission !== "default") {
      if (Notification.permission === "granted") void syncBossWebPushSubscription()
      return
    }
    if (!getFraudPushSoundEnabled()) return
    gesturePromptAttempted = true
    void requestBrowserNotificationPermission()
  }

  window.addEventListener("click", handleFirstGesture, { passive: true })
}

export function getBossReadNotifIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(BOSS_READ_NOTIFS_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown[]) : []
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [])
  } catch {
    return new Set()
  }
}

export function markBossNotifReadLocal(id: string): void {
  if (typeof window === "undefined") return
  const set = getBossReadNotifIds()
  set.add(id)
  localStorage.setItem(BOSS_READ_NOTIFS_KEY, JSON.stringify(Array.from(set).slice(-300)))
}

export function getBossDismissedNotifIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(BOSS_DISMISSED_NOTIFS_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown[]) : []
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [])
  } catch {
    return new Set()
  }
}

export function markBossNotifsDismissedLocal(ids: string[]): void {
  if (typeof window === "undefined") return
  const set = getBossDismissedNotifIds()
  for (const id of ids) set.add(id)
  localStorage.setItem(BOSS_DISMISSED_NOTIFS_KEY, JSON.stringify(Array.from(set).slice(-500)))
}

async function showBossDeduplicatedNotification(
  title: string,
  body: string,
  tag: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return

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
    data,
  }

  try {
    if ("serviceWorker" in navigator) {
      const reg = await ensureBossServiceWorker()
      if (reg && typeof reg.showNotification === "function") {
        reg.active?.postMessage({ type: "CORDER_MARK_TAG_SHOWN", tag })
        if (typeof reg.getNotifications === "function") {
          try {
            const existing = await reg.getNotifications({ tag })
            if (Array.isArray(existing) && existing.length > 0) {
              return
            }
          } catch {}
        }
        await reg.showNotification(title, options)
        return
      }
    }
    new Notification(title, options)
  } catch {
    // Ignore push notification errors
  }
}

export async function triggerPlatformPushNotification(
  notif: Pick<BossPlatformNotificationDto, "id" | "title" | "message" | "level">
): Promise<void> {
  const title = `📢 ${notif.title || "Corder Duyurusu"}`
  const body = notif.message || ""
  const tag = `corder-platform-${notif.id}`
  await showBossDeduplicatedNotification(title, body, tag, { notificationId: notif.id })
}

export interface FraudAlgorithmSpec {
  key: string
  title: string
  severity: FraudSeverity
  description: string
}

export const FRAUD_ALGORITHMS: FraudAlgorithmSpec[] = [
  {
    key: "POST_PRINT_VOID_DISCOUNT",
    title: "Fiş Basımı Sonrası İptal / İskonto",
    severity: "critical",
    description:
      "Müşteriye adisyon fişi basıldıktan sonra kalem iptal edilmesi veya sonradan iskonto girilerek nakit farkının kasaya girilmemesi durumunu yakalar.",
  },
  {
    key: "CLOSED_CHECK_REDUCTION",
    title: "Kapalı Hesap Düşürme",
    severity: "critical",
    description:
      "Kapatılmış veya ödeme alınmış adisyonun tekrar açılarak tutarının düşürülmesi ya da ödeme yönteminin değiştirilmesi girişimlerini tespit eder.",
  },
  {
    key: "EXCESSIVE_VOID_PATTERN",
    title: "Aşırı İptal Deseni",
    severity: "high",
    description:
      "Aynı personel veya şube tarafından vardiya içinde normal eşik değerinin üzerinde ardışık ürün/adisyon iptali yapılmasını analiz eder.",
  },
  {
    key: "POST_TRANSFER_VOID",
    title: "Masa Taşıma Sonrası İptal",
    severity: "high",
    description:
      "Kalemlerin başka bir masaya taşındıktan veya birleştirildikten hemen sonra iptal edilerek iz kaybettirme desenini yakalar.",
  },
  {
    key: "CASH_SHIFT_SHORTAGE",
    title: "Kasa Vardiya Açığı",
    severity: "critical",
    description:
      "Vardiya kapanışında beklenen nakit ile sayılan kasa nakiti arasındaki negatif farkları ve mutabakat uyuşmazlıklarını raporlar.",
  },
  {
    key: "SUSPICIOUS_CASH_OUT",
    title: "Şüpheli Nakit Çıkışı",
    severity: "medium",
    description:
      "Kasadan mesai dışı saatlerde, sık aralıklarla veya yüksek tutarlı belgesiz nakit çıkış hareketlerini denetler.",
  },
  {
    key: "THRESHOLD_DISCOUNT_ABUSE",
    title: "Limit Sınırı İskonto",
    severity: "medium",
    description:
      "Personelin yetki üst sınırının hemen altında (örn. %15 limit için sürekli %14-%15) tekrarlayan iskonto tanımlamalarını tespit eder.",
  },
]

export function getFraudPushSoundEnabled(): boolean {
  if (typeof window === "undefined") return true
  const raw = localStorage.getItem(PUSH_SOUND_PREF_KEY)
  if (raw === null) return true
  return raw === "true"
}

export function setFraudPushSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PUSH_SOUND_PREF_KEY, enabled ? "true" : "false")
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  if (Notification.permission === "granted") {
    void syncBossWebPushSubscription()
    return "granted"
  }
  try {
    const perm = await Notification.requestPermission()
    if (perm === "granted") {
      void syncBossWebPushSubscription()
    }
    return perm
  } catch {
    return Notification.permission
  }
}

export async function triggerFraudPushNotification(alert: FraudAlertDto): Promise<void> {
  const sevLabel = alert.severity === "critical" ? "KRİTİK" : "YÜKSEK"
  const title = `🚨 [${sevLabel}] ${alert.title}`
  const impactText =
    alert.amountImpact > 0 ? ` • Etki: ₺${formatMoney(alert.amountImpact)}` : ""
  const branchText = alert.branchName ? `[${alert.branchName}] ` : ""
  const body = `${branchText}${alert.description}${impactText}`

  await showBossDeduplicatedNotification(title, body, `corder-fraud-${alert.id}`, {
    alertId: alert.id,
    tab: "security",
  })
}
