import { useEffect, useState } from "react"
import { UserPlus, Link2, Crown, Building2, Pencil, Unlink, Trash2 } from "lucide-react"
import type { BossTier, RootAdmin } from "@/lib/types"
import { useAdminStore } from "@/lib/store"

interface RootAdminsSectionProps {
  restaurantId: string
  brandName?: string | null
  rootAdmins: RootAdmin[]
  loading: boolean
  error: string | null
  onAddRootAdmin: (
    restaurantId: string,
    input: {
      name: string
      email: string
      phone?: string
      bossTier?: BossTier
      brandName?: string | null
      password: string
    }
  ) => Promise<void>
  onDeleteRootAdmin: (restaurantId: string, adminId: string) => Promise<void>
}

export function RootAdminsSection({
  restaurantId,
  brandName,
  rootAdmins,
  loading,
  error,
  onAddRootAdmin,
  onDeleteRootAdmin,
}: RootAdminsSectionProps) {
  const { allBosses, linkExistingBoss, unlinkBossFromRestaurant, updateRootAdmin } =
    useAdminStore()
  const [mode, setMode] = useState<"none" | "create" | "link" | "edit">("none")
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null)
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPhone, setAdminPhone] = useState("")
  const [adminTier, setAdminTier] = useState<BossTier>("franchise_owner")
  const [adminPassword, setAdminPassword] = useState("")
  const [adminIsActive, setAdminIsActive] = useState(true)
  const [selectedExistingBossId, setSelectedExistingBossId] = useState("")
  const [adminError, setAdminError] = useState("")
  const [adminSubmitLoading, setAdminSubmitLoading] = useState(false)

  useEffect(() => {
    if (mode === "none") return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !adminSubmitLoading) setMode("none")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [mode, adminSubmitLoading])

  const assignedIds = new Set(rootAdmins.map((a) => a.id))
  const linkableBosses = allBosses.filter((b) => !assignedIds.has(b.id))

  const startEditAdmin = (admin: RootAdmin) => {
    setEditingAdminId(admin.id)
    setAdminName(admin.name)
    setAdminEmail(admin.email)
    setAdminPhone(admin.phone ?? "")
    setAdminTier(admin.bossTier ?? "franchise_owner")
    setAdminIsActive(admin.isActive !== false)
    setAdminPassword("")
    setAdminError("")
    setMode("edit")
  }

  const handleSaveBossForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError("")
    if (!adminName.trim() || !adminEmail.trim()) {
      setAdminError("Ad soyad ve e-posta gerekli.")
      return
    }
    if ((mode === "create" || adminPassword.length > 0) && adminPassword.length < 8) {
      setAdminError("Parola en az 8 karakter olmalı.")
      return
    }
    setAdminSubmitLoading(true)
    try {
      const resolvedBrand = adminTier === "brand_owner" ? brandName ?? null : null
      if (mode === "edit" && editingAdminId) {
        await updateRootAdmin(restaurantId, editingAdminId, {
          name: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          phone: adminPhone.trim() || null,
          bossTier: adminTier,
          brandName: resolvedBrand,
          isActive: adminIsActive,
          ...(adminPassword ? { password: adminPassword } : {}),
        })
      } else {
        await onAddRootAdmin(restaurantId, {
          name: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          phone: adminPhone.trim() || undefined,
          bossTier: adminTier,
          brandName: resolvedBrand,
          password: adminPassword,
        })
      }
      setMode("none")
      setEditingAdminId(null)
      setAdminName("")
      setAdminEmail("")
      setAdminPhone("")
      setAdminPassword("")
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "İşlem başarısız")
    } finally {
      setAdminSubmitLoading(false)
    }
  }

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedExistingBossId) return
    setAdminError("")
    setAdminSubmitLoading(true)
    try {
      await linkExistingBoss(restaurantId, selectedExistingBossId)
      setMode("none")
      setSelectedExistingBossId("")
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Mevcut Boss bağlanamadı")
    } finally {
      setAdminSubmitLoading(false)
    }
  }

  const handleUnlink = async (admin: RootAdmin) => {
    if (
      !confirm(
        `${admin.name} Boss hesabının bu şube ile bağlantısını ayırmak istediğinize emin misiniz? (Boss hesabı silinmez)`
      )
    ) {
      return
    }
    setAdminError("")
    try {
      await unlinkBossFromRestaurant(restaurantId, admin.id)
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Şube bağlantısı ayrılamadı")
    }
  }

  const handleDeleteAccount = async (admin: RootAdmin) => {
    if (
      !confirm(
        `${admin.name} (${admin.email}) Boss hesabını tamamen silmek istediğinize emin misiniz?`
      )
    ) {
      return
    }
    setAdminError("")
    try {
      await onDeleteRootAdmin(restaurantId, admin.id)
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Boss hesabı silinemedi")
    }
  }

  const fieldCls =
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"

  return (
    <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5">
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl bg-[#e63462]/10 p-2 text-[#e63462]">
          <Crown className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
            Şube &amp; Marka Boss Hesapları
          </h2>
          <p className="text-[12px] text-[#86868b]">
            Bu şubeye hem <span className="font-semibold text-[#1d1d1f]">Marka Sahibi (HQ)</span> hem de{" "}
            <span className="font-semibold text-[#1d1d1f]">Şube / Franchise Sahibi</span> atanabilir.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-[12px] font-medium text-red-600">{error}</p>}
      {adminError && mode === "none" && (
        <p className="mt-3 text-[12px] font-medium text-red-600">{adminError}</p>
      )}
      {loading ? (
        <p className="mt-4 text-[13px] text-[#86868b]">Yükleniyor…</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2.5">
            {rootAdmins.map((admin) => (
              <li
                key={admin.id}
                className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">{admin.name}</p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        admin.bossTier === "brand_owner"
                          ? "bg-purple-50 text-purple-700"
                          : admin.bossTier === "regional_manager"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-[#fef3f5] text-[#e63462]"
                      }`}
                    >
                      {admin.bossTier === "brand_owner"
                        ? "Marka Sahibi (HQ)"
                        : admin.bossTier === "regional_manager"
                          ? "Bölge Yöneticisi"
                          : "Şube / Franchise Boss"}
                    </span>
                    {admin.isActive === false && (
                      <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        Pasif
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#636366] mt-0.5">{admin.email}</p>
                  {admin.phone && (
                    <p className="text-[11px] text-[#86868b] mt-0.5">{admin.phone}</p>
                  )}
                  {admin.restaurants && admin.restaurants.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {admin.restaurants.map((br) => (
                        <span
                          key={br.id}
                          className="inline-flex items-center gap-1 rounded-md border border-[#e5e5ea] bg-white px-2 py-0.5 text-[11px] font-medium text-[#1d1d1f]"
                        >
                          <Building2 className="h-3 w-3 text-[#e63462]" />
                          {br.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditAdmin(admin)}
                    className="rounded-lg bg-white border border-[#e5e5ea] p-1.5 text-[#636366] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                    title="Boss Bilgilerini Düzenle"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUnlink(admin)}
                    className="rounded-lg bg-white border border-[#e5e5ea] p-1.5 text-amber-600 hover:bg-amber-50"
                    title="Şubeden Ayır (Hesabı Silmez)"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAccount(admin)}
                    className="rounded-lg bg-white border border-[#e5e5ea] p-1.5 text-red-500 hover:bg-red-50"
                    title="Boss Hesabını Sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {(mode === "create" || mode === "edit") && (
            <form
              onSubmit={handleSaveBossForm}
              className="mt-4 space-y-3 border-t border-[#f0f0f0] pt-4"
            >
              <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
                {mode === "edit"
                  ? "Boss Hesabını Düzenle"
                  : "Yeni Boss (Şube / Franchise Sahibi veya Marka Sahibi) Oluştur"}
              </h3>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Boss Hiyerarşi Rolü *
                </label>
                <select
                  value={adminTier}
                  onChange={(e) => setAdminTier(e.target.value as BossTier)}
                  className={fieldCls}
                  disabled={adminSubmitLoading}
                >
                  <option value="franchise_owner">
                    Şube / Franchise Sahibi (Şube Boss&apos;u)
                  </option>
                  <option value="brand_owner">
                    Marka &amp; Üst Franchise Sahibi (HQ)
                  </option>
                  <option value="regional_manager">Bölge Yöneticisi</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Ad Soyad *</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Örn. Ahmet Yılmaz"
                  className={fieldCls}
                  required
                  disabled={adminSubmitLoading}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                    E-posta (Boss giriş) *
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="boss@restoran.com"
                    className={fieldCls}
                    required
                    disabled={adminSubmitLoading}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Telefon</label>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className={fieldCls}
                    disabled={adminSubmitLoading}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  {mode === "edit"
                    ? "Yeni Parola (değiştirmek istemiyorsanız boş bırakın)"
                    : "Parola (en az 8 karakter) *"}
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  autoComplete="new-password"
                  className={fieldCls}
                  required={mode === "create"}
                  disabled={adminSubmitLoading}
                />
              </div>
              {mode === "edit" && (
                <label className="flex items-center gap-2 text-[12px] font-medium text-[#1d1d1f] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminIsActive}
                    onChange={(e) => setAdminIsActive(e.target.checked)}
                    className="accent-[#e63462]"
                  />
                  Boss hesabı aktif (giriş yapabilir)
                </label>
              )}
              {adminError && <p className="text-[12px] font-medium text-red-600">{adminError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adminSubmitLoading}
                  className="h-9 rounded-xl bg-[#e63462] px-4 text-[12px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
                >
                  {adminSubmitLoading
                    ? "Kaydediliyor…"
                    : mode === "edit"
                      ? "Değişiklikleri Kaydet"
                      : "Boss Oluştur ve Şubeye Ata"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("none")
                    setEditingAdminId(null)
                  }}
                  className="h-9 rounded-xl border border-[#d1d1d6] px-4 text-[12px] font-medium text-[#86868b] hover:bg-[#f5f5f7]"
                >
                  İptal
                </button>
              </div>
            </form>
          )}

          {mode === "link" && (
            <form
              onSubmit={handleLinkExisting}
              className="mt-4 space-y-3 border-t border-[#f0f0f0] pt-4"
            >
              <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
                Mevcut Boss Hesabına Bu Şubeyi Bağla
              </h3>
              <select
                value={selectedExistingBossId}
                onChange={(e) => setSelectedExistingBossId(e.target.value)}
                className={fieldCls}
                required
              >
                <option value="">Boss hesabı seçin...</option>
                {linkableBosses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.email}) —{" "}
                    {b.bossTier === "brand_owner" ? "Marka HQ" : "Şube Boss"} •{" "}
                    {b.restaurants?.length ?? 0} şube
                  </option>
                ))}
              </select>
              {adminError && <p className="text-[12px] font-medium text-red-600">{adminError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adminSubmitLoading || !selectedExistingBossId}
                  className="h-9 rounded-xl bg-[#e63462] px-4 text-[12px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
                >
                  {adminSubmitLoading ? "Bağlanıyor…" : "Şubeyi Bu Boss'a Bağla"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("none")}
                  className="h-9 rounded-xl border border-[#d1d1d6] px-4 text-[12px] font-medium text-[#86868b] hover:bg-[#f5f5f7]"
                >
                  İptal
                </button>
              </div>
            </form>
          )}

          {mode === "none" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingAdminId(null)
                  setAdminName("")
                  setAdminEmail("")
                  setAdminPhone("")
                  setAdminPassword("")
                  setAdminTier("franchise_owner")
                  setAdminError("")
                  setMode("create")
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 py-2 text-[12px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed]"
              >
                <UserPlus className="h-3.5 w-3.5 text-[#e63462]" />
                Yeni Şube / Marka Boss Oluştur
              </button>
              {linkableBosses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("link")
                    setAdminError("")
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 py-2 text-[12px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed]"
                >
                  <Link2 className="h-3.5 w-3.5 text-[#007aff]" />
                  Mevcut Boss&apos;a Şube Olarak Bağla
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
