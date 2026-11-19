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

export function WaiterCallAlertBanner(props: {
  calls: ActiveWaiterCall[]
  onDismiss: (id: string) => void
}) {
  const { calls, onDismiss } = props
  if (calls.length === 0) return null

  return (
    <div className="bg-amber-500 text-white px-3 py-2 space-y-2 shadow-lg z-[55] border-b border-amber-600/30">
      {calls.slice(0, 3).map((call) => {
        const sectionLabel = call.sectionName || "Salon"
        const actionText =
          call.requestType === "bill" ? "Hesap İstiyor!" : "Garson Çağırıyor!"
        return (
          <div
            key={call.id}
            className="flex items-center justify-between gap-2 bg-black/15 rounded-xl px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-snug">
                🔔 {call.tableName} ({sectionLabel}) - {actionText}
              </p>
              {call.note && (
                <p className="text-[11px] text-white/90 truncate mt-0.5">
                  Not: {call.note}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(call.id)}
              className="flex-shrink-0 inline-flex items-center gap-1 bg-white text-amber-900 font-bold text-[12px] px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-transform"
            >
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>İlgilenildi / Tamam</span>
            </button>
          </div>
        )
      })}
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
