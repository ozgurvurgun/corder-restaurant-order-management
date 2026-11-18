export interface NotificationPrefs {
  waiterCallEnabled: boolean
  soundEnabled: boolean
  volume: number
  browserPushEnabled: boolean
}

const NOTIF_PREFS_KEY = "corder-panel-notification-prefs"

const DEFAULT_PREFS: NotificationPrefs = {
  waiterCallEnabled: true,
  soundEnabled: true,
  volume: 0.75,
  browserPushEnabled: false,
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
      soundEnabled:
        typeof parsed.soundEnabled === "boolean"
          ? parsed.soundEnabled
          : DEFAULT_PREFS.soundEnabled,
      volume:
        typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
          ? Math.min(1, Math.max(0.05, parsed.volume))
          : DEFAULT_PREFS.volume,
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

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctx) return null
  try {
    return new Ctx()
  } catch {
    return null
  }
}

export function playWaiterCallChime(overrideVolume?: number): void {
  const prefs = getNotificationPrefs()
  if (overrideVolume === undefined && !prefs.soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  const vol = Math.min(1, Math.max(0.05, overrideVolume ?? prefs.volume))
  const now = ctx.currentTime
  // Pleasant 3-tone restaurant service bell chime (C5 -> E5 -> G5 -> C6)
  const notes = [
    { freq: 523.25, start: 0, duration: 0.22 },
    { freq: 659.25, start: 0.14, duration: 0.24 },
    { freq: 783.99, start: 0.28, duration: 0.28 },
    { freq: 1046.5, start: 0.44, duration: 0.55 },
  ]

  for (const n of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(n.freq, now + n.start)

    gain.gain.setValueAtTime(0.0001, now + n.start)
    gain.gain.exponentialRampToValueAtTime(vol * 0.35, now + n.start + 0.025)
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + n.start + n.duration,
    )

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + n.start)
    osc.stop(now + n.start + n.duration + 0.02)
  }

  setTimeout(() => {
    void ctx.close().catch(() => {})
  }, 1200)
}

export function playSecurityAlertChime(overrideVolume?: number): void {
  const prefs = getNotificationPrefs()
  if (overrideVolume === undefined && !prefs.soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  const vol = Math.min(1, Math.max(0.05, overrideVolume ?? prefs.volume))
  const now = ctx.currentTime
  // Urgent 2-pulse alert tone (A5 -> F5)
  const notes = [
    { freq: 880, start: 0, duration: 0.18 },
    { freq: 698.46, start: 0.2, duration: 0.25 },
    { freq: 880, start: 0.48, duration: 0.18 },
    { freq: 698.46, start: 0.68, duration: 0.3 },
  ]

  for (const n of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(n.freq, now + n.start)

    gain.gain.setValueAtTime(0.0001, now + n.start)
    gain.gain.exponentialRampToValueAtTime(vol * 0.4, now + n.start + 0.02)
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + n.start + n.duration,
    )

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + n.start)
    osc.stop(now + n.start + n.duration + 0.02)
  }

  setTimeout(() => {
    void ctx.close().catch(() => {})
  }, 1200)
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

export function showBrowserNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return
  const prefs = getNotificationPrefs()
  if (!prefs.browserPushEnabled || Notification.permission !== "granted") return
  try {
    new Notification(title, {
      body,
      icon: "/corder-logo.png",
      tag: `corder-${Date.now()}`,
    })
  } catch {
    // ignore browser notification errors
  }
}
