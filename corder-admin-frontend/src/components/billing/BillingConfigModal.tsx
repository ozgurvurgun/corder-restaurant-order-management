import { useEffect, useState } from "react"
import type { PlatformBillingConfig } from "@/lib/types"
import { formatMoney } from "@/lib/money"
import { Landmark, Save, DollarSign, CheckCircle2, Clock, Ban } from "lucide-react"

export { formatMoney }

interface BillingKpiCardsProps {
  totalMrr: number
  restaurantsCount: number
  collectedTotal: number
  paidCount: number
  pendingTotal: number
  pendingCount: number
  suspendedCount: number
}

export function BillingKpiCards({
  totalMrr,
  restaurantsCount,
  collectedTotal,
  paidCount,
  pendingTotal,
  pendingCount,
  suspendedCount,
}: BillingKpiCardsProps) {
  const cards = [
    {
      label: "Toplam Aylık Tahsilat Hedefi",
      value: formatMoney(totalMrr),
      sub: `${restaurantsCount} aktif mekan`,
      icon: DollarSign,
      color: "#007aff",
      valueColor: "text-[#1d1d1f]",
    },
    {
      label: "Ödeme Alınan Mekanlar",
      value: formatMoney(collectedTotal),
      sub: `${paidCount} mekan aktif & ödendi`,
      icon: CheckCircle2,
      color: "#34c759",
      valueColor: "text-[#1d1d1f]",
    },
    {
      label: "Tahsilat Bekleyen (25-30)",
      value: formatMoney(pendingTotal),
      sub: `${pendingCount} mekan ödeme bekliyor`,
      icon: Clock,
      color: "#ff9500",
      valueColor: "text-[#1d1d1f]",
    },
    {
      label: "Erişimi Durdurulan Mekanlar",
      value: `${suspendedCount} Mekan`,
      sub: "Ödeme alındığında otomatik açılır",
      icon: Ban,
      color: "#ff3b30",
      valueColor: "text-red-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.label} className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${c.color}15` }}
              >
                <Icon className="w-[18px] h-[18px]" style={{ color: c.color }} />
              </div>
              <span className="text-[11px] font-medium text-[#86868b]">{c.sub}</span>
            </div>
            <p className={`text-[22px] font-bold leading-tight tabular-nums ${c.valueColor}`}>
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
  const [configSavedMsg, setConfigSavedMsg] = useState("")

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
  }, [billingConfig])

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfigSavedMsg("")
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
      setConfigSavedMsg("Banka ve tahsilat bilgileri güncellendi.")
      onNotice("Merchant panelinde gösterilen IBAN ve alıcı bilgileri güncellendi.")
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Ayarlar kaydedilemedi", "err")
    } finally {
      setSavingConfig(false)
    }
  }

  const inputCls =
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"

  return (
    <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="rounded-xl bg-[#e63462]/10 p-2 text-[#e63462]">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
            Tahsilat Banka / IBAN Bilgileri (Merchant Panelinde Gösterilir)
          </h2>
          <p className="text-[12px] text-[#86868b]">
            Restoranların Merchant Panelindeki &ldquo;Abonelik &amp; Ödeme&rdquo; sayfasında göreceği ve tek tıkla kopyalayabileceği Ad Soyad, IBAN ve destek bilgileri.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveConfig} className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
            Alıcı İsim Soyisim / Ünvan *
          </label>
          <input
            type="text"
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            placeholder="Örn: Corder Yazılım ve Teknoloji A.Ş."
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
            IBAN Numarası *
          </label>
          <input
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            minLength={10}
            className={`${inputCls} font-mono`}
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
            placeholder="Örn: Garanti BBVA / Yapı Kredi"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Destek Telefonu
            </label>
            <input
              type="text"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="05XX XXX XX XX"
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
              placeholder="finans@corder.com"
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Tahsilat Başlangıç Günü
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
              Tahsilat Son Günü
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
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
            Ödeme Açıklama Notu
          </label>
          <input
            type="text"
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            placeholder="Havale açıklamasına mekan adını yazınız..."
            className={inputCls}
          />
        </div>
        <div className="md:col-span-3 flex items-center justify-between pt-1">
          <span className="text-[12px] font-medium text-emerald-700">{configSavedMsg}</span>
          <button
            type="submit"
            disabled={savingConfig}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#e63462] px-5 text-[13px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {savingConfig ? "Kaydediliyor…" : "Ödeme & IBAN Bilgilerini Kaydet"}
          </button>
        </div>
      </form>
    </div>
  )
}
