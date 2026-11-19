import { useEffect, useState } from "react"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/format"
import type { MerchantBillingInfoDto } from "@/lib/api/system.api"
import { usePanelToast } from "./panel-toast"
import {
  Landmark,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarClock,
  Phone,
  Mail,
  FileText,
  Building2,
} from "lucide-react"

const billingInfoCache = new Map<string, MerchantBillingInfoDto>()

const TURKISH_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
]

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Havale / EFT",
  cash: "Nakit",
  credit_card: "Kredi Kartı",
  other: "Diğer",
}

function formatPeriodTr(period?: string | null): string {
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period || "-"
  const [y, m] = period.split("-")
  return `${TURKISH_MONTHS[Number(m) - 1] ?? m} ${y}`
}

function formatCoveredPeriods(periods?: string[], fallback?: string): string {
  const valid = (periods ?? []).filter((p) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p)).sort()
  if (valid.length === 0) return formatPeriodTr(fallback)
  if (valid.length === 1) return formatPeriodTr(valid[0])
  return `${valid.length} Ay (${formatPeriodTr(valid[0])} – ${formatPeriodTr(valid[valid.length - 1])})`
}

export function prefetchBillingInfo(token: string | null, branchId?: string | null) {
  if (!token) return
  const cacheKey = branchId || "default"
  api.restaurant
    .getBillingInfo(token)
    .then((res) => {
      billingInfoCache.set(cacheKey, res)
    })
    .catch(() => {})
}

export default function BillingView() {
  const { token, currentBusiness } = usePanelAuth()
  const { showToast } = usePanelToast()
  const cacheKey = currentBusiness?.id || "default"
  const [info, setInfo] = useState<MerchantBillingInfoDto | null>(
    () => billingInfoCache.get(cacheKey) ?? null,
  )
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const cached = billingInfoCache.get(cacheKey)
    if (cached) {
      setInfo(cached)
    }
    api.restaurant
      .getBillingInfo(token)
      .then((res) => {
        billingInfoCache.set(cacheKey, res)
        setInfo(res)
      })
      .catch(() => {})
  }, [token, cacheKey])

  const copyToClipboard = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      showToast(`${label} panoya kopyalandı`, "success")
      window.setTimeout(() => {
        setCopiedKey((cur) => (cur === key ? null : cur))
      }, 2500)
    } catch {
      showToast("Kopyalama başarısız oldu", "error")
    }
  }

  const now = new Date()
  const dayOfMonth = now.getDate()
  const startDay = info?.paymentAccount.collectionStartDay ?? 25
  const endDay = info?.paymentAccount.collectionEndDay ?? 30
  const isCollectionWindow = dayOfMonth >= startDay && dayOfMonth <= endDay

  const isPaidForCurrent =
    info?.isCurrentPeriodPaid ?? info?.billingStatus === "paid"
  const overduePeriods = info?.overduePeriods ?? []
  const duePeriods = info?.duePeriods ?? []
  const showUnpaidWarning =
    Boolean(info) &&
    (!isPaidForCurrent || overduePeriods.length > 0) &&
    (isCollectionWindow || overduePeriods.length > 0 || info?.billingStatus === "overdue")

  const receiverName = info?.paymentAccount.receiverName || "Corder Yazılım ve Teknoloji A.Ş."
  const iban = info?.paymentAccount.iban || "TR33 0006 1005 1978 6457 8413 26"
  const bankName = info?.paymentAccount.bankName || "Garanti BBVA"
  const suggestedNote =
    info?.paymentAccount.suggestedTransferNote ||
    `${currentBusiness?.name || "İşletme"} - Abonelik Ücreti`

  const dueMultiplier = Math.max(1, duePeriods.length)
  const payableAmount = (info?.monthlyFee ?? 0) * dueMultiplier

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-end px-5 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
          <CalendarClock className="w-3.5 h-3.5 text-[#e63462]" />
          <span>
            Tahsilat Dönemi:{" "}
            <span className="font-medium text-[#1d1d1f]">
              Her Ayın {startDay} – {endDay}&apos;u Arası
            </span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="w-full flex flex-col gap-4">
          {/* Unpaid / Collection Window Warning Banner (only shown when actually unpaid!) */}
          {showUnpaidWarning && (
            <div
              className={`rounded-xl border p-4 flex items-start gap-3 ${
                overduePeriods.length > 0
                  ? "border-red-300/80 bg-red-50/80"
                  : "border-amber-300/80 bg-amber-50/80"
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                  overduePeriods.length > 0 ? "text-red-600" : "text-amber-600"
                }`}
              />
              <div
                className={`text-[13px] ${
                  overduePeriods.length > 0 ? "text-red-900" : "text-amber-900"
                }`}
              >
                <p className="font-semibold">
                  {overduePeriods.length > 0
                    ? `Gecikmiş Abonelik Ödemesi (${overduePeriods.map((p) => formatPeriodTr(p)).join(", ")})`
                    : `Aylık Tahsilat Dönemi Hatırlatması (Her Ayın ${startDay} – ${endDay}'u Arası)`}
                </p>
                <p
                  className={`mt-0.5 text-[12px] ${
                    overduePeriods.length > 0 ? "text-red-800" : "text-amber-800"
                  }`}
                >
                  Sistem erişiminizin kesintisiz devam etmesi için lütfen{" "}
                  {duePeriods.length > 0
                    ? `${duePeriods.map((p) => formatPeriodTr(p)).join(", ")} dönemine ait ₺${formatCurrency(payableAmount)} tutarındaki`
                    : "aylık abonelik"}{" "}
                  ödemenizi aşağıdaki IBAN hesabına gerçekleştiriniz.
                </p>
              </div>
            </div>
          )}

          {/* Subscription Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#d1d1d6]/60 bg-white p-4">
              <p className="text-[11px] font-medium text-[#86868b]">
                Mekan Aylık Ücreti
              </p>
              <p className="mt-1.5 text-[22px] font-bold text-[#1d1d1f]">
                ₺{formatCurrency(info?.monthlyFee ?? 0)}
                <span className="text-[12px] font-normal text-[#86868b]"> / Ay</span>
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#86868b]">
                <Building2 className="w-3.5 h-3.5 text-[#e63462]" />
                <span>{info?.restaurantName || currentBusiness?.name}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#d1d1d6]/60 bg-white p-4">
              <p className="text-[11px] font-medium text-[#86868b]">
                Güncel Dönem &amp; Erişim Durumu
              </p>
              <div className="mt-2">
                {overduePeriods.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200/80 px-2.5 py-1 text-[12px] font-medium text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Ödeme Gecikti ({overduePeriods.length} Dönem)
                  </span>
                ) : !isPaidForCurrent ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-[12px] font-medium text-amber-700">
                    <Clock className="w-3.5 h-3.5" />
                    {formatPeriodTr(info?.currentPeriod)} Bekleniyor
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ödeme Alındı • Sistem Aktif
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-[#86868b]">
                {info?.paidThroughPeriod && isPaidForCurrent
                  ? `${formatPeriodTr(info.paidThroughPeriod)} sonuna kadar abonelik açık`
                  : `Tahsilat Günü: Her ayın ${startDay} - ${endDay}'u arası`}
              </p>
            </div>

            <div className="rounded-xl border border-[#d1d1d6]/60 bg-white p-4">
              <p className="text-[11px] font-medium text-[#86868b]">
                Son Tahsilat Kaydı
              </p>
              <p className="mt-1.5 text-[18px] font-bold text-[#1d1d1f]">
                {info?.lastPaymentDate
                  ? new Date(info.lastPaymentDate).toLocaleDateString("tr-TR")
                  : "Henüz Kayıt Yok"}
              </p>
              <p className="mt-1.5 text-[11px] text-[#86868b]">
                {info?.paidThroughPeriod
                  ? `Kapsanan Son Dönem: ${formatPeriodTr(info.paidThroughPeriod)}`
                  : "Ödeme işlendiğinde burada görüntülenir"}
              </p>
            </div>
          </div>

          {/* Bank / IBAN Payment Card with Copy Buttons */}
          <div className="rounded-xl border border-[#d1d1d6]/60 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#e63462]/10 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-[#e63462]" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                    Havale / EFT Ödeme Hesap Bilgileri
                  </h3>
                  <p className="text-[12px] text-[#86868b]">
                    Kullanım ücretinizi yatıracağınız İsim Soyisim ve IBAN bilgilerini tek tıkla kopyalayabilirsiniz.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  void copyToClipboard(
                    `Alıcı: ${receiverName}\nBanka: ${bankName}\nIBAN: ${iban}\nTutar: ₺${formatCurrency(payableAmount)}\nAçıklama: ${suggestedNote}`,
                    "all",
                    "Tüm ödeme bilgileri"
                  )
                }
                className="h-[32px] inline-flex items-center gap-1.5 rounded-lg border border-[#e63462]/30 bg-[#fef3f5] px-3 text-[12px] font-medium text-[#e63462] hover:bg-[#e63462]/15 transition-colors"
              >
                {copiedKey === "all" ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Tüm Bilgileri Kopyala
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Receiver Full Name */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5">
                <div>
                  <p className="text-[11px] font-medium text-[#86868b]">
                    Alıcı Ad Soyad / Hesap Sahibi
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-[#1d1d1f] select-all">
                    {receiverName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void copyToClipboard(receiverName, "receiver", "Alıcı Ad Soyad")
                  }
                  className={`h-[32px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-[12px] font-medium transition-all ${
                    copiedKey === "receiver"
                      ? "bg-emerald-600 text-white"
                      : "bg-[#1d1d1f] text-white hover:bg-black/80"
                  }`}
                >
                  {copiedKey === "receiver" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Kopyalandı
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> İsim Soyisim Kopyala
                    </>
                  )}
                </button>
              </div>

              {/* IBAN */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e63462]/30 bg-[#fef3f5]/60 p-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-medium text-[#e63462]">
                      IBAN Numarası
                    </p>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-[#1d1d1f] border border-[#e5e5ea]">
                      {bankName}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[15px] font-semibold tracking-wide text-[#1d1d1f] select-all">
                    {iban}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(iban, "iban", "IBAN numarası")}
                  className={`h-[32px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-[12px] font-medium transition-all ${
                    copiedKey === "iban"
                      ? "bg-emerald-600 text-white"
                      : "bg-[#e63462] text-white hover:bg-[#d42d56]"
                  }`}
                >
                  {copiedKey === "iban" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> IBAN Kopyalandı
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> IBAN Kopyala
                    </>
                  )}
                </button>
              </div>

              {/* Suggested Transfer Note */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5">
                <div>
                  <p className="text-[11px] font-medium text-[#86868b]">
                    Önerilen Havale / EFT Açıklaması
                  </p>
                  <p className="mt-0.5 text-[13px] font-medium text-[#1d1d1f] select-all">
                    {suggestedNote}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void copyToClipboard(suggestedNote, "note", "Ödeme açıklaması")
                  }
                  className={`h-[32px] inline-flex items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-all ${
                    copiedKey === "note"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-[#d1d1d6] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
                  }`}
                >
                  {copiedKey === "note" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Kopyalandı
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Açıklamayı Kopyala
                    </>
                  )}
                </button>
              </div>
            </div>

            {(info?.paymentAccount.paymentInstructions ||
              info?.paymentAccount.supportPhone ||
              info?.paymentAccount.supportEmail) && (
              <div className="mt-4 rounded-xl bg-[#f5f5f7] p-3.5 text-[12px] text-[#1d1d1f] space-y-1.5">
                {info?.paymentAccount.paymentInstructions && (
                  <p className="flex items-start gap-2 text-[#636366]">
                    <FileText className="w-3.5 h-3.5 text-[#e63462] flex-shrink-0 mt-0.5" />
                    <span>{info.paymentAccount.paymentInstructions}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-[#86868b] pt-0.5">
                  {info?.paymentAccount.supportPhone && (
                    <span className="inline-flex items-center gap-1.5 text-[#1d1d1f]">
                      <Phone className="w-3.5 h-3.5 text-[#e63462]" />
                      Sağlayıcı İletişim: {info.paymentAccount.supportPhone}
                    </span>
                  )}
                  {info?.paymentAccount.supportEmail && (
                    <span className="inline-flex items-center gap-1.5 text-[#1d1d1f]">
                      <Mail className="w-3.5 h-3.5 text-[#e63462]" />
                      {info.paymentAccount.supportEmail}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="rounded-xl border border-[#d1d1d6]/60 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f0f0f0] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                Geçmiş Tahsilat &amp; Dönem Kayıtları
              </h3>
              <span className="text-[11px] text-[#86868b]">
                {info?.paymentHistory?.length ?? 0} kayıt
              </span>
            </div>
            {!info?.paymentHistory || info.paymentHistory.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#86868b]">
                Henüz işlenmiş ödeme geçmişi bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#f0f0f0] bg-[#f9f9f9] text-[11px] font-semibold text-[#86868b]">
                      <th className="px-4 py-2.5">Tahsilat Tarihi</th>
                      <th className="px-4 py-2.5">Kapsanan Dönem(ler)</th>
                      <th className="px-4 py-2.5">Ödeme Yöntemi</th>
                      <th className="px-4 py-2.5">Tutar</th>
                      <th className="px-4 py-2.5">Durum / Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.paymentHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#f5f5f7]/40"
                      >
                        <td className="px-4 py-3 text-[#1d1d1f] font-medium whitespace-nowrap">
                          {new Date(item.paidAt).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#1d1d1f]">
                          {formatCoveredPeriods(item.periods, item.period)}
                        </td>
                        <td className="px-4 py-3 text-[#636366]">
                          {METHOD_LABELS[item.paymentMethod || "bank_transfer"] ??
                            "Havale / EFT"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 tabular-nums whitespace-nowrap">
                          ₺{formatCurrency(item.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Ödeme Alındı
                          </span>
                          {item.note && (
                            <span className="ml-2 text-[12px] text-[#86868b]">
                              ({item.note})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
