import { useEffect, useState } from "react"
import type { PlatformBillingConfig } from "@/lib/types"
import { formatMoney } from "@/lib/money"
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  DollarSign,
  Landmark,
  Save,
  X,
} from "lucide-react"

interface BillingKpiCardsProps {
  selectedPeriodLabel: string
  periodTargetTotal: number
  billableCount: number
  periodPaidFeeTotal: number
  periodPaidCount: number
  periodCashCollected: number
  unpaidBalanceTotal: number
  unpaidVenuesCount: number
  overduePeriodsCount: number
  suspendedCount: number
}

export function BillingKpiCards({
  selectedPeriodLabel,
  periodTargetTotal,
  billableCount,
  periodPaidFeeTotal,
  periodPaidCount,
  periodCashCollected,
  unpaidBalanceTotal,
  unpaidVenuesCount,
  overduePeriodsCount,
  suspendedCount,
}: BillingKpiCardsProps) {
  const cards = [
    {
      label: `${selectedPeriodLabel} Aylık Hedef`,
      value: formatMoney(periodTargetTotal),
      sub: `${billableCount} aktif mekan`,
      icon: DollarSign,
      color: "#007aff",
      valueColor: "text-[#1d1d1f]",
    },
    {
      label: `${selectedPeriodLabel} Kapsanan / Ödenen`,
      value: `${periodPaidCount} / ${billableCount} Mekan`,
      sub: `Kapsam: ${formatMoney(periodPaidFeeTotal)} • Ay içi kasa: ${formatMoney(periodCashCollected)}`,
      icon: CheckCircle2,
      color: "#34c759",
      valueColor: "text-emerald-700",
    },
    {
      label: "Toplam Açık & Gecikmiş Bakiye",
      value: formatMoney(unpaidBalanceTotal),
      sub:
        overduePeriodsCount > 0
          ? `${unpaidVenuesCount} mekan (${overduePeriodsCount} geçmiş dönem gecikmiş)`
          : `${unpaidVenuesCount} mekan ödeme bekliyor`,
      icon: AlertCircle,
      color: overduePeriodsCount > 0 ? "#ff3b30" : "#ff9500",
      valueColor: overduePeriodsCount > 0 ? "text-red-600" : "text-[#1d1d1f]",
    },
    {
      label: "Erişimi Durdurulan Mekanlar",
      value: `${suspendedCount} Mekan`,
      sub: "Tahsilat girildiğinde otomatik açılır",
      icon: Ban,
      color: "#ff3b30",
      valueColor: suspendedCount > 0 ? "text-red-600" : "text-[#1d1d1f]",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.label} className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${c.color}15` }}
              >
                <Icon className="w-[18px] h-[18px]" style={{ color: c.color }} />
              </div>
              <span className="text-[11px] font-medium text-[#86868b] text-right">
                {c.sub}
              </span>
            </div>
            <p className={`text-[21px] font-bold leading-tight tabular-nums ${c.valueColor}`}>
              {c.value}
            </p>
            <p className="text-[12px] text-[#86868b] mt-0.5">{c.label}</p>
          </div>
        )
      })}
    </div>
  )
}

interface BillingConfigModalProps {
  open: boolean
  onClose: () => void
  billingConfig: PlatformBillingConfig | null
  onUpdateConfig: (data: {
    receiverName: string
    iban: string
    bankName: string
    collectionStartDay: number
    collectionEndDay: number
    supportPhone: string | null
    supportEmail: string | null
    paymentInstructions: string | null
  }) => Promise<void>
  onNotice: (text: string, type?: "ok" | "err") => void
}

export function BillingConfigModal({
  open,
  onClose,
  billingConfig,
  onUpdateConfig,
  onNotice,
}: BillingConfigModalProps) {
  const [receiverName, setReceiverName] = useState("")
  const [iban, setIban] = useState("")
  const [bankName, setBankName] = useState("")
  const [collectionStartDay, setCollectionStartDay] = useState(25)
  const [collectionEndDay, setCollectionEndDay] = useState(30)
  const [supportPhone, setSupportPhone] = useState("")
  const [supportEmail, setSupportEmail] = useState("")
  const [paymentInstructions, setPaymentInstructions] = useState("")
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    if (billingConfig) {
      setReceiverName(billingConfig.receiverName || "")
      setIban(billingConfig.iban || "")
      setBankName(billingConfig.bankName || "")
      setCollectionStartDay(billingConfig.collectionStartDay ?? 25)
      setCollectionEndDay(billingConfig.collectionEndDay ?? 30)
      setSupportPhone(billingConfig.supportPhone ?? "")
      setSupportEmail(billingConfig.supportEmail ?? "")
      setPaymentInstructions(billingConfig.paymentInstructions ?? "")
    }
  }, [billingConfig, open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    const start = Math.max(1, Math.min(31, Number(collectionStartDay) || 25))
    const end = Math.max(1, Math.min(31, Number(collectionEndDay) || 30))
    if (start > end) {
      onNotice("Tahsilat başlangıç günü, son günden büyük olamaz.", "err")
      return
    }
    setSavingConfig(true)
    try {
      await onUpdateConfig({
        receiverName: receiverName.trim(),
        iban: iban.trim(),
        bankName: bankName.trim(),
        collectionStartDay: start,
        collectionEndDay: end,
        supportPhone: supportPhone.trim() || null,
        supportEmail: supportEmail.trim() || null,
        paymentInstructions: paymentInstructions.trim() || null,
      })
      onNotice("Merchant panelinde gösterilen IBAN ve tahsilat bilgileri güncellendi.")
      onClose()
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Ayarlar kaydedilemedi", "err")
    } finally {
      setSavingConfig(false)
    }
  }

  const inputCls =
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f0f0f0] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#e63462]/10 p-2 text-[#e63462]">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[#1d1d1f]">
                Tahsilat Banka / IBAN &amp; Gün Ayarları
              </h2>
              <p className="text-[12px] text-[#86868b]">
                Merchant Panelindeki &ldquo;Abonelik &amp; Ödeme&rdquo; sayfasında gösterilen alıcı ve IBAN bilgileri
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSaveConfig} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Alıcı İsim Soyisim / Ünvan *
            </label>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Banka Adı
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Örn: Yapı Kredi / Garanti BBVA"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              IBAN Numarası *
            </label>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              minLength={10}
              className={`${inputCls} font-mono`}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Destek Telefonu
            </label>
            <input
              type="text"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Destek E-postası
            </label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Tahsilat Başlangıç Günü (Ayın Günü)
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={collectionStartDay}
              onChange={(e) => setCollectionStartDay(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Tahsilat Son Günü (Ayın Günü)
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={collectionEndDay}
              onChange={(e) => setCollectionEndDay(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Ödeme Açıklama Notu
            </label>
            <input
              type="text"
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2 flex justify-end gap-2 border-t border-[#f0f0f0] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#d1d1d6] bg-white px-4 text-[13px] font-medium text-[#636366] hover:bg-[#f5f5f7]"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={savingConfig}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#e63462] px-5 text-[13px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingConfig ? "Kaydediliyor…" : "Ayarları Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
