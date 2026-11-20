import { formatTitleCase } from "./format"

export const TERMINAL_NOTIF_PREFS_KEY = "corder_terminal_notif_prefs_v1"

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

export function getTerminalNotificationPrefs(): TerminalNotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(TERMINAL_NOTIF_PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<TerminalNotificationPrefs>
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_PREFS.enabled,
      browserPushEnabled:
        typeof parsed.browserPushEnabled === "boolean"
          ? parsed.browserPushEnabled
          : DEFAULT_PREFS.browserPushEnabled,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveTerminalNotificationPrefs(
  prefs: Partial<TerminalNotificationPrefs>
): TerminalNotificationPrefs {
  const current = getTerminalNotificationPrefs()
  const next: TerminalNotificationPrefs = {
    ...current,
    ...prefs,
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

export async function requestTerminalPushPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported"
  try {
    const result = await Notification.requestPermission()
    if (result === "granted") saveTerminalNotificationPrefs({ browserPushEnabled: true })
    return result
  } catch {
    return Notification.permission
  }
}

export function triggerTerminalPushNotification(
  title: string,
  body: string,
  tag = "corder-waiter-call"
): void {
  if (typeof window === "undefined" || typeof Notification === "undefined") return
  if (Notification.permission !== "granted") return
  const options: NotificationOptions = {
    body,
    icon: "/corder-logo.png",
    badge: "/corder-logo.png",
    tag,
    silent: false,
  }
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg && typeof reg.showNotification === "function") {
          return reg.showNotification(title, options)
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
