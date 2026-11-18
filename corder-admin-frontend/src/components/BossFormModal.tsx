import { useEffect, useState } from "react"
import type { BossTier, Restaurant, RootAdmin } from "@/lib/types"
import { Building2, Check, X } from "lucide-react"
import { CorderEmailInput } from "@/components/CorderEmailInput"
import { formatCanonicalCorderEmail } from "@/lib/corder-email"

interface BossFormModalProps {
  editingBoss: RootAdmin | null
  restaurants: Restaurant[]
  onClose: () => void
  onCreateBoss: (data: {
    name: string
    email: string
    phone?: string
    bossTier: BossTier
    brandName: string | null
    password: string
    restaurantIds: string[]
  }) => Promise<unknown>
  onUpdateBoss: (
    id: string,
    data: {
      name: string
      email: string
      phone: string | null
      bossTier: BossTier
      brandName: string | null
      isActive?: boolean
      password?: string
      restaurantIds: string[]
    }
  ) => Promise<unknown>
}

export function BossFormModal({
  editingBoss,
  restaurants,
  onClose,
  onCreateBoss,
  onUpdateBoss,
}: BossFormModalProps) {
  const [name, setName] = useState(editingBoss?.name ?? "")
  const [email, setEmail] = useState(editingBoss?.email ?? "")
  const [phone, setPhone] = useState(editingBoss?.phone ?? "")
  const [bossTier, setBossTier] = useState<BossTier>(
    editingBoss?.bossTier ?? "franchise_owner"
  )
  const [brandName, setBrandName] = useState(editingBoss?.brandName ?? "")
  const [isActive, setIsActive] = useState(editingBoss?.isActive !== false)
  const [password, setPassword] = useState("")
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>(
    editingBoss
      ? (editingBoss.restaurants?.map((r) => r.id) ?? [])
      : restaurants[0]
        ? [restaurants[0].id]
        : []
  )
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const existingBrands = Array.from(
    new Set(restaurants.map((r) => r.brandName?.trim()).filter(Boolean) as string[])
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, submitting])

  const toggleBranch = (id: string) => {
    setSelectedRestaurantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectAllByBrand = (brand: string) => {
    const norm = brand.trim().toLowerCase()
    const matchingIds = restaurants
      .filter((r) => r.brandName && r.brandName.trim().toLowerCase() === norm)
      .map((r) => r.id)
    setSelectedRestaurantIds((prev) =>
      Array.from(new Set([...prev, ...matchingIds]))
    )
  }

  const primarySelectedBranch =
    restaurants.find((r) => r.id === selectedRestaurantIds[0]) ?? restaurants[0]
  const bossTenant =
    bossTier === "brand_owner" && brandName.trim()
      ? brandName.trim()
      : primarySelectedBranch?.slug || primarySelectedBranch?.name || ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const canonicalEmail = formatCanonicalCorderEmail(email, bossTenant)
    if (!name.trim() || !canonicalEmail) {
      setError("Ad soyad ve e-posta kullanıcı adı (@ öncesi) zorunludur.")
      return
    }
    if ((!editingBoss || password.length > 0) && password.length < 8) {
      setError(
        editingBoss
          ? "Yeni parola en az 8 karakter olmalıdır."
          : "Parola en az 8 karakter olmalıdır."
      )
      return
    }
    setSubmitting(true)
    try {
      const normalizedBrand =
        bossTier === "brand_owner" ? brandName.trim() || null : null
      if (editingBoss) {
        await onUpdateBoss(editingBoss.id, {
          name: name.trim(),
          email: canonicalEmail,
          phone: phone.trim() || null,
          bossTier,
          brandName: normalizedBrand,
          isActive,
          ...(password ? { password } : {}),
          restaurantIds: selectedRestaurantIds,
        })
      } else {
        await onCreateBoss({
          name: name.trim(),
          email: canonicalEmail,
          phone: phone.trim() || undefined,
          bossTier,
          brandName: normalizedBrand,
          password,
          restaurantIds: selectedRestaurantIds,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız")
    } finally {
      setSubmitting(false)
    }
  }

  const fieldCls =
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3.5">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
            {editingBoss
              ? "Boss Hesabını Düzenle"
              : "Yeni Boss (Marka Sahibi / Franchise Sahibi) Oluştur"}
          </h2>
          <button
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Boss Hiyerarşi Seviyesi *
            </label>
            <select
              value={bossTier}
              onChange={(e) => setBossTier(e.target.value as BossTier)}
              className={fieldCls}
            >
              <option value="franchise_owner">
                Şube / Franchise Sahibi (Şube Boss&apos;u — Kendi Dükkanının Ciro, Metrik ve Ekibini Yönetir)
              </option>
              <option value="brand_owner">
                Marka &amp; Üst Franchise Sahibi (HQ — Tüm Şubelerin Eksiksiz Analizini ve Cirosunu Görür)
              </option>
              <option value="regional_manager">
                Bölge / Grup Yöneticisi (Atanan Bölgedeki Şubeleri Yönetir)
              </option>
            </select>
          </div>

          {bossTier === "brand_owner" && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3.5 space-y-2">
              <label className="block text-[12px] font-semibold text-purple-900">
                Marka / Franchise Ağı Adı (Otomatik Tüm Marka Şubelerini Bağlar)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  list="boss-brands-list"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Örn: Burger House Türkiye"
                  className="flex-1 h-9 rounded-lg border border-purple-200 bg-white px-3 text-[13px] text-[#1d1d1f] outline-none focus:border-purple-500"
                />
                <datalist id="boss-brands-list">
                  {existingBrands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
                {brandName.trim() && (
                  <button
                    type="button"
                    onClick={() => selectAllByBrand(brandName)}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-purple-500"
                  >
                    Marka Şubelerini Seç
                  </button>
                )}
              </div>
              <p className="text-[11px] text-purple-800">
                Bu marka adı altında açılan mevcut ve gelecekteki tüm şubeler otomatik olarak bu Marka Sahibinin ekranına düşer.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Ad Soyad *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Mehmet Kaya"
              className={fieldCls}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                E-posta (Boss &amp; Panel Girişi) *
              </label>
              <CorderEmailInput
                value={email}
                onChange={setEmail}
                tenantSlugOrName={bossTenant}
                placeholder="patron"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Telefon
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0532 000 00 00"
                className={fieldCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              {editingBoss
                ? "Yeni Parola (değiştirmek istemiyorsanız boş bırakın)"
                : "Parola (en az 8 karakter) *"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={fieldCls}
              required={!editingBoss}
            />
          </div>

          {editingBoss && (
            <label className="flex items-center gap-2 text-[12px] font-medium text-[#1d1d1f] cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-[#e63462]"
              />
              Boss hesabı aktif (Boss ve Merchant Paneline giriş yapabilir)
            </label>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[12px] font-medium text-[#1d1d1f]">
                Yöneteceği Dükkan / Şubeler ({selectedRestaurantIds.length} seçili)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedRestaurantIds(restaurants.map((r) => r.id))
                  }
                  className="text-[11px] font-medium text-[#e63462] hover:underline"
                >
                  Tümünü Seç
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRestaurantIds([])}
                  className="text-[11px] font-medium text-[#86868b] hover:underline"
                >
                  Temizle
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-2 space-y-1">
              {restaurants.map((r) => {
                const checked = selectedRestaurantIds.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleBranch(r.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                      checked
                        ? "bg-[#e63462]/10 text-[#1d1d1f]"
                        : "text-[#636366] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2
                        className={`h-4 w-4 ${
                          checked ? "text-[#e63462]" : "text-[#86868b]"
                        }`}
                      />
                      <div>
                        <p className="font-medium leading-tight">
                          {r.name}{" "}
                          {r.brandName && (
                            <span className="text-[11px] text-purple-700">
                              ({r.brandName})
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                          {r.slug} •{" "}
                          {r.branchType === "franchise"
                            ? "Franchise"
                            : r.branchType === "company_owned"
                              ? "Merkez Şube"
                              : "Bağımsız"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        checked
                          ? "border-[#e63462] bg-[#e63462] text-white"
                          : "border-[#d1d1d6] bg-white"
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}

          <div className="flex justify-end gap-2.5 border-t border-[#f0f0f0] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#d1d1d6] px-4 text-[13px] font-medium text-[#86868b] hover:bg-[#f5f5f7]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-xl bg-[#e63462] px-5 text-[13px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
            >
              {submitting
                ? "Kaydediliyor…"
                : editingBoss
                  ? "Güncelle"
                  : "Boss Hesabını Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
