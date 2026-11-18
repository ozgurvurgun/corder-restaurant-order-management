import type {
  Restaurant,
  RestaurantBillingStatus,
  RestaurantBranchType,
} from "@/lib/types"
import { formatIstanbulDate, formatIstanbulDateTime, formatMoney } from "@/lib/money"
import { CreditCard, CheckCircle2, Ban, Clock, ReceiptText } from "lucide-react"

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
      className={`rounded-2xl border p-5 ${
        isSuspended
          ? "border-red-200 bg-red-50/70"
          : "border-[#e5e5ea] bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-xl p-2.5 ${
              isSuspended ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
                Aylık Abonelik Ücreti &amp; Tahsilat Durumu (Her Ayın 25 - 30&apos;u)
              </h2>
              {isSuspended ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                  <Ban className="h-3.5 w-3.5" />
                  Ödeme Alınmadı • Sistem Erişimi Durduruldu
                </span>
              ) : restaurant.billingStatus === "pending" ||
                restaurant.billingStatus === "overdue" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                  <Clock className="h-3.5 w-3.5" />
                  {restaurant.billingStatus === "overdue"
                    ? "Ödeme Gecikti (25-30)"
                    : "Tahsilat Bekleniyor (25-30)"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ödeme Alındı • Sistem Erişimi Açık
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] text-[#86868b]">
              Ödeme alınmadığında &ldquo;Erişimi Durdur&rdquo; ile mekanın tüm panellerini kapatabilir, ödeme yapıldığında &ldquo;Ödeme Alındı İşaretle&rdquo; ile erişimi anında otomatik açabilirsiniz.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] text-[#636366]">
              <span>
                Aylık Ücret:{" "}
                <span className="font-semibold text-[#1d1d1f]">
                  {formatMoney(restaurant.monthlyFee ?? 0)}
                </span>
              </span>
              {restaurant.lastPaymentDate && (
                <span>
                  Son Ödeme:{" "}
                  <span className="font-semibold text-emerald-700">
                    {formatIstanbulDate(restaurant.lastPaymentDate)}
                  </span>
                  {restaurant.lastPaidPeriod ? ` (${restaurant.lastPaidPeriod})` : ""}
                </span>
              )}
              {isSuspended && restaurant.suspendedAt && (
                <span className="text-red-600">
                  Askıya Alınma: <span className="font-semibold">{formatIstanbulDateTime(restaurant.suspendedAt)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={billingBusy}
            onClick={onQuickMarkPaid}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#34c759] px-4 text-[12px] font-semibold text-white hover:bg-[#2db84e] disabled:opacity-50"
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
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 text-[12px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
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
  paymentHistory?: Restaurant["paymentHistory"]
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
  paymentHistory,
  disabled,
}: RestaurantBillingSectionProps) {
  const inputCls =
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"

  return (
    <>
      <div className="border-t border-[#f0f0f0] pt-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
          Marka &amp; Franchise Modeli
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Şube Tipi</label>
            <select
              value={branchType}
              onChange={(e) => onBranchTypeChange(e.target.value as RestaurantBranchType)}
              className={inputCls}
              disabled={disabled}
            >
              <option value="independent">Bağımsız Tekil İşletme</option>
              <option value="company_owned">Merkez / Özmal Şube</option>
              <option value="franchise">Franchise Şubesi</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Marka / Zincir Adı
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => onBrandNameChange(e.target.value)}
              placeholder="Örn: Burger House Türkiye"
              className={inputCls}
              disabled={disabled}
            />
          </div>
          {branchType === "franchise" && (
            <>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Franchise Yatırımcı / Firma
                </label>
                <input
                  type="text"
                  value={franchiseeCompanyName}
                  onChange={(e) => onFranchiseeCompanyNameChange(e.target.value)}
                  placeholder="Yatırımcı firma adı"
                  className={inputCls}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Royalty Oranı (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={royaltyRate}
                  onChange={(e) => onRoyaltyRateChange(e.target.value)}
                  className={inputCls}
                  disabled={disabled}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-[#f0f0f0] pt-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
          Aylık Ücret &amp; Tahsilat (Her Ayın 25 - 30&apos;u)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Aylık Ücret (₺)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={monthlyFee}
              onChange={(e) => onMonthlyFeeChange(e.target.value)}
              className={`${inputCls} font-semibold`}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Ödeme &amp; Erişim Durumu
            </label>
            <select
              value={billingStatus}
              onChange={(e) =>
                onBillingStatusChange(e.target.value as RestaurantBillingStatus)
              }
              className={inputCls}
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
          <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Tahsilat Notu</label>
          <input
            type="text"
            value={billingNotes}
            onChange={(e) => onBillingNotesChange(e.target.value)}
            placeholder="Ödeme veya sözleşme notu..."
            className={inputCls}
            disabled={disabled}
          />
        </div>

        {paymentHistory && paymentHistory.length > 0 && (
          <div className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1d1d1f] mb-2">
              <ReceiptText className="h-3.5 w-3.5 text-[#34c759]" />
              <span>Tahsilat Geçmişi ({paymentHistory.length} kayıt)</span>
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-[#f0f0f0] text-[12px]">
              {paymentHistory.map((item) => (
                <div key={item.id} className="py-1.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-medium text-[#1d1d1f]">{item.period}</span>
                    <span className="mx-1.5 text-[#d1d1d6]">•</span>
                    <span className="text-[#86868b]">
                      {formatIstanbulDateTime(item.paidAt)}
                    </span>
                    {item.note && (
                      <span className="block text-[11px] text-[#636366]">{item.note}</span>
                    )}
                  </div>
                  <span className="font-semibold text-emerald-700 shrink-0 tabular-nums">
                    {formatMoney(item.amount, true)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
