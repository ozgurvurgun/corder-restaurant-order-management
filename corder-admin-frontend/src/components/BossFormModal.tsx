import { useEffect, useState } from "react"
import type { BossTier, Restaurant, RootAdmin } from "@/lib/types"
import { Building2, Check, X } from "lucide-react"

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
  const [bossTier, setBossTier] = useState<BossTier>(editingBoss?.bossTier ?? "franchise_owner")
  const [brandName, setBrandName] = useState(editingBoss?.brandName ?? "")
  const [password, setPassword] = useState("")
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>(
    editingBoss ? (editingBoss.restaurants?.map((r) => r.id) ?? []) : restaurants[0] ? [restaurants[0].id] : []
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
    setSelectedRestaurantIds((prev) => Array.from(new Set([...prev, ...matchingIds])))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!name.trim() || !email.trim()) {
      setError("Ad soyad ve e-posta zorunludur.")
      return
    }
    if ((!editingBoss || password.length > 0) && password.length < 8) {
      setError(editingBoss ? "Yeni parola en az 8 karakter olmalıdır." : "Parola en az 8 karakter olmalıdır.")
      return
    }
    setSubmitting(true)
    try {
      const normalizedBrand = bossTier === "brand_owner" ? brandName.trim() || null : null
      if (editingBoss) {
        await onUpdateBoss(editingBoss.id, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          bossTier,
          brandName: normalizedBrand,
          ...(password ? { password } : {}),
          restaurantIds: selectedRestaurantIds,
        })
      } else {
        await onCreateBoss({
          name: name.trim(),
          email: email.trim(),
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

  const fieldCls = "w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#e63462]"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-4">
          <h2 className="text-lg font-semibold text-white">
            {editingBoss ? "Boss Hesabını Düzenle" : "Yeni Boss (Marka Sahibi / Franchise Sahibi) Oluştur"}
          </h2>
          <button
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#2a2a2a] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Boss Hiyerarşi Seviyesi *</label>
            <select value={bossTier} onChange={(e) => setBossTier(e.target.value as BossTier)} className={fieldCls}>
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
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 space-y-2">
              <label className="block text-xs font-semibold text-purple-200">
                Marka / Franchise Ağı Adı (Otomatik Tüm Marka Şubelerini Bağlar)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  list="boss-brands-list"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Örn: Burger House Türkiye"
                  className="flex-1 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
                />
                <datalist id="boss-brands-list">
                  {existingBrands.map((b) => <option key={b} value={b} />)}
                </datalist>
                {brandName.trim() && (
                  <button
                    type="button"
                    onClick={() => selectAllByBrand(brandName)}
                    className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500"
                  >
                    Marka Şubelerini Seç
                  </button>
                )}
              </div>
              <p className="text-[11px] text-purple-200/80">
                Bu marka adı altında açılan mevcut ve gelecekteki tüm şubeler (ör. 40 şube) otomatik olarak bu Marka Sahibinin ekranına düşer.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Ad Soyad *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Mehmet Kaya" className={fieldCls} required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">E-posta (Boss &amp; Panel Girişi) *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="patron@isletme.com" className={fieldCls} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">Telefon</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 000 00 00" className={fieldCls} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              {editingBoss ? "Yeni Parola (değiştirmek istemiyorsanız boş bırakın)" : "Parola (en az 8 karakter) *"}
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={fieldCls} required={!editingBoss} />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Yöneteceği Dükkan / Şubeler ({selectedRestaurantIds.length} seçili)
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelectedRestaurantIds(restaurants.map((r) => r.id))} className="text-[11px] text-[#e63462] hover:underline">
                  Tümünü Seç
                </button>
                <button type="button" onClick={() => setSelectedRestaurantIds([])} className="text-[11px] text-zinc-400 hover:underline">
                  Temizle
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-2 space-y-1">
              {restaurants.map((r) => {
                const checked = selectedRestaurantIds.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleBranch(r.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      checked ? "bg-[#e63462]/15 text-white" : "text-zinc-400 hover:bg-[#1a1a1a]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className={`h-4 w-4 ${checked ? "text-[#e63462]" : "text-zinc-500"}`} />
                      <div>
                        <p className="font-medium leading-tight">
                          {r.name} {r.brandName && <span className="text-[11px] text-purple-300">({r.brandName})</span>}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {r.slug} • {r.branchType === "franchise" ? "Franchise" : r.branchType === "company_owned" ? "Merkez Şube" : "Bağımsız"}
                        </p>
                      </div>
                    </div>
                    <div className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? "border-[#e63462] bg-[#e63462] text-white" : "border-zinc-700"}`}>
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#2a2a2a] px-4 py-2.5 text-sm text-zinc-300 hover:bg-[#2a2a2a]">
              İptal
            </button>
            <button type="submit" disabled={submitting} className="rounded-xl bg-[#e63462] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#d42d56] disabled:opacity-50">
              {submitting ? "Kaydediliyor…" : editingBoss ? "Güncelle" : "Boss Hesabını Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
