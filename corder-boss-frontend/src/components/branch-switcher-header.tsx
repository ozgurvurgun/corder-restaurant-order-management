import { useEffect, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import type { BossTabId } from "@/lib/types"
import {
  Building2,
  ChevronDown,
  Layers,
  LogOut,
  RefreshCw,
  Check,
  Smartphone,
  X,
} from "lucide-react"

const TAB_TITLES: Record<BossTabId, string> = {
  dashboard: "Ana Sayfa",
  permissions: "Rol & Yetki Yönetimi",
  staff: "Kullanıcılar & Şube Yöneticileri",
  analytics: "Analiz & Denetim Kayıtları",
  operations: "Canlı Operasyon & Menü",
}

export function BranchSwitcherHeader({ activeTab = "dashboard" }: { activeTab?: BossTabId }) {
  const {
    user,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    effectiveBranch,
    loading,
    refreshAll,
    logout,
  } = useBossStore()
  const [openSheet, setOpenSheet] = useState(false)
  const [showPwaInfo, setShowPwaInfo] = useState(false)

  useEffect(() => {
    if (!openSheet && !showPwaInfo) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenSheet(false)
        setShowPwaInfo(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openSheet, showPwaInfo])

  const currentLabel =
    selectedBranchId === "ALL"
      ? `Tüm Şubeler (${branches.length})`
      : (effectiveBranch?.name ?? "Şube Seçin")

  return (
    <>
      <header className="h-[52px] flex items-center justify-between gap-4 px-4 sm:px-6 border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl flex-shrink-0 sticky top-0 z-30 safe-top">
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

          <button
            type="button"
            onClick={() => setShowPwaInfo(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]/70 text-[#636366] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
            title="PWA Uygulama Kurulumu"
          >
            <Smartphone className="h-4 w-4 text-[#e63462]" />
          </button>

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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setOpenSheet(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl border border-[#e5e5ea] safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3.5">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  Dükkan / Şube Seçimi
                </h3>
                <p className="text-[12px] text-[#86868b]">
                  {user?.name} — {branches.length} kayıtlı şube
                </p>
              </div>
              <button
                onClick={() => setOpenSheet(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed]"
              >
                <X className="h-4 w-4 text-[#86868b]" />
              </button>
            </div>

            <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-2">
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

      {/* PWA Install Modal */}
      {showPwaInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setShowPwaInfo(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-[#e5e5ea]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e63462]/10 text-[#e63462]">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f]">
                    Corder Boss Mobil PWA
                  </h4>
                  <p className="text-[11px] text-[#86868b]">Ana Ekrana Kurulum</p>
                </div>
              </div>
              <button
                onClick={() => setShowPwaInfo(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7]"
              >
                <X className="h-3.5 w-3.5 text-[#86868b]" />
              </button>
            </div>
            <div className="space-y-2.5 text-[12px] text-[#1d1d1f] leading-relaxed">
              <p className="rounded-xl bg-[#f5f5f7] p-3">
                <span className="font-semibold">iPhone / iOS (Safari):</span> Alt bardaki{" "}
                <span className="font-medium text-[#e63462]">Paylaş</span> simgesine
                dokunun ve{" "}
                <span className="font-medium text-[#e63462]">
                  &ldquo;Ana Ekrana Ekle&rdquo;
                </span>{" "}
                seçeneğini seçin.
              </p>
              <p className="rounded-xl bg-[#f5f5f7] p-3">
                <span className="font-semibold">Android (Chrome):</span> Sağ üstteki üç nokta
                menüsünden{" "}
                <span className="font-medium text-[#e63462]">
                  &ldquo;Ana ekrana ekle / Uygulamayı yükle&rdquo;
                </span>{" "}
                seçeneğine dokunun.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
