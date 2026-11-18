import { PAYMENT_METHOD_LABELS, formatMoney } from "@/lib/money"
import type {
  RestaurantBranchType,
  SubscriptionPaymentMethod,
} from "@/lib/types"
import { Building2, CreditCard, Monitor, Printer } from "lucide-react"
import { CorderEmailInput } from "@/components/CorderEmailInput"

interface FranchiseConfigCardProps {
  branchType: RestaurantBranchType
  onBranchTypeChange: (v: RestaurantBranchType) => void
  brandName: string
  onBrandNameChange: (v: string) => void
  existingBrands: string[]
  franchiseeCompanyName: string
  onFranchiseeCompanyNameChange: (v: string) => void
  royaltyRate: string
  onRoyaltyRateChange: (v: string) => void
  inputCls: string
}

export function FranchiseConfigCard({
  branchType,
  onBranchTypeChange,
  brandName,
  onBrandNameChange,
  existingBrands,
  franchiseeCompanyName,
  onFranchiseeCompanyNameChange,
  royaltyRate,
  onRoyaltyRateChange,
  inputCls,
}: FranchiseConfigCardProps) {
  return (
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
            onChange={(e) => onBranchTypeChange(e.target.value as RestaurantBranchType)}
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
            onChange={(e) => onBrandNameChange(e.target.value)}
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
                onChange={(e) => onFranchiseeCompanyNameChange(e.target.value)}
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
                onChange={(e) => onRoyaltyRateChange(e.target.value)}
                className={inputCls}
              />
            </div>
          </>
        )}
      </div>
      <p className="text-[12px] text-[#86868b]">
        Bir üst marka adı girdiğinizde, o markanın &ldquo;Marka Sahibi (HQ)&rdquo; olan Boss hesabı bu şubeyi ve tüm cirosunu otomatik olarak görür.
      </p>
    </div>
  )
}

interface InitialSubscriptionCardProps {
  monthlyFee: string
  onMonthlyFeeChange: (v: string) => void
  feeMajor: number
  billingStartPeriod: string
  onBillingStartPeriodChange: (v: string) => void
  recordInitialPayment: boolean
  onRecordInitialPaymentChange: (v: boolean) => void
  initialPaidMonths: number
  onInitialPaidMonthsChange: (v: number) => void
  initialPaymentMethod: SubscriptionPaymentMethod
  onInitialPaymentMethodChange: (v: SubscriptionPaymentMethod) => void
  billingNotes: string
  onBillingNotesChange: (v: string) => void
  inputCls: string
}

export function InitialSubscriptionCard({
  monthlyFee,
  onMonthlyFeeChange,
  feeMajor,
  billingStartPeriod,
  onBillingStartPeriodChange,
  recordInitialPayment,
  onRecordInitialPaymentChange,
  initialPaidMonths,
  onInitialPaidMonthsChange,
  initialPaymentMethod,
  onInitialPaymentMethodChange,
  billingNotes,
  onBillingNotesChange,
  inputCls,
}: InitialSubscriptionCardProps) {
  return (
    <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-[#34c759]" />
        <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
          Abonelik Ücreti &amp; Başlangıç Dönemi
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
            Aylık Abonelik Ücreti (₺) *
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={monthlyFee}
            onChange={(e) => onMonthlyFeeChange(e.target.value)}
            placeholder="2500"
            className={`${inputCls} font-semibold`}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
            Abonelik Başlangıç Dönemi (Ay / Yıl) *
          </label>
          <input
            type="month"
            value={billingStartPeriod}
            onChange={(e) => {
              if (e.target.value) onBillingStartPeriodChange(e.target.value)
            }}
            className={inputCls}
            required
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5 space-y-3">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={recordInitialPayment}
            onChange={(e) => onRecordInitialPaymentChange(e.target.checked)}
            className="h-4 w-4 accent-[#34c759]"
          />
          <span className="text-[13px] font-medium text-[#1d1d1f]">
            Kurulum sırasında peşin tahsilat alındı (ilk ödeme kaydını otomatik oluştur)
          </span>
        </label>

        {recordInitialPayment && (
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Peşin Ödenen Süre
              </label>
              <select
                value={initialPaidMonths}
                onChange={(e) => onInitialPaidMonthsChange(Number(e.target.value))}
                className={inputCls}
              >
                <option value={1}>1 Aylık ({formatMoney(feeMajor)})</option>
                <option value={3}>3 Aylık ({formatMoney(feeMajor * 3)})</option>
                <option value={6}>6 Aylık ({formatMoney(feeMajor * 6)})</option>
                <option value={12}>12 Aylık ({formatMoney(feeMajor * 12)})</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Ödeme Yöntemi
              </label>
              <select
                value={initialPaymentMethod}
                onChange={(e) =>
                  onInitialPaymentMethodChange(
                    e.target.value as SubscriptionPaymentMethod
                  )
                }
                className={inputCls}
              >
                {(
                  Object.entries(PAYMENT_METHOD_LABELS) as Array<
                    [SubscriptionPaymentMethod, string]
                  >
                ).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
          Sözleşme / Abonelik Notu
        </label>
        <input
          type="text"
          value={billingNotes}
          onChange={(e) => onBillingNotesChange(e.target.value)}
          placeholder="İsteğe bağlı sözleşme veya ödeme notu..."
          className={inputCls}
        />
      </div>
    </div>
  )
}

interface DeviceCredentialsCardsProps {
  tenantSlugOrName?: string
  terminalEmail: string
  onTerminalEmailChange: (v: string) => void
  terminalPassword: string
  onTerminalPasswordChange: (v: string) => void
  printAgentUsername: string
  onPrintAgentUsernameChange: (v: string) => void
  printAgentPassword: string
  onPrintAgentPasswordChange: (v: string) => void
  disabled: boolean
  inputCls: string
}

export function DeviceCredentialsCards({
  tenantSlugOrName,
  terminalEmail,
  onTerminalEmailChange,
  terminalPassword,
  onTerminalPasswordChange,
  printAgentUsername,
  onPrintAgentUsernameChange,
  printAgentPassword,
  onPrintAgentPasswordChange,
  disabled,
  inputCls,
}: DeviceCredentialsCardsProps) {
  return (
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
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Terminal E-posta
            </label>
            <CorderEmailInput
              value={terminalEmail}
              onChange={onTerminalEmailChange}
              tenantSlugOrName={tenantSlugOrName}
              placeholder="terminal"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Terminal Parola (en az 4 krk)
            </label>
            <input
              type="password"
              value={terminalPassword}
              onChange={(e) => onTerminalPasswordChange(e.target.value)}
              placeholder="••••••••"
              minLength={4}
              autoComplete="new-password"
              className={inputCls}
              disabled={disabled}
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
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              value={printAgentUsername}
              onChange={(e) => onPrintAgentUsernameChange(e.target.value)}
              placeholder="Örn: merkez-yazici"
              minLength={3}
              className={`${inputCls} font-mono`}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Parola (en az 6 krk)
            </label>
            <input
              type="password"
              value={printAgentPassword}
              onChange={(e) => onPrintAgentPasswordChange(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className={inputCls}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

