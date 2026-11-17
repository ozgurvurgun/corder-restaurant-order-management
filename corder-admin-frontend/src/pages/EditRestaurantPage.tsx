import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Trash2, Building2 } from "lucide-react"
import { useAdminStore } from "@/lib/store"
import { fromMinorUnits, toMinorUnits } from "@/lib/money"
import type { RestaurantBillingStatus, RestaurantBranchType } from "@/lib/types"
import { RootAdminsSection } from "@/components/RootAdminsSection"
import {
  PrintAgentTokenSection,
  PrintAgentCategoriesSection,
} from "@/components/PrintAgentTokenSection"
import {
  RestaurantBillingBanner,
  RestaurantBillingSection,
} from "@/components/RestaurantBillingSection"

export function EditRestaurantPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    restaurants,
    restaurantsLoading,
    restaurantsError,
    loadRestaurants,
    updateRestaurant,
    markRestaurantPaid,
    suspendRestaurantUnpaid,
    deleteRestaurant,
    rootAdminsForRestaurant,
    rootAdminsLoading,
    rootAdminsError,
    loadRootAdmins,
    addRootAdmin,
    deleteRootAdmin,
  } = useAdminStore()

  const restaurant = id ? restaurants.find((r) => r.id === id) : undefined

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [taxId, setTaxId] = useState("")
  const [workingHours, setWorkingHours] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  const [brandName, setBrandName] = useState("")
  const [branchType, setBranchType] = useState<RestaurantBranchType>("independent")
  const [franchiseeCompanyName, setFranchiseeCompanyName] = useState("")
  const [royaltyRate, setRoyaltyRate] = useState("0")
  const [monthlyFee, setMonthlyFee] = useState("0")
  const [billingStatus, setBillingStatus] = useState<RestaurantBillingStatus>("paid")
  const [billingNotes, setBillingNotes] = useState("")
  const [error, setError] = useState("")
  const [saveMsg, setSaveMsg] = useState("")
  const [saveLoading, setSaveLoading] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void loadRestaurants()
  }, [loadRestaurants])

  useEffect(() => {
    if (id) void loadRootAdmins(id)
  }, [id, loadRootAdmins])

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name)
      setSlug(restaurant.slug)
      setAddress(restaurant.address ?? "")
      setPhone(restaurant.phone ?? "")
      setEmail(restaurant.email ?? "")
      setTaxId(restaurant.taxId ?? "")
      setWorkingHours(restaurant.workingHours ?? "")
      setStatus(restaurant.status)
      setBrandName(restaurant.brandName ?? "")
      setBranchType(restaurant.branchType ?? "independent")
      setFranchiseeCompanyName(restaurant.franchiseeCompanyName ?? "")
      setRoyaltyRate(String(restaurant.royaltyRate ?? 0))
      setMonthlyFee(String(restaurant.monthlyFee ?? 0))
      setBillingStatus(
        restaurant.isAccessSuspended
          ? "suspended"
          : (restaurant.billingStatus ?? "paid")
      )
      setBillingNotes(restaurant.billingNotes ?? "")
    }
  }, [restaurant])

  if (restaurantsLoading && restaurants.length === 0) {
    return <p className="text-zinc-400">Yükleniyor…</p>
  }

  if (restaurantsError || !id || !restaurant) {
    return (
      <div>
        <p className={restaurantsError ? "text-red-400" : "text-zinc-400"}>
          {restaurantsError || "Restoran bulunamadı."}
        </p>
        <Link
          to="/dashboard/restaurants"
          className="mt-4 inline-block text-blue-400 hover:underline"
        >
          Listeye dön
        </Link>
      </div>
    )
  }

  const handleSaveRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaveMsg("")
    const cleanSlug = slug.trim().toLowerCase()
    if (
      restaurants
        .filter((r) => r.id !== id)
        .some((r) => r.slug === cleanSlug)
    ) {
      setError("Bu slug başka bir restoranda kullanılıyor.")
      return
    }
    setSaveLoading(true)
    try {
      await updateRestaurant(id, {
        name: name.trim(),
        slug: cleanSlug,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        taxId: taxId.trim() || undefined,
        workingHours: workingHours.trim() || undefined,
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
      })
      await loadRootAdmins(id)
      setSaveMsg("Değişiklikler kaydedildi.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız")
    } finally {
      setSaveLoading(false)
    }
  }

  const handleQuickMarkPaid = async () => {
    setBillingBusy(true)
    setError("")
    setSaveMsg("")
    try {
      const feeNum = Math.max(0, fromMinorUnits(toMinorUnits(monthlyFee)))
      if (toMinorUnits(feeNum) !== toMinorUnits(restaurant.monthlyFee ?? 0)) {
        await updateRestaurant(id, { monthlyFee: feeNum })
      }
      await markRestaurantPaid(id, {
        amount: feeNum,
        note: billingNotes.trim() || undefined,
      })
      setSaveMsg(
        "Ödeme alındı bilgisi işlendi ve mekanın tüm sistem erişimleri otomatik açıldı."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız")
    } finally {
      setBillingBusy(false)
    }
  }

  const handleQuickSuspend = async () => {
    if (
      !confirm(
        `${restaurant.name} mekanının ödeme alınmadığı için tüm sistemlere erişimini durdurmak istediğinize emin misiniz?`
      )
    ) {
      return
    }
    setBillingBusy(true)
    setError("")
    setSaveMsg("")
    try {
      await suspendRestaurantUnpaid(
        id,
        billingNotes.trim() ||
          "25-30 tahsilat döneminde ödeme alınmadığı için erişim durduruldu."
      )
      setSaveMsg("Mekanın tüm sistemlere erişimi ödeme alınmadığı için durduruldu.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erişim durdurulamadı")
    } finally {
      setBillingBusy(false)
    }
  }

  const handleDeleteRestaurant = async () => {
    if (
      deleting ||
      !confirm("Bu restoranı ve ilişkili kayıtları silmek istediğinize emin misiniz?")
    ) {
      return
    }
    setDeleting(true)
    try {
      await deleteRestaurant(id)
      navigate("/dashboard/restaurants")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi")
    } finally {
      setDeleting(false)
    }
  }

  const isSuspended = Boolean(
    restaurant.isAccessSuspended || restaurant.billingStatus === "suspended"
  )
  const inputCls =
    "w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"

  return (
    <div>
      <Link
        to="/dashboard/restaurants"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Restoranlara dön
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold text-white">{restaurant.name}</h1>
          {restaurant.brandName && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#e63462]/15 px-2.5 py-1 text-xs font-semibold text-[#e63462]">
              <Building2 className="h-3.5 w-3.5" />
              {restaurant.brandName}
            </span>
          )}
          <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
            {restaurant.branchType === "franchise"
              ? "Franchise Şubesi"
              : restaurant.branchType === "company_owned"
                ? "Merkez / Özmal Şube"
                : "Bağımsız İşletme"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleDeleteRestaurant()}
          disabled={deleting}
          className="flex items-center gap-2 rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? "Siliniyor…" : "Restoranı sil"}
        </button>
      </div>

      <RestaurantBillingBanner
        restaurant={restaurant}
        isSuspended={isSuspended}
        billingBusy={billingBusy}
        onQuickMarkPaid={() => void handleQuickMarkPaid()}
        onQuickSuspend={() => void handleQuickSuspend()}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <h2 className="text-lg font-medium text-white">
            Mekan, Franchise &amp; Abonelik Bilgileri
          </h2>
          <form onSubmit={handleSaveRestaurant} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Restoran adı</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  required
                  disabled={saveLoading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className={`${inputCls} font-mono text-sm`}
                  required
                  disabled={saveLoading}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Adres</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
                disabled={saveLoading}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Telefon</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  disabled={saveLoading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">E-posta</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  disabled={saveLoading}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">
                  Vergi No / VKN
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="Örn: 1234567890"
                  className={inputCls}
                  disabled={saveLoading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">
                  Çalışma Saatleri
                </label>
                <input
                  type="text"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="Örn: 10:00 - 23:00"
                  className={inputCls}
                  disabled={saveLoading}
                />
              </div>
            </div>

            <RestaurantBillingSection
              branchType={branchType}
              onBranchTypeChange={setBranchType}
              brandName={brandName}
              onBrandNameChange={setBrandName}
              franchiseeCompanyName={franchiseeCompanyName}
              onFranchiseeCompanyNameChange={setFranchiseeCompanyName}
              royaltyRate={royaltyRate}
              onRoyaltyRateChange={setRoyaltyRate}
              monthlyFee={monthlyFee}
              onMonthlyFeeChange={setMonthlyFee}
              billingStatus={billingStatus}
              onBillingStatusChange={setBillingStatus}
              billingNotes={billingNotes}
              onBillingNotesChange={setBillingNotes}
              paymentHistory={restaurant.paymentHistory}
              disabled={saveLoading}
            />

            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Genel Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className={inputCls}
                disabled={saveLoading}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {saveMsg && <p className="text-sm text-emerald-400">{saveMsg}</p>}
            <button
              type="submit"
              disabled={saveLoading}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saveLoading ? "Kaydediliyor…" : "Bilgileri Kaydet"}
            </button>
          </form>
        </div>

        <div className="space-y-8">
          <RootAdminsSection
            restaurantId={id}
            brandName={restaurant.brandName}
            rootAdmins={rootAdminsForRestaurant}
            loading={rootAdminsLoading}
            error={rootAdminsError}
            onAddRootAdmin={addRootAdmin}
            onDeleteRootAdmin={deleteRootAdmin}
          />
          <PrintAgentTokenSection
            restaurantId={id}
            initialTerminalEmail={restaurant.terminalEmail}
            initialPrintAgentUsername={restaurant.printAgentUsername}
            onSaveTerminalConfig={async (config) => {
              await updateRestaurant(id, config)
            }}
          />
        </div>
      </div>

      <PrintAgentCategoriesSection restaurantId={id} />
    </div>
  )
}
