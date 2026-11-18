export const TERMINAL_NOTIF_PREFS_KEY = "corder_terminal_notif_prefs_v1"

export interface TerminalNotificationPrefs {
  enabled: boolean
  soundEnabled: boolean
  volume: number
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
  soundEnabled: true,
  volume: 0.85,
  browserPushEnabled: false,
}

export function getTerminalNotificationPrefs(): TerminalNotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(TERMINAL_NOTIF_PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<TerminalNotificationPrefs>
    const volume =
      typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
        ? Math.min(1, Math.max(0, parsed.volume))
        : DEFAULT_PREFS.volume
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_PREFS.enabled,
      soundEnabled:
        typeof parsed.soundEnabled === "boolean" ? parsed.soundEnabled : DEFAULT_PREFS.soundEnabled,
      volume,
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
    volume:
      typeof prefs.volume === "number" && Number.isFinite(prefs.volume)
        ? Math.min(1, Math.max(0, prefs.volume))
        : current.volume,
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

let sharedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new Ctx()
  }
  return sharedAudioCtx
}

export function playTerminalWaiterChime(volume = 0.85): void {
  const clampedVol = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.85))
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate([160, 80, 220])
    } catch {
      // Ignore vibration permission error
    }
  }
  if (clampedVol <= 0.01) return

  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined)

    const now = ctx.currentTime
    const notes = [
      { freq: 659.25, start: 0, duration: 0.22, gain: 0.45 },
      { freq: 880.0, start: 0.14, duration: 0.28, gain: 0.52 },
      { freq: 1174.66, start: 0.29, duration: 0.48, gain: 0.6 },
      { freq: 1318.51, start: 0.44, duration: 0.65, gain: 0.5 },
    ]
    for (const note of notes) {
      const osc = ctx.createOscillator()
      const overtone = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.type = "triangle"
      osc.frequency.setValueAtTime(note.freq, now + note.start)
      overtone.type = "sine"
      overtone.frequency.setValueAtTime(note.freq * 2, now + note.start)
      const peak = Math.max(0.001, note.gain * clampedVol)
      gainNode.gain.setValueAtTime(0.0001, now + note.start)
      gainNode.gain.exponentialRampToValueAtTime(peak, now + note.start + 0.018)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration)
      osc.connect(gainNode)
      overtone.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.start(now + note.start)
      overtone.start(now + note.start)
      osc.stop(now + note.start + note.duration + 0.02)
      overtone.stop(now + note.start + note.duration + 0.02)
    }
  } catch {
    // Ignore Web Audio autoplay block
  }
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
  }
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg && typeof reg.showNotification === "function") return reg.showNotification(title, options)
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
    tableName: tableName || "Masa",
    sectionName:
      typeof obj.sectionName === "string" && obj.sectionName.trim() ? obj.sectionName.trim() : null,
    requestType: obj.requestType === "bill" ? "bill" : "waiter",
    note: typeof obj.note === "string" && obj.note.trim() ? obj.note.trim() : null,
    createdAt:
      typeof obj.createdAt === "string" && obj.createdAt.trim()
        ? obj.createdAt
        : new Date().toISOString(),
  }
}
