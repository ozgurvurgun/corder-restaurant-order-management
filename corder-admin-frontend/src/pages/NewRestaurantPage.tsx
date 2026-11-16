import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import type { RestaurantBillingStatus, RestaurantBranchType } from "@/lib/types"
import { ArrowLeft, Building2, CreditCard } from "lucide-react"

export function NewRestaurantPage() {
  const navigate = useNavigate()
  const { addRestaurant, restaurants } = useAdminStore()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  const [brandName, setBrandName] = useState("")
  const [branchType, setBranchType] = useState<RestaurantBranchType>("independent")
  const [franchiseeCompanyName, setFranchiseeCompanyName] = useState("")
  const [royaltyRate, setRoyaltyRate] = useState("0")
  const [monthlyFee, setMonthlyFee] = useState("2500")
  const [billingStatus, setBillingStatus] = useState<RestaurantBillingStatus>("paid")
  const [printAgentUsername, setPrintAgentUsername] = useState("")
  const [printAgentPassword, setPrintAgentPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const existingBrands = Array.from(
    new Set(restaurants.map((r) => r.brandName?.trim()).filter(Boolean) as string[])
  )

  const handleSlugFromName = () => {
    if (!name) return
    setSlug(
      name
        .toLowerCase()
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!name.trim()) {
      setError("Restoran adı gerekli.")
      return
    }
    if (!slug.trim()) {
      setError("Slug gerekli (URL için benzersiz).")
      return
    }
    const slugExists = restaurants.some((r) => r.slug === slug)
    if (slugExists) {
      setError("Bu slug zaten kullanılıyor.")
      return
    }
    setLoading(true)
    try {
      await addRestaurant({
        name: name.trim(),
        slug: slug.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        status,
        brandName: brandName.trim() || null,
        branchType,
        franchiseeCompanyName: franchiseeCompanyName.trim() || null,
        royaltyRate: Math.max(0, Math.min(100, Number(royaltyRate) || 0)),
        monthlyFee: Math.max(0, Number(monthlyFee) || 0),
        billingStatus,
        isAccessSuspended: billingStatus === "suspended",
        ...(printAgentUsername.trim()
          ? { printAgentUsername: printAgentUsername.trim().toLowerCase() }
          : {}),
        ...(printAgentPassword ? { printAgentPassword } : {}),
      })
      navigate("/dashboard/restaurants")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Link
        to="/dashboard/restaurants"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Restoranlara dön
      </Link>
      <h1 className="text-2xl font-semibold text-white">Yeni Restoran / Franchise Şubesi</h1>
      <p className="mt-1 text-zinc-400">
        Mekan bilgilerini, franchise hiyerarşisini ve aylık abonelik ücretini tanımlayın.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-6">
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Temel Mekan Bilgileri</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Restoran / Şube Adı *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSlugFromName}
                placeholder="Örn. Burger House Kadıköy"
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Slug (URL) *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="burger-house-kadikoy"
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-blue-500"
                required
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Adres</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Tam adres"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
              disabled={loading}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Telefon</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                disabled={loading}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
          </div>
        </div>

        {/* Franchise & Brand Hierarchy Section */}
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#e63462]" />
            <h2 className="text-sm font-semibold text-white">
              Marka &amp; Franchise Yapılandırması
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Şube Mülkiyet Modeli
              </label>
              <select
                value={branchType}
                onChange={(e) => setBranchType(e.target.value as RestaurantBranchType)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#e63462]"
              >
                <option value="independent">Bağımsız Tekil İşletme</option>
                <option value="company_owned">Merkez / Özmal Şube (Markaya Ait)</option>
                <option value="franchise">Franchise Şubesi (Franchise Alan Yatırımcı)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Üst Marka / Zincir Adı (Varsa)
              </label>
              <input
                type="text"
                list="existing-brands-list"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Örn: Burger House Türkiye"
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#e63462]"
              />
              <datalist id="existing-brands-list">
                {existingBrands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            {branchType === "franchise" && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Franchise İşletmeci Firma / Yatırımcı Ünvanı
                  </label>
                  <input
                    type="text"
                    value={franchiseeCompanyName}
                    onChange={(e) => setFranchiseeCompanyName(e.target.value)}
                    placeholder="Örn: Yılmaz Gıda Turizm Ltd. Şti."
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#e63462]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Marka Royalty / Ciro Payı Oranı (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={royaltyRate}
                    onChange={(e) => setRoyaltyRate(e.target.value)}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#e63462]"
                  />
                </div>
              </>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Bir üst marka adı girdiğinizde, o markanın &ldquo;Marka Sahibi (HQ)&rdquo; olan Boss hesabı bu şubeyi ve tüm cirosunu otomatik olarak görür; ayrıca şubeye özel &ldquo;Franchise / Şube Sahibi&rdquo; Boss atayabilirsiniz.
          </p>
        </div>

        {/* Monthly Fee & Collection Status */}
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">
              Aylık Abonelik Ücreti &amp; Tahsilat Durumu (25-30 Tahsilat)
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Bu Mekan İçin Aylık Ücret (₺) *
              </label>
              <input
                type="number"
                min={0}
                step="50"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                placeholder="2500"
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm font-semibold text-white outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Başlangıç Ödeme Durumu
              </label>
              <select
                value={billingStatus}
                onChange={(e) => setBillingStatus(e.target.value as RestaurantBillingStatus)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
              >
                <option value="paid">Ödeme Alındı (Erişim Açık)</option>
                <option value="pending">Ödeme Bekleniyor (25-30 Tahsilat Dönemi)</option>
                <option value="suspended">Ödeme Alınmadı (Erişimi Durdur)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-4 space-y-3">
          <p className="text-sm font-medium text-white">
            Print Agent (Masaüstü Yazıcı Uygulaması) Kullanıcısı (İsteğe Bağlı)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Kullanıcı Adı</label>
              <input
                type="text"
                value={printAgentUsername}
                onChange={(e) => setPrintAgentUsername(e.target.value)}
                placeholder="Örn: merkez-yazici"
                minLength={3}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 font-mono text-sm text-white outline-none focus:border-blue-500"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Parola (en az 6 karakter)
              </label>
              <input
                type="password"
                value={printAgentPassword}
                onChange={(e) => setPrintAgentPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Kaydediliyor…" : "Mekanı Oluştur"}
          </button>
          <Link
            to="/dashboard/restaurants"
            className="rounded-lg border border-[#2a2a2a] px-6 py-2.5 text-sm font-medium text-zinc-300 hover:bg-[#2a2a2a]"
          >
            İptal
          </Link>
        </div>
      </form>
    </div>
  )
}
