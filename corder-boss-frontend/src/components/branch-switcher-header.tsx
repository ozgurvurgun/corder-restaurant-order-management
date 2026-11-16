import { useEffect, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import {
  Building2,
  ChevronDown,
  Crown,
  Layers,
  LogOut,
  RefreshCw,
  Check,
  Smartphone,
  X,
} from "lucide-react"

export function BranchSwitcherHeader() {
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
      <header className="sticky top-0 z-30 border-b border-[#d1d1d6]/60 bg-white/85 backdrop-blur-2xl safe-top">
        <div className="mx-auto flex h-[58px] max-w-5xl items-center justify-between px-4">
          {/* Brand + Active Branch Selector */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e63462] to-[#7b2d8e] text-white shadow-sm">
              <Crown className="h-4 w-4" />
            </div>

            <button
              type="button"
              onClick={() => setOpenSheet(true)}
              className="flex items-center gap-2 rounded-xl border border-[#d1d1d6]/70 bg-[#f5f5f7] px-3 py-1.5 text-left active:scale-[0.98] hover:bg-[#ebebf0] transition-all min-w-0"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b] leading-none">
                  {selectedBranchId === "ALL" ? "Konsolide Görünüm" : "Aktif Şube"}
                </p>
                <p className="truncate text-[13px] font-bold text-[#1d1d1f] leading-tight mt-0.5 max-w-[165px] sm:max-w-[260px]">
                  {currentLabel}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#86868b]" />
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowPwaInfo(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors"
              title="PWA Uygulama Kurulumu"
            >
              <Smartphone className="h-4 w-4 text-[#e63462]" />
            </button>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors"
              title="Verileri Yenile"
            >
              <RefreshCw className={`h-4 w-4 text-[#1d1d1f] ${loading ? "animate-spin text-[#e63462]" : ""}`} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7] text-[#86868b] hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Çıkış Yap"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Branch Switcher Bottom Sheet / Modal */}
      {openSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setOpenSheet(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3.5">
              <div>
                <h3 className="text-[16px] font-bold text-[#1d1d1f]">
                  Dükkan / Şube Seçimi
                </h3>
                <p className="text-[12px] text-[#86868b]">
                  {user?.name} — {branches.length} kayıtlı şube
                </p>
              </div>
              <button
                onClick={() => setOpenSheet(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7]"
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
                  className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                    selectedBranchId === "ALL"
                      ? "border-[#e63462] bg-[#e63462]/8"
                      : "border-[#e5e5ea] bg-[#f5f5f7]/60 hover:bg-[#f5f5f7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e63462] text-white">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-[#1d1d1f]">
                        Tüm Şubeler (Konsolide)
                      </p>
                      <p className="text-[11px] text-[#86868b]">
                        {branches.length} şubenin toplam ciro ve kıyaslama raporu
                      </p>
                    </div>
                  </div>
                  {selectedBranchId === "ALL" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e63462] text-white">
                      <Check className="h-3.5 w-3.5" />
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
                    className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-[#e63462] bg-[#e63462]/8"
                        : "border-[#e5e5ea] bg-white hover:bg-[#f5f5f7]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                          isSelected
                            ? "bg-[#e63462] text-white"
                            : "bg-[#f5f5f7] text-[#1d1d1f]"
                        }`}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-[#1d1d1f]">
                          {br.name}
                        </p>
                        <p className="truncate text-[11px] text-[#86868b]">
                          {br.address || br.slug}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#e63462] text-white">
                        <Check className="h-3.5 w-3.5" />
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
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-[#1d1d1f]">
                    Corder Boss Mobil PWA
                  </h4>
                  <p className="text-[11px] text-[#86868b]">Ana Ekrana Kurulum</p>
                </div>
              </div>
              <button
                onClick={() => setShowPwaInfo(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f5f7]"
              >
                <X className="h-3.5 w-3.5 text-[#86868b]" />
              </button>
            </div>
            <div className="space-y-2.5 text-[12px] text-[#1d1d1f] leading-relaxed">
              <p className="rounded-xl bg-[#f5f5f7] p-3">
                <strong>iPhone / iOS (Safari):</strong> Alt bardaki{" "}
                <span className="font-semibold text-[#e63462]">Paylaş</span> simgesine
                dokunun ve{" "}
                <span className="font-semibold text-[#e63462]">
                  &ldquo;Ana Ekrana Ekle&rdquo;
                </span>{" "}
                seçeneğini seçin.
              </p>
              <p className="rounded-xl bg-[#f5f5f7] p-3">
                <strong>Android (Chrome):</strong> Sağ üst menüden{" "}
                <span className="font-semibold text-[#e63462]">
                  &ldquo;Uygulamayı Yükle&rdquo;
                </span>{" "}
                veya{" "}
                <span className="font-semibold text-[#e63462]">
                  &ldquo;Ana Ekrana Ekle&rdquo;
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

