import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Trash2, Building2 } from "lucide-react"
import { useAdminStore } from "@/lib/store"
import { formatMoney, formatPeriodsSummary, fromMinorUnits, getIstanbulBillingPeriod, toMinorUnits } from "@/lib/money"
import type { RestaurantBranchType, RestaurantPaymentRecord } from "@/lib/types"
import { RootAdminsSection } from "@/components/RootAdminsSection"
import { PrintAgentTokenSection } from "@/components/PrintAgentTokenSection"
import { RestaurantBillingBanner, RestaurantBillingSection } from "@/components/RestaurantBillingSection"
import { PaymentFormModal } from "@/components/billing/PaymentFormModal"
import { RestaurantBillingHistoryModal } from "@/components/billing/RestaurantBillingHistoryModal"
import { CustomSelect } from "@/components/ui/custom-inputs"
import { toCorderEmailTenantSlug } from "@/lib/corder-email"

export function EditRestaurantPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    restaurants,
    restaurantsLoading,
    restaurantsError,
    loadRestaurants,
    billingConfig,
    loadBillingConfig,
    updateRestaurant,
    recordRestaurantPayment,
    updateRestaurantPayment,
    deleteRestaurantPayment,
    suspendRestaurantUnpaid,
    unsuspendRestaurantAccess,
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
  const [billingStartPeriod, setBillingStartPeriod] = useState(getIstanbulBillingPeriod)
  const [billingNotes, setBillingNotes] = useState("")
  const [error, setError] = useState("")
  const [saveMsg, setSaveMsg] = useState("")
  const [saveLoading, setSaveLoading] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [paymentModalOpen, setPaymentModalOpen] = useState<{
    initialPeriod?: string
    editingPayment?: RestaurantPaymentRecord
  } | null>(null)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)

  useEffect(() => {
    void loadRestaurants()
    void loadBillingConfig()
  }, [loadRestaurants, loadBillingConfig])

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
      setBillingStartPeriod(
        restaurant.billingStartPeriod || getIstanbulBillingPeriod(new Date(restaurant.createdAt))
      )
      setBillingNotes(restaurant.billingNotes ?? "")
    }
  }, [restaurant])

  if (restaurantsLoading && restaurants.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-10 text-center text-[13px] text-[#86868b]">
        Yükleniyor…
      </div>
    )
  }

  if (restaurantsError || !id || !restaurant) {
    return (
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-6">
        <p className={restaurantsError ? "text-red-600 text-[13px]" : "text-[#86868b] text-[13px]"}>
          {restaurantsError || "Restoran bulunamadı."}
        </p>
        <Link
          to="/dashboard/restaurants"
          className="mt-3 inline-block text-[13px] font-semibold text-[#e63462] hover:underline"
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
    const cleanSlug = toCorderEmailTenantSlug(slug || name)
    if (!cleanSlug) {
      setError("Geçerli bir slug girin.")
      return
    }
    if (restaurants.some((r) => r.id !== id && r.slug === cleanSlug)) {
      setError("Bu slug başka bir restoranda kullanılıyor.")
      return
    }
    const cleanEmail = email.trim().toLowerCase()
    setSaveLoading(true)
    try {
      await updateRestaurant(id, {
        name: name.trim(),
        slug: cleanSlug,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: cleanEmail || undefined,
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
        billingStartPeriod,
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

  const handleQuickSuspend = async () => {
    if (
      !confirm(
        `${restaurant.name} mekanının tüm sistemlere erişimini durdurmak istediğinize emin misiniz?`
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
        billingNotes.trim() || "Ödeme alınmadığı için erişim durduruldu."
      )
      setSaveMsg("Mekanın tüm sistemlere erişimi durduruldu.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erişim durdurulamadı")
    } finally {
      setBillingBusy(false)
    }
  }

  const handleQuickUnsuspend = async () => {
    setBillingBusy(true)
    setError("")
    setSaveMsg("")
    try {
      await unsuspendRestaurantAccess(id)
      setSaveMsg("Mekanın sistem erişimi yeniden açıldı.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erişim açılamadı")
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
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard/restaurants"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#636366] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]"
            title="Restoranlara Dön"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">{restaurant.name}</h2>
            {restaurant.brandName && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#e63462]/10 px-2 py-0.5 text-[11px] font-semibold text-[#e63462]">
                <Building2 className="h-3 w-3" />
                {restaurant.brandName}
              </span>
            )}
            <span className="rounded-md bg-[#f5f5f7] px-2 py-0.5 text-[11px] font-medium text-[#636366]">
              {restaurant.branchType === "franchise"
                ? "Franchise Şubesi"
                : restaurant.branchType === "company_owned"
                  ? "Merkez / Özmal Şube"
                  : "Bağımsız İşletme"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleDeleteRestaurant()}
          disabled={deleting}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 text-[12px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleting ? "Siliniyor…" : "Restoranı Sil"}
        </button>
      </div>

      <RestaurantBillingBanner
        restaurant={restaurant}
        isSuspended={isSuspended}
        billingBusy={billingBusy}
        onOpenPaymentModal={() => setPaymentModalOpen({})}
        onOpenHistoryModal={() => setHistoryModalOpen(true)}
        onSuspend={() => void handleQuickSuspend()}
        onUnsuspend={() => void handleQuickUnsuspend()}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
            Mekan, Franchise &amp; Abonelik Bilgileri
          </h2>
          <form onSubmit={handleSaveRestaurant} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Restoran Adı
                </label>
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
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Slug
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className={`${inputCls} font-mono`}
                  required
                  disabled={saveLoading}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Adres
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
                disabled={saveLoading}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  disabled={saveLoading}
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
                  disabled={saveLoading}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
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
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
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
              billingStartPeriod={billingStartPeriod}
              onBillingStartPeriodChange={setBillingStartPeriod}
              billingNotes={billingNotes}
              onBillingNotesChange={setBillingNotes}
              paymentHistory={restaurant.paymentHistory}
              disabled={saveLoading}
            />

            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Genel Durum
              </label>
              <CustomSelect
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className={inputCls}
                disabled={saveLoading}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </CustomSelect>
            </div>
            {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
            {saveMsg && (
              <p className="text-[13px] font-medium text-emerald-700">{saveMsg}</p>
            )}
            <button
              type="submit"
              disabled={saveLoading}
              className="h-10 rounded-xl bg-[#e63462] px-5 text-[13px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
            >
              {saveLoading ? "Kaydediliyor…" : "Bilgileri Kaydet"}
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <RootAdminsSection
            restaurantId={id}
            restaurantSlug={slug || restaurant.slug}
            brandName={brandName || restaurant.brandName}
            rootAdmins={rootAdminsForRestaurant}
            loading={rootAdminsLoading}
            error={rootAdminsError}
            onAddRootAdmin={addRootAdmin}
            onDeleteRootAdmin={deleteRootAdmin}
          />
          <PrintAgentTokenSection
            restaurantId={id}
            restaurantSlug={slug || restaurant.slug}
            initialTerminalEmail={restaurant.terminalEmail}
            initialPrintAgentUsername={restaurant.printAgentUsername}
            onSaveTerminalConfig={async (config) => {
              await updateRestaurant(id, config)
            }}
          />
        </div>
      </div>

      <PaymentFormModal
        restaurant={paymentModalOpen ? restaurant : null}
        initialPeriod={paymentModalOpen?.initialPeriod}
        editingPayment={paymentModalOpen?.editingPayment}
        onClose={() => setPaymentModalOpen(null)}
        onSubmitNew={async (_r, payload) => {
          await recordRestaurantPayment(id, payload)
          setSaveMsg(`${formatPeriodsSummary(payload.periods)} (${formatMoney(payload.amount)}) tahsilatı kaydedildi.`)
        }}
        onSubmitEdit={async (_r, paymentId, payload) => {
          await updateRestaurantPayment(id, paymentId, payload)
          setSaveMsg("Tahsilat kaydı güncellendi.")
        }}
      />

      <RestaurantBillingHistoryModal
        restaurant={historyModalOpen ? restaurant : null}
        collectionEndDay={billingConfig?.collectionEndDay ?? 30}
        onClose={() => setHistoryModalOpen(false)}
        onOpenNewPayment={(_r, period) => setPaymentModalOpen({ initialPeriod: period })}
        onEditPayment={(_r, payment) => setPaymentModalOpen({ editingPayment: payment })}
        onDeletePayment={async (_r, payment) => {
          await deleteRestaurantPayment(id, payment.id)
          setSaveMsg("Tahsilat kaydı silindi.")
        }}
      />
    </div>
  )
}
