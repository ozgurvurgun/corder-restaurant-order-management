import type { PlatformNotificationDto } from "@/lib/api"
import type { PlatformNotificationLevel } from "@/lib/types"
import {
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  Crown,
  RefreshCw,
  Send,
  Store,
  Trash2,
} from "lucide-react"

export const LEVEL_OPTIONS: Array<{
  value: PlatformNotificationLevel
  label: string
  badgeClass: string
}> = [
  { value: "info", label: "Bilgi & Duyuru", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "success", label: "Güncelleme & Kampanya", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "warning", label: "Önemli Uyarı", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "urgent", label: "Acil Bildirim", badgeClass: "bg-red-50 text-red-700 border-red-200" },
]

export function formatDateTimeTr(iso: string | null): string {
  if (!iso) return "-"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "-"
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

interface NotificationHistoryPanelProps {
  notifications: PlatformNotificationDto[]
  filterTab: "all" | "scheduled" | "sent"
  onFilterChange: (tab: "all" | "scheduled" | "sent") => void
  loading: boolean
  busyId: string | null
  onRefresh: () => void
  onSendNow: (notif: PlatformNotificationDto) => void
  onDelete: (notif: PlatformNotificationDto) => void
}

export function NotificationHistoryPanel({
  notifications,
  filterTab,
  onFilterChange,
  loading,
  busyId,
  onRefresh,
  onSendNow,
  onDelete,
}: NotificationHistoryPanelProps) {
  return (
    <div className="lg:col-span-7 rounded-2xl border border-[#e5e5ea] bg-white p-5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f0f0] pb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
            Bildirim Kuyruğu &amp; Gönderim Geçmişi ({notifications.length})
          </h3>
          <p className="text-[11px] text-[#86868b]">
            Zamanlanmış bildirimler vakti geldiğinde otomatik olarak hedef mekanlara ve Boss uygulamasına iletilir.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-xl bg-[#f5f5f7] p-0.5 border border-[#e5e5ea]">
            {[
              { id: "all" as const, label: "Tümü" },
              { id: "scheduled" as const, label: "Zamanlanmış" },
              { id: "sent" as const, label: "Gönderilen" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onFilterChange(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  filterTab === tab.id
                    ? "bg-white text-[#1d1d1f] shadow-xs"
                    : "text-[#86868b]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] text-[#636366] hover:text-[#1d1d1f]"
            title="Listeyi Yenile"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#e63462]" : ""}`} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="h-8 w-8 text-[#d1d1d6] mx-auto mb-2" />
            <p className="text-[13px] text-[#86868b]">
              Henüz bildirim kaydı bulunmuyor.
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const isScheduled = n.status === "scheduled"
            const levelMeta =
              LEVEL_OPTIONS.find((l) => l.value === n.level) ?? LEVEL_OPTIONS[0]
            return (
              <div
                key={n.id}
                className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isScheduled ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        <Clock className="h-3 w-3" />
                        Zamanlandı: {formatDateTimeTr(n.scheduledAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Gönderildi: {formatDateTimeTr(n.sentAt || n.createdAt)}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${levelMeta.badgeClass}`}
                    >
                      {levelMeta.label}
                    </span>
                    {n.targetApps.includes("merchant") && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white border border-[#e5e5ea] px-2 py-0.5 text-[10px] font-semibold text-[#1d1d1f]">
                        <Store className="h-3 w-3 text-[#e63462]" />
                        Merchant Panel
                      </span>
                    )}
                    {n.targetApps.includes("boss") && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white border border-[#e5e5ea] px-2 py-0.5 text-[10px] font-semibold text-[#1d1d1f]">
                        <Crown className="h-3 w-3 text-[#e63462]" />
                        Corder Boss
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isScheduled && (
                      <button
                        type="button"
                        disabled={busyId === n.id}
                        onClick={() => onSendNow(n)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#e63462] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
                      >
                        <Send className="h-3 w-3" />
                        Şimdi Gönder
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === n.id}
                      onClick={() => onDelete(n)}
                      className="inline-flex items-center justify-center rounded-lg bg-white border border-[#e5e5ea] p-1.5 text-[#86868b] hover:text-red-600 hover:border-red-200"
                      title="Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-[13px] font-semibold text-[#1d1d1f]">
                    {n.title}
                  </h4>
                  <p className="text-[12px] text-[#636366] mt-0.5 whitespace-pre-line">
                    {n.message}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#efefef]">
                  <Building2 className="h-3.5 w-3.5 text-[#86868b]" />
                  {n.isAllRestaurants ? (
                    <span className="text-[11px] font-medium text-[#1d1d1f]">
                      Tüm Aktif Mekanlar
                    </span>
                  ) : (
                    n.targetRestaurants.map((r) => (
                      <span
                        key={r.id}
                        className="rounded-md bg-white border border-[#e5e5ea] px-2 py-0.5 text-[11px] font-medium text-[#1d1d1f]"
                      >
                        {r.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
