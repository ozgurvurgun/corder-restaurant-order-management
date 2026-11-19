import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import {
  fromMinorUnits,
  getIstanbulBillingPeriod,
  toMinorUnits,
} from "@/lib/money"
import type {
  RestaurantBranchType,
  SubscriptionPaymentMethod,
} from "@/lib/types"
import { ArrowLeft } from "lucide-react"
import {
  DeviceCredentialsCards,
  FranchiseConfigCard,
  InitialSubscriptionCard,
} from "@/components/NewRestaurantFormSections"
import { CustomSelect } from "@/components/ui/custom-inputs"
import {
  formatCanonicalCorderEmail,
  toCorderEmailTenantSlug,
} from "@/lib/corder-email"

export function NewRestaurantPage() {
  const navigate = useNavigate()
  const { addRestaurant, restaurants, loadRestaurants } = useAdminStore()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  const [brandName, setBrandName] = useState("")
  const [branchType, setBranchType] = useState<RestaurantBranchType>("independent")
  const [franchiseeCompanyName, setFranchiseeCompanyName] = useState("")
  const [royaltyRate, setRoyaltyRate] = useState("0")
  const [monthlyFee, setMonthlyFee] = useState("2500")
  const [billingStartPeriod, setBillingStartPeriod] = useState(getIstanbulBillingPeriod)
  const [recordInitialPayment, setRecordInitialPayment] = useState(false)
  const [initialPaidMonths, setInitialPaidMonths] = useState(1)
  const [initialPaymentMethod, setInitialPaymentMethod] =
    useState<SubscriptionPaymentMethod>("bank_transfer")
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

  const handleNameChange = (nextName: string) => {
    setName(nextName)
    if (!slugManuallyEdited) {
      setSlug(toCorderEmailTenantSlug(nextName))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!name.trim()) return setError("Restoran adı gerekli.")
    const cleanSlug = toCorderEmailTenantSlug(slug || name)
    if (!cleanSlug) return setError("Slug gerekli (URL için benzersiz).")
    if (restaurants.some((r) => r.slug === cleanSlug)) {
      return setError("Bu slug zaten kullanılıyor.")
    }
    const cleanEmail = email.trim().toLowerCase()
    const cleanTerminalEmail = formatCanonicalCorderEmail(terminalEmail, cleanSlug)
    if (cleanTerminalEmail && terminalPassword.length < 4) {
      return setError("Terminal hesabı tanımlarken en az 4 karakterli parola girilmelidir.")
    }
    if (!cleanTerminalEmail && terminalPassword.length > 0) {
      return setError("Terminal parolası girildiğinde terminal kullanıcı adı (@ öncesi) da belirtilmelidir.")
    }
    const cleanPrintUser = formatCanonicalCorderEmail(printAgentUsername, cleanSlug)
    if (cleanPrintUser && printAgentPassword.length < 6) {
      return setError("Print Agent kullanıcısı tanımlarken en az 6 karakterli parola girilmelidir.")
    }
    if (!cleanPrintUser && printAgentPassword.length > 0) {
      return setError("Print Agent parolası girildiğinde Print Agent e-posta adı (@ öncesi) da belirtilmelidir.")
    }

    setLoading(true)
    try {
      await addRestaurant({
        name: name.trim(),
        slug: cleanSlug,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: cleanEmail || undefined,
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
        billingStartPeriod,
        recordInitialPayment,
        initialPaidMonths: recordInitialPayment ? initialPaidMonths : undefined,
        initialPaymentMethod: recordInitialPayment ? initialPaymentMethod : undefined,
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

  const feeMajor = Math.max(0, fromMinorUnits(toMinorUnits(monthlyFee)))
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
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Örn. Burger House Kadıköy"
                className={inputCls}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Slug (URL) *
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  const next = toCorderEmailTenantSlug(e.target.value)
                  setSlug(next)
                  setSlugManuallyEdited(Boolean(next))
                }}
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
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Müşteri İletişim E-postası
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Örn: isletme@gmail.com"
                className={inputCls}
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Durum</label>
              <CustomSelect
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className={inputCls}
                disabled={loading}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </CustomSelect>
            </div>
          </div>
        </div>

        <FranchiseConfigCard
          branchType={branchType}
          onBranchTypeChange={setBranchType}
          brandName={brandName}
          onBrandNameChange={setBrandName}
          existingBrands={existingBrands}
          franchiseeCompanyName={franchiseeCompanyName}
          onFranchiseeCompanyNameChange={setFranchiseeCompanyName}
          royaltyRate={royaltyRate}
          onRoyaltyRateChange={setRoyaltyRate}
          inputCls={inputCls}
        />

        <InitialSubscriptionCard
          monthlyFee={monthlyFee}
          onMonthlyFeeChange={setMonthlyFee}
          feeMajor={feeMajor}
          billingStartPeriod={billingStartPeriod}
          onBillingStartPeriodChange={setBillingStartPeriod}
          recordInitialPayment={recordInitialPayment}
          onRecordInitialPaymentChange={setRecordInitialPayment}
          initialPaidMonths={initialPaidMonths}
          onInitialPaidMonthsChange={setInitialPaidMonths}
          initialPaymentMethod={initialPaymentMethod}
          onInitialPaymentMethodChange={setInitialPaymentMethod}
          billingNotes={billingNotes}
          onBillingNotesChange={setBillingNotes}
          inputCls={inputCls}
        />

        <DeviceCredentialsCards
          tenantSlugOrName={slug || name}
          terminalEmail={terminalEmail}
          onTerminalEmailChange={setTerminalEmail}
          terminalPassword={terminalPassword}
          onTerminalPasswordChange={setTerminalPassword}
          printAgentUsername={printAgentUsername}
          onPrintAgentUsernameChange={setPrintAgentUsername}
          printAgentPassword={printAgentPassword}
          onPrintAgentPasswordChange={setPrintAgentPassword}
          disabled={loading}
          inputCls={inputCls}
        />

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
