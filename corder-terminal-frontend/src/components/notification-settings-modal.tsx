import { useState, useEffect } from "react"
import { Bell, X, ShieldCheck } from "lucide-react"
import {
  getTerminalNotificationPrefs,
  getTerminalPushPermissionStatus,
  requestTerminalPushPermission,
  saveTerminalNotificationPrefs,
  syncTerminalWebPushSubscription,
  triggerTerminalPushNotification,
  type TerminalNotificationPrefs,
} from "@/lib/terminal-notifications"

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
      void syncTerminalWebPushSubscription()
    }
  }, [open])

  useEffect(() => {
    const onPermChange = () => setPushPerm(getTerminalPushPermissionStatus())
    window.addEventListener("corder:terminal-push-permission", onPermChange)
    return () => window.removeEventListener("corder:terminal-push-permission", onPermChange)
  }, [])

  if (!open) return null

  const updatePref = (patch: Partial<TerminalNotificationPrefs>) => {
    const next = saveTerminalNotificationPrefs(patch)
    setPrefs(next)
  }

  const handleTogglePush = async () => {
    if (pushPerm !== "granted") {
      const status = await requestTerminalPushPermission()
      setPushPerm(status)
      if (status === "granted") {
        updatePref({ enabled: true, browserPushEnabled: true })
      }
      return
    }
    const nextActive = !(prefs.enabled && prefs.browserPushEnabled)
    updatePref({ enabled: nextActive, browserPushEnabled: nextActive })
    if (nextActive) {
      void syncTerminalWebPushSubscription()
    }
  }

  const handleTestPush = async () => {
    let status = getTerminalPushPermissionStatus()
    if (status !== "granted") {
      status = await requestTerminalPushPermission()
      setPushPerm(status)
    }
    if (status === "granted") {
      updatePref({ enabled: true, browserPushEnabled: true })
      void syncTerminalWebPushSubscription()
      triggerTerminalPushNotification(
        "🔔 Masa 1 (Salon) - Garson Çağırıyor!",
        "Native Push bildirimi sorunsuz çalışıyor.",
        `corder-terminal-test-${Date.now()}`
      )
    }
  }

  const isPushActive = pushPerm === "granted" && prefs.enabled && prefs.browserPushEnabled

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
              <p className="text-[14px] font-semibold">Native Push Bildirimleri</p>
              <p className="text-[12px] text-muted-foreground">
                QR menü garson ve hesap çağrılarını sistem Push bildirimi olarak ilet
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleTogglePush()}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                isPushActive
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isPushActive ? "Açık" : "Kapalı"}
            </button>
          </div>

          <div className="pt-3 border-t border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">Cihaz İzin Durumu</span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  isPushActive
                    ? "bg-emerald-500/15 text-emerald-700"
                    : pushPerm === "denied"
                      ? "bg-red-500/15 text-red-700"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {pushPerm === "granted"
                  ? isPushActive
                    ? "Aktif"
                    : "İzinli (Kapalı)"
                  : pushPerm === "denied"
                    ? "Tarayıcıda Engellendi"
                    : pushPerm === "unsupported"
                      ? "Desteklenmiyor"
                      : "İzin Bekliyor"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {pushPerm === "denied"
                ? "Tarayıcı adres çubuğundaki kilit ikonundan Bildirimler iznini 'İzin Ver' olarak değiştirin."
                : "Çağrılar uygulama içi toast olmadan doğrudan cihazın kendi Push bildirim sistemi ve sesi ile gösterilir."}
            </p>
            <button
              type="button"
              onClick={() => void handleTogglePush()}
              className="w-full py-2.5 px-3 rounded-xl border border-border bg-card hover:bg-muted/40 text-card-foreground font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
            >
              <ShieldCheck className="h-4 w-4 text-[#e63462]" />
              <span>
                {pushPerm === "granted"
                  ? isPushActive
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
