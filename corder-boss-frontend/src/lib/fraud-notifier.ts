import type {
  BossPlatformNotificationDto,
  FraudAlertDto,
  FraudSeverity,
} from "./types"
import { formatMoney } from "./format"

const PUSH_SOUND_PREF_KEY = "corder-boss-fraud-push-sound-enabled"
const BOSS_READ_NOTIFS_KEY = "corder-boss-read-notifs"
const BOSS_DISMISSED_NOTIFS_KEY = "corder-boss-dismissed-notifs"

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

export async function triggerPlatformPushNotification(
  notif: Pick<BossPlatformNotificationDto, "id" | "title" | "message" | "level">
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return

  const title = `📢 ${notif.title || "Corder Duyurusu"}`
  const body = notif.message || ""
  const tag = `corder-platform-${notif.id}`

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, {
          body,
          icon: "/corder-logo.png",
          badge: "/icon-96x96.png",
          tag,
          silent: false,
          data: { notificationId: notif.id },
        })
        return
      }
    }
    new Notification(title, {
      body,
      icon: "/corder-logo.png",
      tag,
      silent: false,
    })
  } catch {
    // Ignore push notification errors
  }
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
  if (Notification.permission === "granted") return "granted"
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export async function triggerFraudPushNotification(alert: FraudAlertDto): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return

  const sevLabel = alert.severity === "critical" ? "KRİTİK" : "YÜKSEK"
  const title = `🚨 [${sevLabel}] ${alert.title}`
  const impactText =
    alert.amountImpact > 0 ? ` • Etki: ₺${formatMoney(alert.amountImpact)}` : ""
  const branchText = alert.branchName ? `[${alert.branchName}] ` : ""
  const body = `${branchText}${alert.description}${impactText}`

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, {
          body,
          icon: "/icon-192x192.png",
          badge: "/icon-96x96.png",
          tag: `corder-fraud-${alert.id}`,
          silent: false,
          data: { alertId: alert.id, tab: "security" },
        })
        return
      }
    }
    new Notification(title, {
      body,
      icon: "/icon-192x192.png",
      tag: `corder-fraud-${alert.id}`,
      silent: false,
    })
  } catch {
    // Notification errors ignored
  }
}
