import type {
  Restaurant,
  RestaurantBillingStatus,
  RestaurantBranchType,
} from "@/lib/types"
import { CreditCard, CheckCircle2, Ban, Clock } from "lucide-react"

interface RestaurantBillingBannerProps {
  restaurant: Restaurant
  isSuspended: boolean
  billingBusy: boolean
  onQuickMarkPaid: () => void
  onQuickSuspend: () => void
}

export function RestaurantBillingBanner({
  restaurant,
  isSuspended,
  billingBusy,
  onQuickMarkPaid,
  onQuickSuspend,
}: RestaurantBillingBannerProps) {
  return (
    <div
      className={`mt-6 rounded-2xl border p-6 ${
        isSuspended
          ? "border-red-500/40 bg-red-950/20"
          : "border-[#2a2a2a] bg-[#1a1a1a]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-xl p-2.5 ${
              isSuspended ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                Aylık Abonelik Ücreti &amp; Tahsilat Durumu (Her Ayın 25 - 30&apos;u)
              </h2>
              {isSuspended ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-0.5 text-xs font-semibold text-red-300">
                  <Ban className="h-3.5 w-3.5" />
                  Ödeme Alınmadı • Sistem Erişimi Durduruldu
                </span>
              ) : restaurant.billingStatus === "pending" ||
                restaurant.billingStatus === "overdue" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-0.5 text-xs font-semibold text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  Tahsilat Bekleniyor (25-30)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ödeme Alındı • Sistem Erişimi Açık
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Ödeme alınmadığında &ldquo;Erişimi Durdur&rdquo; ile mekanın tüm panellerini kapatabilir, ödeme yapıldığında &ldquo;Ödeme Alındı İşaretle&rdquo; ile erişimi anında otomatik açabilirsiniz.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={billingBusy}
            onClick={onQuickMarkPaid}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSuspended
              ? "Ödeme Alındı İşaretle (Erişimi Otomatik Aç)"
              : "Ödeme Alındı İşaretle"}
          </button>
          {!isSuspended && (
            <button
              type="button"
              disabled={billingBusy}
              onClick={onQuickSuspend}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              Ödeme Alınmadı — Tüm Erişimi Durdur
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface RestaurantBillingSectionProps {
  branchType: RestaurantBranchType
  onBranchTypeChange: (value: RestaurantBranchType) => void
  brandName: string
  onBrandNameChange: (value: string) => void
  franchiseeCompanyName: string
  onFranchiseeCompanyNameChange: (value: string) => void
  royaltyRate: string
  onRoyaltyRateChange: (value: string) => void
  monthlyFee: string
  onMonthlyFeeChange: (value: string) => void
  billingStatus: RestaurantBillingStatus
  onBillingStatusChange: (value: RestaurantBillingStatus) => void
  billingNotes: string
  onBillingNotesChange: (value: string) => void
  disabled: boolean
}

export function RestaurantBillingSection({
  branchType,
  onBranchTypeChange,
  brandName,
  onBrandNameChange,
  franchiseeCompanyName,
  onFranchiseeCompanyNameChange,
  royaltyRate,
  onRoyaltyRateChange,
  monthlyFee,
  onMonthlyFeeChange,
  billingStatus,
  onBillingStatusChange,
  billingNotes,
  onBillingNotesChange,
  disabled,
}: RestaurantBillingSectionProps) {
  return (
    <>
      <div className="border-t border-[#2a2a2a] pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Marka &amp; Franchise Modeli
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-300">Şube Tipi</label>
            <select
              value={branchType}
              onChange={(e) => onBranchTypeChange(e.target.value as RestaurantBranchType)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#e63462]"
              disabled={disabled}
            >
              <option value="independent">Bağımsız Tekil İşletme</option>
              <option value="company_owned">Merkez / Özmal Şube</option>
              <option value="franchise">Franchise Şubesi</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-300">
              Marka / Zincir Adı
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => onBrandNameChange(e.target.value)}
              placeholder="Örn: Burger House Türkiye"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#e63462]"
              disabled={disabled}
            />
          </div>
          {branchType === "franchise" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-300">
                  Franchise Yatırımcı / Firma
                </label>
                <input
                  type="text"
                  value={franchiseeCompanyName}
                  onChange={(e) => onFranchiseeCompanyNameChange(e.target.value)}
                  placeholder="Yatırımcı firma adı"
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#e63462]"
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-300">
                  Royalty Oranı (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={royaltyRate}
                  onChange={(e) => onRoyaltyRateChange(e.target.value)}
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#e63462]"
                  disabled={disabled}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-[#2a2a2a] pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Aylık Ücret &amp; Tahsilat (Her Ayın 25 - 30&apos;u)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-300">
              Aylık Ücret (₺)
            </label>
            <input
              type="number"
              min={0}
              step="50"
              value={monthlyFee}
              onChange={(e) => onMonthlyFeeChange(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-emerald-500"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-300">
              Ödeme &amp; Erişim Durumu
            </label>
            <select
              value={billingStatus}
              onChange={(e) =>
                onBillingStatusChange(e.target.value as RestaurantBillingStatus)
              }
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              disabled={disabled}
            >
              <option value="paid">Ödeme Alındı (Erişim Açık)</option>
              <option value="pending">Ödeme Bekleniyor (25-30 Tahsilat)</option>
              <option value="overdue">Ödeme Gecikti</option>
              <option value="suspended">Ödeme Alınmadı (Erişimi Durdur)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-300">Tahsilat Notu</label>
          <input
            type="text"
            value={billingNotes}
            onChange={(e) => onBillingNotesChange(e.target.value)}
            placeholder="Ödeme veya sözleşme notu..."
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            disabled={disabled}
          />
        </div>
      </div>
    </>
  )
}
