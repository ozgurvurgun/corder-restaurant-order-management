export interface NotificationPrefs {
  waiterCallEnabled: boolean
  browserPushEnabled: boolean
}

const NOTIF_PREFS_KEY = "corder-panel-notification-prefs"

const DEFAULT_PREFS: NotificationPrefs = {
  waiterCallEnabled: true,
  browserPushEnabled: true,
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

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  if (Notification.permission === "granted") {
    saveNotificationPrefs({ browserPushEnabled: true })
    return "granted"
  }
  try {
    const perm = await Notification.requestPermission()
    if (perm === "granted") {
      saveNotificationPrefs({ browserPushEnabled: true })
    }
    return perm
  } catch {
    return Notification.permission
  }
}

export function showBrowserNotification(
  title: string,
  body: string,
  tag = `corder-${Date.now()}`,
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return
  const prefs = getNotificationPrefs()
  if (!prefs.browserPushEnabled || Notification.permission !== "granted") return

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
