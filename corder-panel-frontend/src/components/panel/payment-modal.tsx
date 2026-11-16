import { useEffect, useRef, useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"
import type { PanelDiscountType, PanelPaymentMethod } from "@/lib/panel-types"
import { X, Banknote, CreditCard, UtensilsCrossed, SplitSquareVertical, Wallet, BookUser, Loader2 } from "lucide-react"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}

function sanitizePositiveDecimalInput(raw: string): string {
  if (raw === "") return ""
  const num = Number(raw)
  if (!Number.isFinite(num) || num < 0) return "0"
  return raw
}

const METHODS: { id: PanelPaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Nakit", icon: Banknote },
  { id: "credit-card", label: "Kredi Kartı", icon: CreditCard },
  { id: "meal-card", label: "Yemek Kartı", icon: UtensilsCrossed },
  { id: "multinet", label: "Multinet", icon: Wallet },
  { id: "split", label: "Karma Ödeme", icon: SplitSquareVertical },
  { id: "ledger", label: "Cariye At", icon: BookUser },
]

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000]

interface Props {
  tableId: string
  total: number
  onClose: () => void
  onOpenSplitBill?: () => void
}

export default function PaymentModal({ tableId, total, onClose, onOpenSplitBill }: Props) {
  const { closeTableWithPayment, tables, ledgerCustomers, ledgerRefresh } = usePanelStore()
  const { showToast } = usePanelToast()
  const { token } = usePanelAuth()
  const completedRef = useRef(false)
  const submittingRef = useRef(false)
  const table = tables.find((t) => t.id === tableId)
  const [method, setMethod] = useState<PanelPaymentMethod>("cash")
  const [discountType, setDiscountType] = useState<PanelDiscountType>(() => {
    if (table?.discount?.type === "amount") return "amount"
    if (table?.discount?.type === "complimentary") return "complimentary"
    return "percent"
  })
  const [discountValue, setDiscountValue] = useState(() => {
    if (!table?.discount) return ""
    if (table.discount.type === "complimentary") return "100"
    return String(table.discount.value)
  })
  const [discountReason, setDiscountReason] = useState(() => table?.discount?.reason ?? "")
  const [receivedAmount, setReceivedAmount] = useState("")
  const [splitCash, setSplitCash] = useState("")
  const [splitCard, setSplitCard] = useState("")
  const [splitMealCard, setSplitMealCard] = useState("")
  const [splitMultinet, setSplitMultinet] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ledgerCustomerId, setLedgerCustomerId] = useState("")

  useEffect(() => {
    if (!token || method !== "ledger") return
    void ledgerRefresh()
  }, [token, method, ledgerRefresh])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting && !submittingRef.current) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isSubmitting, onClose])

  const rawKurus = Math.max(0, Math.round(total * 100))
  const parsedDiscount = parseFloat(discountValue)
  const discountNum =
    discountType === "complimentary"
      ? 100
      : Number.isFinite(parsedDiscount) && parsedDiscount > 0
        ? parsedDiscount
        : 0
  const discountKurus =
    discountNum <= 0 || rawKurus <= 0
      ? 0
      : discountType === "complimentary"
        ? rawKurus
        : discountType === "percent"
          ? Math.min(rawKurus, Math.round((rawKurus * Math.min(100, discountNum)) / 100))
          : Math.min(rawKurus, Math.round(discountNum * 100))
  const discountAmount = discountKurus / 100
  const netKurus = Math.max(0, rawKurus - discountKurus)
  const netTotal = netKurus / 100

  const parsedReceived = parseFloat(receivedAmount)
  const receivedKurus =
    Number.isFinite(parsedReceived) && parsedReceived > 0
      ? Math.round(parsedReceived * 100)
      : 0
  const received = receivedKurus / 100
  const change = (receivedKurus - netKurus) / 100

  const splitCashVal = Math.max(0, Number.isFinite(parseFloat(splitCash)) ? parseFloat(splitCash) : 0)
  const splitCardVal = Math.max(0, Number.isFinite(parseFloat(splitCard)) ? parseFloat(splitCard) : 0)
  const splitMealVal = Math.max(0, Number.isFinite(parseFloat(splitMealCard)) ? parseFloat(splitMealCard) : 0)
  const splitMultinetVal = Math.max(0, Number.isFinite(parseFloat(splitMultinet)) ? parseFloat(splitMultinet) : 0)

  const splitKurus =
    Math.round(splitCashVal * 100) +
    Math.round(splitCardVal * 100) +
    Math.round(splitMealVal * 100) +
    Math.round(splitMultinetVal * 100)
  const splitRemainingKurus = netKurus - splitKurus
  const splitRemaining = splitRemainingKurus / 100

  const canConfirm = () => {
    if (discountType === "percent" && discountNum > 100) return false
    if (method === "cash") return receivedKurus >= netKurus
    if (method === "split") return splitRemainingKurus === 0 && splitKurus > 0
    if (method === "ledger") return Boolean(ledgerCustomerId)
    return true
  }

  useEffect(() => {
    if (!token) return
    void api.tables.update(token, tableId, { status: "checkout" }).catch(() => {})
    return () => {
      if (completedRef.current) return
      void api.tables.update(token, tableId, { status: "occupied" }).catch(() => {})
    }
  }, [token, tableId])

  const handleConfirm = async () => {
    if (isSubmitting || submittingRef.current || !canConfirm()) return
    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const discount =
        discountType === "complimentary" || discountNum > 0
          ? {
              type: discountType,
              value: discountType === "complimentary" ? 100 : discountNum,
              reason: discountReason.trim() || "İndirim",
            }
          : undefined
      const splitDetails =
        method === "split"
          ? [
              { method: "cash" as const, amount: splitCashVal },
              { method: "credit-card" as const, amount: splitCardVal },
              { method: "meal-card" as const, amount: splitMealVal },
              { method: "multinet" as const, amount: splitMultinetVal },
            ].filter((s) => s.amount > 0)
          : undefined
      const res = await closeTableWithPayment(
        tableId,
        method,
        discount,
        splitDetails,
        method === "ledger" ? { ledgerCustomerId } : undefined,
      )
      if (!res.ok || !res.completedOrder) {
        return
      }
      completedRef.current = true
      showToast(
        `${res.completedOrder.tableName || table?.name || "Masa"} hesabı kesildi - ${formatCurrency(res.completedOrder.netAmount)} TL`,
        "success",
      )
      onClose()
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[90vh] overflow-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f]">Hesap Kes</h3>
          <button type="button" disabled={isSubmitting} onClick={onClose} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50">
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="text-center bg-[#f5f5f7] rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#86868b] font-semibold">Toplam Tutar</p>
            <p className="text-[28px] font-bold text-[#1d1d1f] mt-1">{"₺"}{formatCurrency(total)}</p>
            {discountAmount > 0 && (
              <>
                <p className="text-[13px] text-red-500 mt-1">- {"₺"}{formatCurrency(discountAmount)} indirim</p>
                <p className="text-[20px] font-bold text-[#34c759] mt-0.5">{"₺"}{formatCurrency(netTotal)}</p>
              </>
            )}
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2 block">Ödeme Yöntemi</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-[12px] font-medium transition-colors disabled:opacity-50 ${
                      method === m.id ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]" : "border-[#d1d1d6]/60 text-[#1d1d1f] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {m.label}
                  </button>
                )
              })}
            </div>
            {method === "ledger" && (
              <div className="mt-3 space-y-2">
                <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block">Cari Müşteri</label>
                <select
                  value={ledgerCustomerId}
                  disabled={isSubmitting}
                  onChange={(e) => setLedgerCustomerId(e.target.value)}
                  className="w-full h-[40px] px-3 text-[13px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 focus:outline-none focus:ring-2 focus:ring-[#e63462]/30 text-[#1d1d1f]"
                >
                  <option value="">Seçin...</option>
                  {ledgerCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.balance > 0 ? ` (borç: ${formatCurrency(c.balance)} TL)` : c.balance < 0 ? ` (alacak: ${formatCurrency(-c.balance)} TL)` : ""}
                    </option>
                  ))}
                </select>
                {ledgerCustomers.length === 0 && (
                  <p className="text-[11px] text-amber-600">Kasada Cariler sekmesinden müşteri ekleyin.</p>
                )}
              </div>
            )}
          </div>

          {method === "cash" && (
            <div className="space-y-3">
              <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide block">Alınan Tutar</label>
              <input
                type="number"
                min={0}
                step="0.01"
                disabled={isSubmitting}
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(sanitizePositiveDecimalInput(e.target.value))}
                placeholder="0.00"
                className="w-full h-[52px] px-4 text-[24px] font-bold text-center bg-[#f5f5f7] rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-[#e63462] text-[#1d1d1f]"
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setReceivedAmount(String(amt))}
                    className="px-3 py-1.5 bg-[#f5f5f7] rounded-lg text-[12px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors disabled:opacity-50"
                  >
                    {amt} TL
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setReceivedAmount(String(netTotal))}
                  className="px-3 py-1.5 bg-[#e63462]/10 rounded-lg text-[12px] font-medium text-[#e63462] hover:bg-[#e63462]/20 transition-colors disabled:opacity-50"
                >
                  Tam Tutar
                </button>
              </div>
              {received >= netTotal && change > 0 && (
                <div className="flex items-center justify-between p-3 bg-[#34c759]/10 rounded-xl">
                  <span className="text-[14px] font-medium text-[#34c759]">Para Üstü</span>
                  <span className="text-[20px] font-bold text-[#34c759]">{"₺"}{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          )}

          {method === "split" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Nakit", val: splitCash, set: setSplitCash },
                  { label: "Kredi Kartı", val: splitCard, set: setSplitCard },
                  { label: "Yemek Kartı", val: splitMealCard, set: setSplitMealCard },
                  { label: "Multinet", val: splitMultinet, set: setSplitMultinet },
                ].map((item) => (
                  <div key={item.label}>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 block">{item.label}</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={isSubmitting}
                      value={item.val}
                      onChange={(e) => item.set(sanitizePositiveDecimalInput(e.target.value))}
                      placeholder="0.00"
                      className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
                    />
                  </div>
                ))}
              </div>
              <div className={`flex items-center justify-between p-3 rounded-xl ${splitRemainingKurus === 0 ? "bg-[#34c759]/10" : "bg-[#ff9500]/10"}`}>
                <span className={`text-[14px] font-medium ${splitRemainingKurus === 0 ? "text-[#34c759]" : "text-[#ff9500]"}`}>
                  {splitRemainingKurus === 0 ? "Tamamlandı" : splitRemainingKurus > 0 ? "Kalan" : "Fazla"}
                </span>
                <span className={`text-[17px] font-bold ${splitRemainingKurus === 0 ? "text-[#34c759]" : "text-[#ff9500]"}`}>
                  {"₺"}{formatCurrency(Math.abs(splitRemaining))}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2 block">İndirim / İkram</label>
            <div className="flex gap-2 mb-2">
              {([
                { id: "percent" as const, label: "% Yüzde" },
                { id: "amount" as const, label: "Tutar" },
                { id: "complimentary" as const, label: "Tam İkram" },
              ]).map((dt) => (
                <button
                  key={dt.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setDiscountType(dt.id)
                    if (dt.id === "complimentary") setDiscountValue("100")
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors disabled:opacity-50 ${
                    discountType === dt.id ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]" : "border-[#d1d1d6]/60 text-[#86868b]"
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {discountType !== "complimentary" && (
                <input
                  type="number"
                  min={0}
                  max={discountType === "percent" ? 100 : undefined}
                  disabled={isSubmitting}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(sanitizePositiveDecimalInput(e.target.value))}
                  placeholder={discountType === "percent" ? "% 0" : "₺ 0"}
                  className="w-[100px] h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
                />
              )}
              <input
                type="text"
                disabled={isSubmitting}
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Sebep (opsiyonel)"
                className="flex-1 h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
              />
            </div>
          </div>

          {onOpenSplitBill && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onOpenSplitBill}
              className="flex items-center justify-center gap-2 h-[40px] bg-[#007aff]/10 rounded-xl text-[13px] font-medium text-[#007aff] hover:bg-[#007aff]/20 transition-colors disabled:opacity-50"
            >
              <SplitSquareVertical className="h-4 w-4" />
              Hesabı Böl (Kişi/Ürün Bazında)
            </button>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button type="button" disabled={isSubmitting} onClick={onClose} className="flex-1 h-[40px] rounded-xl border border-[#d1d1d6]/60 text-[14px] font-medium text-[#86868b] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50">
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || !canConfirm()}
            className="flex-1 h-[40px] rounded-xl bg-[#34c759] hover:bg-[#2db84e] text-white text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> İşleniyor...</> : method === "cash" && change > 0 ? `Onayla (${formatCurrency(change)} TL Para Üstü)` : `₺${formatCurrency(netTotal)} Onayla`}
          </button>
        </div>
      </div>
    </div>
  )
}
