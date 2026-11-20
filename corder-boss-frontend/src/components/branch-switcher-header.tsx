import { useEffect, useRef, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import { formatIstanbulDateTime } from "@/lib/format"
import type { BossTabId } from "@/lib/types"
import {
  Bell,
  Building2,
  ChevronDown,
  Layers,
  LogOut,
  Megaphone,
  RefreshCw,
  Check,
  X,
} from "lucide-react"

const TAB_TITLES: Record<BossTabId, string> = {
  dashboard: "Ana Sayfa",
  permissions: "Rol & Yetki Yönetimi",
  staff: "Kullanıcılar & Şube Yöneticileri",
  analytics: "Analiz & Denetim Kayıtları",
  operations: "Canlı Operasyon & Menü",
  security: "Güvenlik & Kaçak Tespiti",
}

export function BranchSwitcherHeader({ activeTab = "dashboard" }: { activeTab?: BossTabId }) {
  const {
    user,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    effectiveBranch,
    platformNotifications,
    markPlatformNotificationRead,
    clearPlatformNotifications,
    loading,
    refreshAll,
    logout,
  } = useBossStore()
  const [openSheet, setOpenSheet] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const unreadNotifCount = platformNotifications.filter((n) => !n.read).length

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  useEffect(() => {
    if (!openSheet && !showNotifs) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenSheet(false)
        setShowNotifs(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openSheet, showNotifs])

  const currentLabel =
    selectedBranchId === "ALL"
      ? `Tüm Şubeler (${branches.length})`
      : (effectiveBranch?.name ?? "Şube Seçin")

  return (
    <>
      <header className="h-[52px] flex items-center justify-between gap-4 px-4 sm:px-6 border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl flex-shrink-0 sticky top-0 z-30">
        {/* Left: Page Title & Context */}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[16px] font-semibold text-[#1d1d1f] truncate">
            {TAB_TITLES[activeTab]}
          </h1>
          <span className="hidden sm:inline text-[#d1d1d6]">•</span>
          <span className="hidden sm:inline text-[12px] text-[#86868b] truncate">
            {currentLabel}
          </span>
        </div>

        {/* Right: Branch Selector & Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenSheet(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]/70 hover:bg-[#f5f5f7] text-[12px] font-medium text-[#1d1d1f] transition-colors min-w-0"
          >
            <Building2 className="h-3.5 w-3.5 text-[#e63462] flex-shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[220px]">
              {currentLabel}
            </span>
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[#86868b]" />
          </button>

          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setShowNotifs((v) => !v)}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]/70 text-[#636366] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              title="Platform Bildirimleri"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#e63462] px-1 text-[10px] font-bold text-white">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="fixed left-3 right-3 top-[58px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 rounded-2xl border border-[#e5e5ea] bg-white shadow-2xl overflow-hidden z-50">
                <div className="flex items-center justify-between border-b border-[#e5e5ea] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-[#e63462]" />
                    <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                      Bildirimler
                    </h3>
                  </div>
                  {platformNotifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearPlatformNotifications()}
                      className="text-[12px] font-medium text-[#e63462] hover:underline"
                    >
                      Tümünü Temizle
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-[#f0f0f0]">
                  {platformNotifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell className="h-7 w-7 text-[#d1d1d6] mx-auto mb-2" />
                      <p className="text-[12px] text-[#86868b]">Yeni bildirim bulunmuyor</p>
                    </div>
                  ) : (
                    platformNotifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markPlatformNotificationRead(n.id)}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[#f5f5f7] transition-colors ${
                          !n.read ? "bg-[#e63462]/[0.04]" : ""
                        }`}
                      >
                        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#e63462]/10 text-[#e63462]">
                          <Megaphone className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-[13px] text-[#1d1d1f] truncate ${!n.read ? "font-semibold" : "font-medium"}`}>
                              {n.title}
                            </p>
                            {!n.read && (
                              <span className="h-2 w-2 rounded-full bg-[#e63462] flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[12px] text-[#636366] leading-snug mt-0.5 whitespace-pre-line">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-[#aeaeb2] mt-1">
                            {formatIstanbulDateTime(n.sentAt || n.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void refreshAll()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]/70 text-[#636366] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
            title="Verileri Yenile"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#e63462]" : ""}`} />
          </button>

          <button
            type="button"
            onClick={logout}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]/70 text-[#86868b] hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Çıkış Yap"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Branch Switcher Modal */}
      {openSheet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setOpenSheet(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#e5e5ea]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3.5">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  Dükkan / Şube Seçimi
                </h3>
                <p className="text-[12px] text-[#86868b]">
                  {user?.name} - {branches.length} kayıtlı şube
                </p>
              </div>
              <button
                onClick={() => setOpenSheet(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed]"
              >
                <X className="h-4 w-4 text-[#86868b]" />
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-2.5">
              {branches.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBranchId("ALL")
                    setOpenSheet(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                    selectedBranchId === "ALL"
                      ? "border-[#e63462] bg-[#e63462]/8"
                      : "border-[#e5e5ea] bg-[#f5f5f7]/60 hover:bg-[#f5f5f7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e63462] text-white">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">
                        Tüm Şubeler (Konsolide)
                      </p>
                      <p className="text-[11px] text-[#86868b]">
                        {branches.length} şubenin toplam ciro ve kıyaslama raporu
                      </p>
                    </div>
                  </div>
                  {selectedBranchId === "ALL" && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e63462] text-white">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              )}

              {branches.map((br) => {
                const isSelected = selectedBranchId === br.id
                return (
                  <button
                    key={br.id}
                    type="button"
                    onClick={() => {
                      setSelectedBranchId(br.id)
                      setOpenSheet(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-[#e63462] bg-[#e63462]/8"
                        : "border-[#e5e5ea] bg-white hover:bg-[#f5f5f7]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-[#e63462] text-white"
                            : "bg-[#f5f5f7] text-[#1d1d1f]"
                        }`}
                      >
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#1d1d1f]">
                          {br.name}
                        </p>
                        <p className="truncate text-[11px] text-[#86868b]">
                          {br.address || br.slug}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#e63462] text-white">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
