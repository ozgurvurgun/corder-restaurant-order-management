import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import { fromMinorUnits, toMinorUnits } from "@/lib/money"
import type { RestaurantBillingStatus, RestaurantBranchType } from "@/lib/types"
import { ArrowLeft, Building2, CreditCard, Monitor, Printer } from "lucide-react"

export function NewRestaurantPage() {
  const navigate = useNavigate()
  const { addRestaurant, restaurants, loadRestaurants } = useAdminStore()
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
  const [billingNotes, setBillingNotes] = useState("")
  const [terminalEmail, setTerminalEmail] = useState("")
  const [terminalPassword, setTerminalPassword] = useState("")
  const [printAgentUsername, setPrintAgentUsername] = useState("")
  const [printAgentPassword, setPrintAgentPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (restaurants.length === 0) void loadRestaurants()
  }, [restaurants.length, loadRestaurants])

  const existingBrands = Array.from(
    new Set(restaurants.map((r) => r.brandName?.trim()).filter(Boolean) as string[])
  )

  const handleSlugFromName = () => {
    if (!name || slug.trim()) return
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
    const cleanSlug = slug.trim().toLowerCase()
    if (!cleanSlug) {
      setError("Slug gerekli (URL için benzersiz).")
      return
    }
    const slugExists = restaurants.some((r) => r.slug === cleanSlug)
    if (slugExists) {
      setError("Bu slug zaten kullanılıyor.")
      return
    }
    const cleanTerminalEmail = terminalEmail.trim().toLowerCase()
    if (cleanTerminalEmail && terminalPassword.length < 4) {
      setError("Terminal hesabı tanımlarken en az 4 karakterli parola girilmelidir.")
      return
    }
    if (!cleanTerminalEmail && terminalPassword.length > 0) {
      setError("Terminal parolası girildiğinde terminal e-posta adresi de belirtilmelidir.")
      return
    }
    const cleanPrintUser = printAgentUsername.trim().toLowerCase()
    if (cleanPrintUser && cleanPrintUser.length < 3) {
      setError("Print Agent kullanıcı adı en az 3 karakter olmalıdır.")
      return
    }
    if (cleanPrintUser && printAgentPassword.length < 6) {
      setError("Print Agent kullanıcısı tanımlarken en az 6 karakterli parola girilmelidir.")
      return
    }
    if (!cleanPrintUser && printAgentPassword.length > 0) {
      setError("Print Agent parolası girildiğinde kullanıcı adı da belirtilmelidir.")
      return
    }

    setLoading(true)
    try {
      await addRestaurant({
        name: name.trim(),
        slug: cleanSlug,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        status,
        brandName: brandName.trim() || null,
        branchType,
        franchiseeCompanyName:
          branchType === "franchise" ? franchiseeCompanyName.trim() || null : null,
        royaltyRate:
          branchType === "franchise"
            ? Math.max(0, Math.min(100, Number(royaltyRate) || 0))
            : 0,
        monthlyFee: Math.max(0, fromMinorUnits(toMinorUnits(monthlyFee))),
        billingStatus,
        isAccessSuspended: billingStatus === "suspended",
        billingNotes: billingNotes.trim() || null,
        ...(cleanTerminalEmail ? { terminalEmail: cleanTerminalEmail } : {}),
        ...(terminalPassword ? { terminalPassword } : {}),
        ...(cleanPrintUser ? { printAgentUsername: cleanPrintUser } : {}),
        ...(printAgentPassword ? { printAgentPassword } : {}),
      })
      navigate("/dashboard/restaurants")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız")
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/restaurants"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#636366] hover:text-[#1d1d1f]"
        >
          <ArrowLeft className="h-4 w-4" />
          Restoranlara Dön
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Temel Mekan Bilgileri</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Restoran / Şube Adı *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSlugFromName}
                placeholder="Örn. Burger House Kadıköy"
                className={inputCls}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Slug (URL) *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="burger-house-kadikoy"
                className={`${inputCls} font-mono`}
                required
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Adres</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Tam adres"
              className={inputCls}
              disabled={loading}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Telefon</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className={inputCls}
                disabled={loading}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
          </div>
        </div>

        {/* Franchise & Brand Hierarchy Section */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#e63462]" />
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
              Marka &amp; Franchise Yapılandırması
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Şube Mülkiyet Modeli
              </label>
              <select
                value={branchType}
                onChange={(e) => setBranchType(e.target.value as RestaurantBranchType)}
                className={inputCls}
              >
                <option value="independent">Bağımsız Tekil İşletme</option>
                <option value="company_owned">Merkez / Özmal Şube (Markaya Ait)</option>
                <option value="franchise">Franchise Şubesi (Franchise Alan Yatırımcı)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Üst Marka / Zincir Adı (Varsa)
              </label>
              <input
                type="text"
                list="existing-brands-list"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Örn: Burger House Türkiye"
                className={inputCls}
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
                  <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                    Franchise İşletmeci Firma / Yatırımcı Ünvanı
                  </label>
                  <input
                    type="text"
                    value={franchiseeCompanyName}
                    onChange={(e) => setFranchiseeCompanyName(e.target.value)}
                    placeholder="Örn: Yılmaz Gıda Turizm Ltd. Şti."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                    Marka Royalty / Ciro Payı Oranı (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={royaltyRate}
                    onChange={(e) => setRoyaltyRate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </>
            )}
          </div>
          <p className="text-[12px] text-[#86868b]">
            Bir üst marka adı girdiğinizde, o markanın &ldquo;Marka Sahibi (HQ)&rdquo; olan Boss hesabı bu şubeyi ve tüm cirosunu otomatik olarak görür; ayrıca şubeye özel &ldquo;Franchise / Şube Sahibi&rdquo; Boss atayabilirsiniz.
          </p>
        </div>

        {/* Monthly Fee & Collection Status */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#34c759]" />
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
              Aylık Abonelik Ücreti &amp; Tahsilat Durumu (25-30 Tahsilat)
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Bu Mekan İçin Aylık Ücret (₺) *
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                placeholder="2500"
                className={`${inputCls} font-semibold`}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Başlangıç Ödeme Durumu
              </label>
              <select
                value={billingStatus}
                onChange={(e) => setBillingStatus(e.target.value as RestaurantBillingStatus)}
                className={inputCls}
              >
                <option value="paid">Ödeme Alındı (Erişim Açık)</option>
                <option value="pending">Ödeme Bekleniyor (25-30 Tahsilat Dönemi)</option>
                <option value="overdue">Ödeme Gecikti</option>
                <option value="suspended">Ödeme Alınmadı (Erişimi Durdur)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Tahsilat / Sözleşme Notu</label>
            <input
              type="text"
              value={billingNotes}
              onChange={(e) => setBillingNotes(e.target.value)}
              placeholder="İsteğe bağlı ödeme veya sözleşme notu..."
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-[#007aff]" />
              <p className="text-[14px] font-semibold text-[#1d1d1f]">
                Terminal (Garson / Kasa Ekranı) Giriş Bilgileri (İsteğe Bağlı)
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Terminal E-posta</label>
                <input
                  type="email"
                  value={terminalEmail}
                  onChange={(e) => setTerminalEmail(e.target.value)}
                  placeholder="Örn: terminal@restoran.com"
                  autoComplete="off"
                  className={inputCls}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Terminal Parola (en az 4 krk)
                </label>
                <input
                  type="password"
                  value={terminalPassword}
                  onChange={(e) => setTerminalPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={4}
                  autoComplete="new-password"
                  className={inputCls}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-[#e63462]" />
              <p className="text-[14px] font-semibold text-[#1d1d1f]">
                Print Agent (Masaüstü Yazıcı Uygulaması) Kullanıcısı (İsteğe Bağlı)
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Kullanıcı Adı</label>
                <input
                  type="text"
                  value={printAgentUsername}
                  onChange={(e) => setPrintAgentUsername(e.target.value)}
                  placeholder="Örn: merkez-yazici"
                  minLength={3}
                  className={`${inputCls} font-mono`}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Parola (en az 6 krk)
                </label>
                <input
                  type="password"
                  value={printAgentPassword}
                  onChange={(e) => setPrintAgentPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className={inputCls}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-xl bg-[#e63462] px-6 text-[13px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
          >
            {loading ? "Kaydediliyor…" : "Mekanı Oluştur"}
          </button>
          <Link
            to="/dashboard/restaurants"
            className="inline-flex h-10 items-center rounded-xl border border-[#d1d1d6] bg-white px-5 text-[13px] font-medium text-[#636366] hover:bg-[#f5f5f7]"
          >
            İptal
          </Link>
        </div>
      </form>
    </div>
  )
}
