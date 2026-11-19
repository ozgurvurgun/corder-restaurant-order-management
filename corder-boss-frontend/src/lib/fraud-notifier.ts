import type {
  BossOverviewDto,
  FraudAlertDto,
  FraudAlertStatus,
  FraudSeverity,
  LiveOrderDto,
  LiveTableDto,
} from "./types"
import { formatMoney } from "./format"

const PUSH_SOUND_PREF_KEY = "corder-boss-fraud-push-sound-enabled"
const LOCAL_RESOLUTIONS_KEY = "corder-boss-fraud-local-resolutions"

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
    // Fallback ignored if notification fails
  }
}

export function getLocalFraudResolutions(): Record<
  string,
  { status: FraudAlertStatus; resolutionNote?: string; resolvedAt: string }
> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LOCAL_RESOLUTIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveLocalFraudResolution(
  id: string,
  status: FraudAlertStatus,
  resolutionNote?: string
): void {
  if (typeof window === "undefined") return
  const current = getLocalFraudResolutions()
  current[id] = {
    status,
    resolutionNote,
    resolvedAt: new Date().toISOString(),
  }
  localStorage.setItem(LOCAL_RESOLUTIONS_KEY, JSON.stringify(current))
}

export function deriveHeuristicFraudAlerts(
  overview: BossOverviewDto | null,
  orders: LiveOrderDto[],
  tables: LiveTableDto[]
): FraudAlertDto[] {
  if (!overview) return []
  const localRes = getLocalFraudResolutions()
  const derived: FraudAlertDto[] = []
  const tableMap = new Map(tables.map((t) => [t.id, t.name]))

  for (const audit of overview.recentAudits ?? []) {
    const text = `${audit.action} ${audit.details}`.toLowerCase()
    let matchedRule: FraudAlgorithmSpec | null = null
    if (text.includes("fiş") && (text.includes("iptal") || text.includes("iskonto"))) {
      matchedRule = FRAUD_ALGORITHMS[0]
    } else if (text.includes("taşı") && text.includes("iptal")) {
      matchedRule = FRAUD_ALGORITHMS[3]
    } else if (text.includes("iptal") || text.includes("zayi")) {
      matchedRule = FRAUD_ALGORITHMS[2]
    } else if (text.includes("iskonto") || text.includes("indirim") || text.includes("ikram")) {
      matchedRule = FRAUD_ALGORITHMS[6]
    } else if (text.includes("nakit çıkış") || text.includes("kasa çıkış")) {
      matchedRule = FRAUD_ALGORITHMS[5]
    }
    if (matchedRule) {
      const id = `audit-fraud-${audit.id}`
      const saved = localRes[id]
      derived.push({
        id,
        restaurantId: audit.restaurantId,
        branchName: audit.branchName,
        ruleKey: matchedRule.key,
        title: `${matchedRule.title} (${audit.action})`,
        description: audit.details,
        severity: matchedRule.severity,
        status: saved?.status ?? "open",
        amountImpact: 0,
        staffName: audit.userName,
        resolutionNote: saved?.resolutionNote ?? null,
        resolvedAt: saved?.resolvedAt ?? null,
        createdAt: audit.createdAt,
      })
    }
  }

  for (const br of overview.branches ?? []) {
    if (br.todayCancelCount >= 3 || br.todayCancelAmount >= 500) {
      const id = `branch-void-${br.id}`
      const saved = localRes[id]
      derived.push({
        id,
        restaurantId: br.id,
        branchId: br.id,
        branchName: br.name,
        ruleKey: "EXCESSIVE_VOID_PATTERN",
        title: "Aşırı İptal Deseni Tespiti",
        description: `${br.name} şubesinde bugün ${br.todayCancelCount} adet ürün/kalem iptali (Toplam ₺${formatMoney(br.todayCancelAmount)}) gerçekleşti.`,
        severity: br.todayCancelAmount >= 1000 ? "critical" : "high",
        status: saved?.status ?? "open",
        amountImpact: br.todayCancelAmount,
        staffName: br.activeShift?.openedBy ?? "Şube Personeli",
        resolutionNote: saved?.resolutionNote ?? null,
        resolvedAt: saved?.resolvedAt ?? null,
        createdAt: new Date().toISOString(),
      })
    }
  }

  for (const ord of orders) {
    if (ord.mergedFrom) {
      const cancelledItems = (ord.items ?? []).filter((i) => i.status === "cancelled")
      if (cancelledItems.length > 0) {
        const impact = cancelledItems.reduce((s, i) => s + i.price * i.quantity, 0)
        const id = `transfer-void-${ord.id}`
        const saved = localRes[id]
        derived.push({
          id,
          ruleKey: "POST_TRANSFER_VOID",
          title: "Masa Taşıma / Birleştirme Sonrası İptal",
          description: `${tableMap.get(ord.tableId) ?? "Masa"} hesabında masa taşıma sonrası ${cancelledItems.length} kalem iptal edildi.`,
          severity: "high",
          status: saved?.status ?? "open",
          amountImpact: impact,
          staffName: ord.userName ?? cancelledItems[0]?.cancelledBy ?? null,
          tableName: tableMap.get(ord.tableId) ?? null,
          orderId: ord.id,
          resolutionNote: saved?.resolutionNote ?? null,
          resolvedAt: saved?.resolvedAt ?? null,
          createdAt: ord.createdAt,
        })
      }
    }
  }

  return derived
}
