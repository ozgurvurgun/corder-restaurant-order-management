import { useEffect, useState } from "react"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"
import type { MerchantBillingInfoDto } from "@/lib/api/system.api"
import { usePanelToast } from "./panel-toast"
import {
  CreditCard,
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

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

export default function BillingView() {
  const { token, currentBusiness } = usePanelAuth()
  const { showToast } = usePanelToast()
  const [info, setInfo] = useState<MerchantBillingInfoDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    api.restaurant
      .getBillingInfo(token)
      .then((res) => {
        setInfo(res)
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
      })
  }, [token, currentBusiness?.id])

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

  if (loading && !info) {
    return (
      <div className="h-full flex items-center justify-center text-[#86868b] text-[14px]">
        Abonelik ve ödeme bilgileri yükleniyor…
      </div>
    )
  }

  const receiverName = info?.paymentAccount.receiverName || "Corder Yazılım ve Teknoloji A.Ş."
  const iban = info?.paymentAccount.iban || "TR33 0006 1005 1978 6457 8413 26"
  const bankName = info?.paymentAccount.bankName || "Garanti BBVA"
  const suggestedNote =
    info?.paymentAccount.suggestedTransferNote ||
    `${currentBusiness?.name || "İşletme"} - Aylık Sistem Kullanım Ücreti`

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-end px-5 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
          <CalendarClock className="w-3.5 h-3.5 text-[#e63462]" />
          <span>
            Tahsilat Dönemi: <strong>Her Ayın {startDay} – {endDay}&apos;u Arası</strong>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="w-full space-y-5">
          {/* Collection Window Warning Banner */}
          {(isCollectionWindow ||
            info?.billingStatus === "pending" ||
            info?.billingStatus === "overdue") && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-[13px] text-amber-900">
                <p className="font-bold">
                  Aylık Tahsilat Dönemi Hatırlatması (Her Ayın {startDay} – {endDay}&apos;u Arası)
                </p>
                <p className="mt-0.5 text-[12px] text-amber-800">
                  Sistem erişiminizin kesintisiz devam etmesi için lütfen aylık abonelik ödemenizi her ayın{" "}
                  <strong>{startDay}&apos;i ile {endDay}&apos;u arasında</strong> aşağıdaki IBAN hesabına gerçekleştiriniz. Ödeme yapılmaması durumunda sistem erişimi otomatik olarak durdurulmaktadır.
                </p>
              </div>
            </div>
          )}

          {/* Subscription Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                Mekan Aylık Ücreti
              </p>
              <p className="mt-2 text-[26px] font-extrabold text-[#1d1d1f]">
                {formatMoney(info?.monthlyFee ?? 0)}
                <span className="text-[12px] font-medium text-[#86868b]"> / Ay</span>
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#86868b]">
                <Building2 className="w-3.5 h-3.5 text-[#e63462]" />
                <span>{info?.restaurantName || currentBusiness?.name}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                Güncel Ödeme Durumu
              </p>
              <div className="mt-2.5">
                {info?.billingStatus === "pending" || info?.billingStatus === "overdue" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[12px] font-bold text-amber-800">
                    <Clock className="w-4 h-4" />
                    Ödeme Bekleniyor ({startDay}-{endDay} Tahsilat)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[12px] font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4" />
                    Ödeme Alındı • Sistem Aktif
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-[11px] text-[#86868b]">
                Tahsilat Günü: Her ayın {startDay} - {endDay}&apos;u arası
              </p>
            </div>

            <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                Son Ödeme Kaydı
              </p>
              <p className="mt-2 text-[17px] font-bold text-[#1d1d1f]">
                {info?.lastPaymentDate
                  ? new Date(info.lastPaymentDate).toLocaleDateString("tr-TR")
                  : "Henüz Kayıt Yok"}
              </p>
              <p className="mt-1.5 text-[11px] text-[#86868b]">
                {info?.lastPaidPeriod
                  ? `Son Ödenen Dönem: ${info.lastPaidPeriod}`
                  : "Ödeme yapıldığında otomatik işlenir"}
              </p>
            </div>
          </div>

          {/* Bank / IBAN Payment Card with Copy Buttons */}
          <div className="rounded-2xl border border-[#d1d1d6]/70 bg-white p-6 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#e63462]/10 flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-[#e63462]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f]">
                    Havale / EFT Ödeme Hesap Bilgileri
                  </h3>
                  <p className="text-[12px] text-[#86868b]">
                    Aylık kullanım ücretinizi yatıracağınız İsim Soyisim ve IBAN bilgilerini tek tıkla kopyalayabilirsiniz.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  void copyToClipboard(
                    `Alıcı: ${receiverName}\nBanka: ${bankName}\nIBAN: ${iban}\nTutar: ${formatMoney(info?.monthlyFee ?? 0)}\nAçıklama: ${suggestedNote}`,
                    "all",
                    "Tüm ödeme bilgileri"
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#e63462]/30 bg-[#fef3f5] px-3.5 py-2 text-[12px] font-semibold text-[#e63462] hover:bg-[#e63462]/15 transition-colors"
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

            <div className="mt-5 space-y-3.5">
              {/* Receiver Full Name */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    Alıcı Ad Soyad / Hesap Sahibi
                  </p>
                  <p className="mt-1 text-[16px] font-bold text-[#1d1d1f] select-all">
                    {receiverName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void copyToClipboard(receiverName, "receiver", "Alıcı Ad Soyad")
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold transition-all ${
                    copiedKey === "receiver"
                      ? "bg-emerald-600 text-white"
                      : "bg-[#1d1d1f] text-white hover:bg-black/80"
                  }`}
                >
                  {copiedKey === "receiver" ? (
                    <>
                      <Check className="w-4 h-4" /> Kopyalandı
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> İsim Soyisim Kopyala
                    </>
                  )}
                </button>
              </div>

              {/* IBAN */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e63462]/30 bg-[#fef3f5]/60 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#e63462]">
                      IBAN Numarası
                    </p>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1d1d1f] border border-[#e5e5ea]">
                      {bankName}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[17px] font-extrabold tracking-wide text-[#1d1d1f] select-all">
                    {iban}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(iban, "iban", "IBAN numarası")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold transition-all ${
                    copiedKey === "iban"
                      ? "bg-emerald-600 text-white"
                      : "bg-[#e63462] text-white hover:bg-[#d42d56]"
                  }`}
                >
                  {copiedKey === "iban" ? (
                    <>
                      <Check className="w-4 h-4" /> IBAN Kopyalandı
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> IBAN Kopyala
                    </>
                  )}
                </button>
              </div>

              {/* Suggested Transfer Note */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    Önerilen Havale / EFT Açıklaması
                  </p>
                  <p className="mt-1 text-[14px] font-semibold text-[#1d1d1f] select-all">
                    {suggestedNote}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void copyToClipboard(suggestedNote, "note", "Ödeme açıklaması")
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition-all ${
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
              <div className="mt-4 rounded-xl bg-[#f5f5f7] p-4 text-[12px] text-[#1d1d1f] space-y-2">
                {info?.paymentAccount.paymentInstructions && (
                  <p className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-[#e63462] flex-shrink-0 mt-0.5" />
                    <span>{info.paymentAccount.paymentInstructions}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-[#86868b] pt-1">
                  {info?.paymentAccount.supportPhone && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#1d1d1f]">
                      <Phone className="w-3.5 h-3.5 text-[#e63462]" />
                      Sağlayıcı İletişim: {info.paymentAccount.supportPhone}
                    </span>
                  )}
                  {info?.paymentAccount.supportEmail && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#1d1d1f]">
                      <Mail className="w-3.5 h-3.5 text-[#e63462]" />
                      {info.paymentAccount.supportEmail}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f0f0f0] flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#1d1d1f]">
                Geçmiş Aylık Ödeme Kayıtları
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
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f0f0f0] bg-[#f9f9fb] text-[11px] font-semibold uppercase text-[#86868b]">
                    <th className="px-5 py-2.5">Dönem</th>
                    <th className="px-5 py-2.5">Ödeme Tarihi</th>
                    <th className="px-5 py-2.5">Tutar</th>
                    <th className="px-5 py-2.5">Açıklama / Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {info.paymentHistory.map((item) => (
                    <tr key={item.id} className="border-b border-[#f0f0f0] last:border-0">
                      <td className="px-5 py-3 font-semibold text-[#1d1d1f]">
                        {item.period}
                      </td>
                      <td className="px-5 py-3 text-[#86868b]">
                        {new Date(item.paidAt).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3 font-bold text-emerald-700">
                        {formatMoney(item.amount)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

