import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import { platform, type PlatformNotificationDto } from "@/lib/api"
import type {
  PlatformNotificationLevel,
  PlatformNotificationTargetApp,
} from "@/lib/types"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { CustomDateTimePicker } from "@/components/ui/custom-inputs"
import {
  LEVEL_OPTIONS,
  NotificationHistoryPanel,
} from "@/components/notifications/NotificationHistoryPanel"
import {
  Bell,
  Check,
  Clock,
  Crown,
  Megaphone,
  Search,
  Send,
  Store,
} from "lucide-react"

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function NotificationsPage() {
  const confirm = useConfirm()
  const location = useLocation()
  const preselectedRestId = useMemo(
    () => new URLSearchParams(location.search).get("restaurantId"),
    [location.search]
  )

  const { restaurants, loadRestaurants } = useAdminStore()
  const [notifications, setNotifications] = useState<PlatformNotificationDto[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [level, setLevel] = useState<PlatformNotificationLevel>("info")
  const [targetAppPreset, setTargetAppPreset] = useState<"both" | "merchant" | "boss">("both")
  const [venueScope, setVenueScope] = useState<"all" | "selected">(
    preselectedRestId ? "selected" : "all"
  )
  const [selectedRestIds, setSelectedRestIds] = useState<string[]>(
    preselectedRestId ? [preselectedRestId] : []
  )
  const [venueSearch, setVenueSearch] = useState("")
  const [deliveryMode, setDeliveryMode] = useState<"instant" | "scheduled">("instant")
  const [scheduledAtInput, setScheduledAtInput] = useState<string>(() =>
    toLocalDatetimeInputValue(new Date(Date.now() + 60 * 60 * 1000))
  )
  const [filterTab, setFilterTab] = useState<"all" | "scheduled" | "sent">("all")

  const showNotice = useCallback((text: string, type: "ok" | "err" = "ok") => {
    setNotice({ type, text })
    window.setTimeout(() => {
      setNotice((cur) => (cur?.text === text ? null : cur))
    }, 4000)
  }, [])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      setNotifications(await platform.notifications.list())
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Bildirimler yüklenemedi", "err")
    } finally {
      setLoading(false)
    }
  }, [showNotice])

  useEffect(() => {
    void loadRestaurants()
    void loadNotifications()
  }, [loadRestaurants, loadNotifications])

  useEffect(() => {
    if (preselectedRestId) {
      setVenueScope("selected")
      setSelectedRestIds((prev) =>
        prev.includes(preselectedRestId) ? prev : [...prev, preselectedRestId]
      )
    }
  }, [preselectedRestId])

  const filteredRestaurants = useMemo(() => {
    const q = venueSearch.trim().toLowerCase()
    if (!q) return restaurants
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.brandName ?? "").toLowerCase().includes(q)
    )
  }, [restaurants, venueSearch])

  const toggleRestaurant = (id: string) => {
    setSelectedRestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const applySchedulePreset = (minutesFromNow: number) => {
    setDeliveryMode("scheduled")
    setScheduledAtInput(
      toLocalDatetimeInputValue(new Date(Date.now() + minutesFromNow * 60 * 1000))
    )
  }

  const applyTomorrowMorningPreset = () => {
    setDeliveryMode("scheduled")
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    setScheduledAtInput(toLocalDatetimeInputValue(d))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      showNotice("Lütfen bildirim başlığı ve mesajını girin.", "err")
      return
    }
    if (venueScope === "selected" && selectedRestIds.length === 0) {
      showNotice("Lütfen bildirim gönderilecek en az bir mekan seçin.", "err")
      return
    }

    let scheduledIso: string | null = null
    if (deliveryMode === "scheduled") {
      const parsed = new Date(scheduledAtInput)
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        showNotice("Zamanlanmış bildirim için ileri bir tarih ve saat seçin.", "err")
        return
      }
      scheduledIso = parsed.toISOString()
    }

    const targetApps: PlatformNotificationTargetApp[] =
      targetAppPreset === "both"
        ? ["merchant", "boss"]
        : targetAppPreset === "merchant"
          ? ["merchant"]
          : ["boss"]

    setSubmitting(true)
    try {
      await platform.notifications.create({
        title: title.trim(),
        message: message.trim(),
        level,
        targetApps,
        targetRestaurantIds: venueScope === "all" ? [] : selectedRestIds,
        scheduledAt: scheduledIso,
      })
      setTitle("")
      setMessage("")
      await loadNotifications()
      showNotice(
        deliveryMode === "scheduled"
          ? "Zamanlanmış bildirim kuyruğa eklendi."
          : "Anlık bildirim hedef mekan ve uygulamalara iletildi."
      )
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Bildirim gönderilemedi", "err")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendNow = async (notif: PlatformNotificationDto) => {
    setBusyId(notif.id)
    try {
      await platform.notifications.sendNow(notif.id)
      await loadNotifications()
      showNotice(`"${notif.title}" bildirimi anında gönderildi.`)
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Gönderilemedi", "err")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (notif: PlatformNotificationDto) => {
    const isScheduled = notif.status === "scheduled"
    if (
      !(await confirm({
        title: isScheduled ? "Zamanlanmış Bildirimi İptal Et" : "Bildirim Kaydını Sil",
        message: `"${notif.title}" bildirimini ${isScheduled ? "iptal etmek ve silmek" : "geçmişten silmek"} istiyor musunuz?`,
        confirmLabel: isScheduled ? "İptal Et & Sil" : "Sil",
        variant: "danger",
      }))
    ) {
      return
    }
    setBusyId(notif.id)
    try {
      await platform.notifications.delete(notif.id)
      setNotifications((prev) => prev.filter((x) => x.id !== notif.id))
      showNotice("Bildirim kaydı silindi.")
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Silinemedi", "err")
    } finally {
      setBusyId(null)
    }
  }

  const visibleNotifications = useMemo(() => {
    if (filterTab === "scheduled") return notifications.filter((n) => n.status === "scheduled")
    if (filterTab === "sent") return notifications.filter((n) => n.status === "sent")
    return notifications
  }, [notifications, filterTab])

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] font-medium ${
            notice.type === "err"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-2xl border border-[#e5e5ea] bg-white p-5 space-y-4 self-start"
        >
          <div className="flex items-center gap-2.5 border-b border-[#f0f0f0] pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
                Anlık veya Zamanlanmış Bildirim Gönder
              </h2>
              <p className="text-[11px] text-[#86868b]">
                Seçtiğiniz mekanların Merchant Panel ve Corder Boss uygulamalarına bildirim iletin.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1.5">
              Hedef Uygulamalar
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {[
                { id: "both" as const, label: "Merchant + Boss", icon: Bell },
                { id: "merchant" as const, label: "Merchant Panel", icon: Store },
                { id: "boss" as const, label: "Corder Boss", icon: Crown },
              ].map((opt) => {
                const Icon = opt.icon
                const active = targetAppPreset === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTargetAppPreset(opt.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[12px] font-semibold transition-all ${
                      active
                        ? "border-[#e63462] bg-[#e63462]/10 text-[#e63462]"
                        : "border-[#e5e5ea] bg-[#f5f5f7]/70 text-[#636366] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-semibold text-[#1d1d1f]">Hedef Mekanlar</label>
              <div className="inline-flex rounded-lg bg-[#f5f5f7] p-0.5 border border-[#e5e5ea]">
                <button
                  type="button"
                  onClick={() => setVenueScope("all")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    venueScope === "all" ? "bg-white text-[#1d1d1f] shadow-xs" : "text-[#86868b]"
                  }`}
                >
                  Tüm Mekanlar ({restaurants.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVenueScope("selected")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    venueScope === "selected" ? "bg-white text-[#e63462] shadow-xs" : "text-[#86868b]"
                  }`}
                >
                  Seçili Mekanlar ({selectedRestIds.length})
                </button>
              </div>
            </div>

            {venueScope === "selected" && (
              <div className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7]/60 p-2.5 space-y-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-[#86868b] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={venueSearch}
                    onChange={(e) => setVenueSearch(e.target.value)}
                    placeholder="Mekan veya marka ara..."
                    className="w-full h-8 rounded-lg border border-[#d1d1d6] bg-white pl-8 pr-2.5 text-[12px] outline-none focus:border-[#e63462]"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {filteredRestaurants.map((r) => {
                    const checked = selectedRestIds.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRestaurant(r.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                          checked
                            ? "bg-[#e63462]/10 text-[#e63462] font-semibold"
                            : "bg-white hover:bg-[#f0f0f5] text-[#1d1d1f]"
                        }`}
                      >
                        <div className="min-w-0 truncate">
                          <span>{r.name}</span>
                          <span className="ml-1.5 text-[10px] text-[#86868b] font-mono">({r.slug})</span>
                        </div>
                        <div
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded ${
                            checked ? "bg-[#e63462] text-white" : "border border-[#d1d1d6]"
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1.5">
              Bildirim Türü / Önceliği
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {LEVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLevel(opt.value)}
                  className={`rounded-xl border px-3 py-2 text-[12px] font-semibold text-left transition-all ${
                    level === opt.value
                      ? "border-[#e63462] bg-[#e63462]/10 text-[#e63462]"
                      : "border-[#e5e5ea] bg-[#f5f5f7]/60 text-[#636366] hover:bg-[#f5f5f7]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1">Bildirim Başlığı</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Planlı Bakım Duyurusu / Yeni Özellik Yayında"
              className="w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1">Bildirim Mesajı</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mekan panelinde ve Boss uygulamasında görünecek bildirim metnini yazın..."
              className="w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] p-3 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white resize-none"
              required
            />
          </div>

          <div className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7]/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[#1d1d1f]">Gönderim Zamanı</span>
              <div className="inline-flex rounded-lg bg-white p-0.5 border border-[#e5e5ea]">
                <button
                  type="button"
                  onClick={() => setDeliveryMode("instant")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    deliveryMode === "instant" ? "bg-[#e63462] text-white" : "text-[#636366]"
                  }`}
                >
                  Anlık Gönder
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMode("scheduled")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    deliveryMode === "scheduled" ? "bg-[#e63462] text-white" : "text-[#636366]"
                  }`}
                >
                  Zamanlanmış
                </button>
              </div>
            </div>

            {deliveryMode === "scheduled" && (
              <div className="space-y-2 pt-1">
                <CustomDateTimePicker
                  value={scheduledAtInput}
                  onChange={(e) => setScheduledAtInput(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[#d1d1d6] bg-white px-2.5 text-[12px] text-[#1d1d1f]"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "+15 Dakika", mins: 15 },
                    { label: "+1 Saat", mins: 60 },
                    { label: "+3 Saat", mins: 180 },
                  ].map((p) => (
                    <button
                      key={p.mins}
                      type="button"
                      onClick={() => applySchedulePreset(p.mins)}
                      className="rounded-lg border border-[#d1d1d6] bg-white px-2 py-1 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f0f0f5]"
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={applyTomorrowMorningPreset}
                    className="rounded-lg border border-[#d1d1d6] bg-white px-2 py-1 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f0f0f5]"
                  >
                    Yarın 09:00
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-xl bg-[#e63462] hover:bg-[#d42d56] disabled:opacity-50 text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {deliveryMode === "scheduled" ? (
              <>
                <Clock className="h-4 w-4" />
                {submitting ? "Zamanlanıyor..." : "Bildirimi Zamanla"}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {submitting ? "Gönderiliyor..." : "Anlık Bildirimi Gönder"}
              </>
            )}
          </button>
        </form>

        <NotificationHistoryPanel
          notifications={visibleNotifications}
          filterTab={filterTab}
          onFilterChange={setFilterTab}
          loading={loading}
          busyId={busyId}
          onRefresh={() => void loadNotifications()}
          onSendNow={(n) => void handleSendNow(n)}
          onDelete={(n) => void handleDelete(n)}
        />
      </div>
    </div>
  )
}
