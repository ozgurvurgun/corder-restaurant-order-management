import { useEffect, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import { bossApi } from "@/lib/api"
import type { SubBossItemDto } from "@/lib/types"
import { Building2, Crown, Plus, X } from "lucide-react"

export function SubBossesSection() {
  const { branches, effectiveBranchId, showToast } = useBossStore()

  const [subBosses, setSubBosses] = useState<SubBossItemDto[]>([])
  const [showSubBossModal, setShowSubBossModal] = useState(false)
  const [sbName, setSbName] = useState("")
  const [sbEmail, setSbEmail] = useState("")
  const [sbPhone, setSbPhone] = useState("")
  const [sbPassword, setSbPassword] = useState("")
  const [sbTier, setSbTier] = useState<"franchise_owner" | "regional_manager">("franchise_owner")
  const [sbBranchIds, setSbBranchIds] = useState<string[]>([])
  const [sbSubmitting, setSbSubmitting] = useState(false)

  useEffect(() => {
    bossApi.overview
      .listSubBosses()
      .then(setSubBosses)
      .catch(() => {})
  }, [effectiveBranchId])

  const handleCreateSubBoss = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sbName.trim() || !sbEmail.trim() || sbBranchIds.length === 0) {
      showToast("Ad, e-posta ve en az bir şube seçimi zorunludur", "error")
      return
    }
    setSbSubmitting(true)
    try {
      const updated = await bossApi.overview.createSubBoss({
        name: sbName.trim(),
        email: sbEmail.trim(),
        phone: sbPhone.trim() || undefined,
        password: sbPassword || undefined,
        bossTier: sbTier,
        restaurantIds: sbBranchIds,
      })
      setSubBosses(updated)
      setShowSubBossModal(false)
      setSbName("")
      setSbEmail("")
      setSbPhone("")
      setSbPassword("")
      showToast(`${sbName.trim()} Şube / Franchise Boss olarak atandı`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Şube Boss eklenemedi", "error")
    } finally {
      setSbSubmitting(false)
    }
  }

  const handleUnlinkSubBoss = async (subBossId: string, branchId: string, name: string) => {
    if (!confirm(`${name} hesabının bu şube ile bağlantısını kaldırmak istiyor musunuz?`)) return
    try {
      const updated = await bossApi.overview.unlinkSubBoss(subBossId, branchId)
      setSubBosses(updated)
      showToast("Şube bağlantısı kaldırıldı")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Kaldırılamadı", "error")
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-[#e63462]" />
              <h2 className="text-[15px] font-bold text-[#1d1d1f]">
                Şube &amp; Franchise Sahibi (Şube Boss) Hesapları
              </h2>
            </div>
            <p className="mt-0.5 text-[12px] text-[#86868b]">
              Her şubenin veya franchise dükkanının kendi Boss&apos;u olabilir. Şube Boss&apos;u kendi dükkanının cirosunu, metriklerini görür ve kendi personelini/yetkilerini yönetir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSbBranchIds(effectiveBranchId ? [effectiveBranchId] : [])
              setShowSubBossModal(true)
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-3.5 text-[12px] font-bold text-white hover:bg-black/80"
          >
            <Plus className="h-4 w-4" />
            Şube / Franchise Boss Ata
          </button>
        </div>

        {subBosses.length > 0 && (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {subBosses.map((sb) => (
              <div
                key={sb.id}
                className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3 flex items-start justify-between gap-2"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-bold text-[#1d1d1f]">{sb.name}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                        sb.bossTier === "brand_owner"
                          ? "bg-purple-100 text-purple-800"
                          : sb.bossTier === "regional_manager"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-[#e63462]/15 text-[#e63462]"
                      }`}
                    >
                      {sb.bossTier === "brand_owner"
                        ? "Marka Sahibi (HQ)"
                        : sb.bossTier === "regional_manager"
                          ? "Bölge Yöneticisi"
                          : "Şube / Franchise Boss"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#86868b] mt-0.5">{sb.email}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {sb.branches.map((br) => (
                      <span
                        key={br.id}
                        className="inline-flex items-center gap-1 rounded bg-white border border-[#e5e5ea] px-2 py-0.5 text-[10px] font-medium text-[#1d1d1f]"
                      >
                        <Building2 className="h-2.5 w-2.5 text-[#e63462]" />
                        {br.name}
                        {!sb.isSelf && sb.bossTier !== "brand_owner" && (
                          <button
                            type="button"
                            onClick={() => void handleUnlinkSubBoss(sb.id, br.id, sb.name)}
                            className="ml-1 text-red-500 hover:text-red-700"
                            title="Şubeden Ayır"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSubBossModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => !sbSubmitting && setShowSubBossModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e5ea] pb-3">
              <h3 className="text-[15px] font-bold text-[#1d1d1f]">Şube / Franchise Boss Ata</h3>
              <button
                type="button"
                onClick={() => setShowSubBossModal(false)}
                className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubBoss} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#86868b] mb-1">Yetki Rolü</label>
                <select
                  value={sbTier}
                  onChange={(e) => setSbTier(e.target.value as "franchise_owner" | "regional_manager")}
                  className="w-full h-9 px-3 text-[12px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]"
                >
                  <option value="franchise_owner">Şube / Franchise Sahibi (Şube Boss&apos;u)</option>
                  <option value="regional_manager">Bölge Yöneticisi</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#86868b] mb-1">Ad Soyad *</label>
                <input
                  type="text"
                  value={sbName}
                  onChange={(e) => setSbName(e.target.value)}
                  placeholder="Örn: Murat Demir"
                  className="w-full h-9 px-3 text-[13px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#86868b] mb-1">E-posta *</label>
                  <input
                    type="email"
                    value={sbEmail}
                    onChange={(e) => setSbEmail(e.target.value)}
                    placeholder="sube@restoran.com"
                    className="w-full h-9 px-3 text-[12px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#86868b] mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={sbPhone}
                    onChange={(e) => setSbPhone(e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className="w-full h-9 px-3 text-[12px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
                  Parola (Yeni hesap ise en az 8 karakter)
                </label>
                <input
                  type="password"
                  value={sbPassword}
                  onChange={(e) => setSbPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 text-[12px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
                  Atanacak Şubeler ({sbBranchIds.length} seçili)
                </label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[#d1d1d6] bg-[#f9f9fb] p-2 space-y-1">
                  {branches.map((b) => {
                    const checked = sbBranchIds.includes(b.id)
                    return (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white cursor-pointer text-[12px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSbBranchIds((prev) =>
                              prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                            )
                          }
                          className="accent-[#e63462]"
                        />
                        <span className="font-medium text-[#1d1d1f]">{b.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubBossModal(false)}
                  className="h-9 px-4 rounded-xl border border-[#d1d1d6] text-[12px] font-semibold text-[#86868b]"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={sbSubmitting}
                  className="h-9 px-4 rounded-xl bg-[#e63462] text-[12px] font-bold text-white"
                >
                  {sbSubmitting ? "Kaydediliyor…" : "Şube Boss Ata"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
