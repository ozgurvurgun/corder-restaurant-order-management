import { useEffect, useState } from "react"
import type { PlatformBillingConfig } from "@/lib/types"
import { formatMoney } from "@/lib/money"
import { Landmark, Save } from "lucide-react"

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
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
        <p className="text-xs font-medium text-zinc-400">Toplam Aylık Tahsilat Hedefi</p>
        <p className="mt-2 text-2xl font-bold text-white">{formatMoney(totalMrr)}</p>
        <p className="mt-1 text-xs text-zinc-500">{restaurantsCount} aktif mekan</p>
      </div>
      <div className="rounded-xl border border-emerald-500/30 bg-[#1a1a1a] p-5">
        <p className="text-xs font-medium text-emerald-400">Ödeme Alınan Mekanlar</p>
        <p className="mt-2 text-2xl font-bold text-emerald-400">{formatMoney(collectedTotal)}</p>
        <p className="mt-1 text-xs text-zinc-400">{paidCount} mekan aktif &amp; ödendi</p>
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-[#1a1a1a] p-5">
        <p className="text-xs font-medium text-amber-400">Tahsilat Bekleyen (25-30)</p>
        <p className="mt-2 text-2xl font-bold text-amber-400">{formatMoney(pendingTotal)}</p>
        <p className="mt-1 text-xs text-zinc-400">{pendingCount} mekan ödeme bekliyor</p>
      </div>
      <div className="rounded-xl border border-red-500/30 bg-[#1a1a1a] p-5">
        <p className="text-xs font-medium text-red-400">Erişimi Durdurulan Mekanlar</p>
        <p className="mt-2 text-2xl font-bold text-red-400">{suspendedCount} Mekan</p>
        <p className="mt-1 text-xs text-zinc-400">
          Ödeme alındı işaretlendiğinde otomatik açılır
        </p>
      </div>
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

  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="rounded-lg bg-[#e63462]/15 p-2">
          <Landmark className="h-5 w-5 text-[#e63462]" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">
            Tahsilat Banka / IBAN Bilgileri (Merchant Panelinde Gösterilir)
          </h2>
          <p className="text-xs text-zinc-400">
            Restoranların Merchant Panelindeki &ldquo;Ödeme &amp; Abonelik&rdquo; sayfasında göreceği ve tek tıkla kopyalayabileceği Ad Soyad, IBAN ve destek bilgileri.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveConfig} className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            Alıcı İsim Soyisim / Ünvan *
          </label>
          <input
            type="text"
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            placeholder="Örn: Corder Yazılım ve Teknoloji A.Ş."
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2 text-sm text-white outline-none focus:border-[#e63462]"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            IBAN Numarası *
          </label>
          <input
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            minLength={10}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2 font-mono text-sm text-white outline-none focus:border-[#e63462]"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            Banka Adı
          </label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Örn: Garanti BBVA / Ziraat Bankası"
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2 text-sm text-white outline-none focus:border-[#e63462]"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Destek Telefonu
            </label>
            <input
              type="text"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="0850 300 00 00"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#e63462]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Destek E-postası
            </label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="finans@corder.com"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#e63462]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Tahsilat Başlangıç Günü
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={collectionStartDay}
              onChange={(e) => setCollectionStartDay(Number(e.target.value))}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#e63462]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Tahsilat Son Günü
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={collectionEndDay}
              onChange={(e) => setCollectionEndDay(Number(e.target.value))}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#e63462]"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            Ödeme Açıklama Notu
          </label>
          <input
            type="text"
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            placeholder="Havale açıklamasına mekan adını yazınız..."
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2 text-sm text-white outline-none focus:border-[#e63462]"
          />
        </div>
        <div className="md:col-span-3 flex items-center justify-between pt-1">
          <span className="text-xs text-emerald-400">{configSavedMsg}</span>
          <button
            type="submit"
            disabled={savingConfig}
            className="inline-flex items-center gap-2 rounded-xl bg-[#e63462] px-5 py-2 text-xs font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {savingConfig ? "Kaydediliyor…" : "Ödeme & IBAN Bilgilerini Kaydet"}
          </button>
        </div>
      </form>
    </div>
  )
}
