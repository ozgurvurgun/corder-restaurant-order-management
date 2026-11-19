import { useState, useEffect } from "react"
import { Bell, Check, X, ShieldCheck } from "lucide-react"
import {
  getTerminalNotificationPrefs,
  getTerminalPushPermissionStatus,
  requestTerminalPushPermission,
  saveTerminalNotificationPrefs,
  triggerTerminalPushNotification,
  type ActiveWaiterCall,
  type TerminalNotificationPrefs,
} from "@/lib/terminal-notifications"

const WAITER_TOAST_DURATION_MS = 10_000

function WaiterCallToastItem(props: {
  call: ActiveWaiterCall
  onDismiss: (id: string) => void
}) {
  const { call, onDismiss } = props
  const [remainingMs, setRemainingMs] = useState(WAITER_TOAST_DURATION_MS)

  useEffect(() => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      const next = Math.max(0, WAITER_TOAST_DURATION_MS - elapsed)
      setRemainingMs(next)
      if (next <= 0) {
        window.clearInterval(timer)
        onDismiss(call.id)
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [call.id, onDismiss])

  const secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000))
  const progressPct = Math.max(0, Math.min(100, (remainingMs / WAITER_TOAST_DURATION_MS) * 100))
  const sectionLabel = call.sectionName || "Salon"
  const isBill = call.requestType === "bill"
  const actionText = isBill ? "Hesap İstiyor!" : "Garson Çağırıyor!"

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto relative overflow-hidden rounded-2xl bg-[#1d1d1f]/95 text-white shadow-2xl border border-white/15 backdrop-blur-md px-3.5 py-2.5 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isBill ? "bg-amber-500/20 text-amber-300" : "bg-[#e63462]/25 text-[#ff6b8b]"
            }`}
          >
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold leading-snug truncate">
              {call.tableName} ({sectionLabel}) - {actionText}
            </p>
            {call.note && (
              <p className="text-[11px] text-white/80 truncate mt-0.5">
                Not: {call.note}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="inline-flex items-center justify-center min-w-[34px] h-6 px-1.5 rounded-lg bg-white/10 text-[11px] font-bold tabular-nums text-amber-300">
            {secondsLeft}sn
          </span>
          <button
            type="button"
            onClick={() => onDismiss(call.id)}
            aria-label="Bildirimi kapat"
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 active:scale-95 transition-all"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className={`h-full transition-all duration-100 ease-linear ${
            isBill ? "bg-amber-400" : "bg-[#e63462]"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}

export function WaiterCallAlertBanner(props: {
  calls: ActiveWaiterCall[]
  onDismiss: (id: string) => void
}) {
  const { calls, onDismiss } = props
  if (calls.length === 0) return null

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[400px] z-[95] space-y-2 pointer-events-none">
      {calls.slice(0, 3).map((call) => (
        <WaiterCallToastItem key={call.id} call={call} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export function TerminalNotificationSettingsModal(props: {
  open: boolean
  onClose: () => void
}) {
  const { open, onClose } = props
  const [prefs, setPrefs] = useState<TerminalNotificationPrefs>(() =>
    getTerminalNotificationPrefs()
  )
  const [pushPerm, setPushPerm] = useState<NotificationPermission | "unsupported">(() =>
    getTerminalPushPermissionStatus()
  )

  useEffect(() => {
    if (open) {
      setPrefs(getTerminalNotificationPrefs())
      setPushPerm(getTerminalPushPermissionStatus())
    }
  }, [open])

  if (!open) return null

  const updatePref = (patch: Partial<TerminalNotificationPrefs>) => {
    const next = saveTerminalNotificationPrefs(patch)
    setPrefs(next)
  }

  const handlePushPermission = async () => {
    const status = await requestTerminalPushPermission()
    setPushPerm(status)
    if (status === "granted") {
      updatePref({ browserPushEnabled: true })
    }
  }

  const handleTestPush = async () => {
    let status = getTerminalPushPermissionStatus()
    if (status !== "granted") {
      status = await requestTerminalPushPermission()
      setPushPerm(status)
    }
    if (status === "granted") {
      updatePref({ browserPushEnabled: true })
      triggerTerminalPushNotification(
        "🔔 Masa 1 (Salon) - Garson Çağırıyor!",
        "Standart Push bildirimi aktif.",
        `corder-terminal-test-${Date.now()}`
      )
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Push Bildirim Ayarları"
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 bg-[#e63462] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h2 className="text-[16px] font-semibold">Push Bildirim Ayarları</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-1 rounded-lg hover:bg-white/15 active:opacity-70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold">Garson Çağrısı Bildirimleri</p>
              <p className="text-[12px] text-muted-foreground">
                QR menüden gelen masa çağrılarını göster
              </p>
            </div>
            <button
              type="button"
              onClick={() => updatePref({ enabled: !prefs.enabled })}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                prefs.enabled
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {prefs.enabled ? "Açık" : "Kapalı"}
            </button>
          </div>

          <div className="pt-3 border-t border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">Standart Push Bildirimleri</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {pushPerm === "granted"
                  ? prefs.browserPushEnabled
                    ? "Aktif"
                    : "İzinli (Kapalı)"
                  : pushPerm === "denied"
                    ? "Engellendi"
                    : pushPerm === "unsupported"
                      ? "Desteklenmiyor"
                      : "İzin Bekliyor"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Çağrılar cihazın standart Push bildirimi ve sistem bildirim sesi ile iletilir.
            </p>
            <button
              type="button"
              onClick={() => {
                if (pushPerm === "granted") {
                  updatePref({ browserPushEnabled: !prefs.browserPushEnabled })
                } else {
                  void handlePushPermission()
                }
              }}
              className="w-full py-2.5 px-3 rounded-xl border border-border bg-card hover:bg-muted/40 text-card-foreground font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
            >
              <ShieldCheck className="h-4 w-4 text-[#e63462]" />
              <span>
                {pushPerm === "granted"
                  ? prefs.browserPushEnabled
                    ? "Push Bildirimini Kapat"
                    : "Push Bildirimini Aç"
                  : "Push Bildirim İzni Ver"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleTestPush()}
              className="w-full py-2.5 px-3 rounded-xl bg-muted hover:bg-muted/80 text-card-foreground font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
            >
              <Bell className="h-4 w-4 text-[#e63462]" />
              <span>Test Push Bildirimi Gönder</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#e63462] text-white font-semibold text-[14px] active:opacity-90"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  )
}
