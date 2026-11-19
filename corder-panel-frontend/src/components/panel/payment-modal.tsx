import { useEffect, useRef, useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { CustomSelect } from "@/components/ui/custom-inputs"
import { usePanelToast } from "./panel-toast"
import type { CloseCheckSplitMethod, PanelDiscountType, PanelPaymentMethod } from "@/lib/panel-types"
import { X, Banknote, CreditCard, UtensilsCrossed, SplitSquareVertical, Wallet, BookUser, Loader2, ShieldAlert } from "lucide-react"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"
import { computeDiscountMinorUnits, formatCurrency, fromMinorUnits, toMinorUnits } from "@/lib/format"
function sanitizePositiveDecimalInput(raw: string): string {
  if (raw === "") return ""
  const num = Number(raw)
  return !Number.isFinite(num) || num < 0 ? "0" : raw
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
export type PaymentSplitTarget =
  | { mode: "person-share"; shareIndex: number; personCount: number; amount: number }
  | { mode: "items"; lines: { itemId: string; quantity: number }[]; amount: number }
interface Props {
  tableId: string
  total: number
  onClose: () => void
  onOpenSplitBill?: () => void
  splitTarget?: PaymentSplitTarget
}
export default function PaymentModal({ tableId, total, onClose, onOpenSplitBill, splitTarget }: Props) {
  const { closeTableWithPayment, payPersonShare, tables, ledgerCustomers, ledgerRefresh } = usePanelStore()
  const { showToast } = usePanelToast()
  const { token, hasPermission, limits, isBoss } = usePanelAuth()
  const completedRef = useRef(false)
  const submittingRef = useRef(false)
  const table = tables.find((t) => t.id === tableId)
  const preCheckoutStatusRef = useRef(
    table?.status && table.status !== "checkout" ? table.status : "occupied",
  )
  const latestTableStatusRef = useRef(table?.status)
  useEffect(() => {
    if (table?.status) latestTableStatusRef.current = table.status
  }, [table?.status])
  const isPersonShare = splitTarget?.mode === "person-share"
  const isItemsSplit = splitTarget?.mode === "items"
  const baseTotal = splitTarget ? splitTarget.amount : total
  const canSplitBill = hasPermission("billing.split_bill")
  const canAssignLedger = hasPermission("ledger.assign_order")
  const canPercent = hasPermission("discount.apply_percent")
  const canAmount = hasPermission("discount.apply_amount")
  const canComplimentary = hasPermission("discount.complimentary")
  const canAnyDiscount = canPercent || canAmount || canComplimentary
  const maxPct = isBoss ? 100 : limits.maxDiscountPercent
  const maxAmt = isBoss ? null : limits.maxDiscountAmount
  const allPaidShares = table?.splitInfo?.type === "person" ? (table.splitInfo.paidShares ?? []) : []
  const lockedShareLedgerCustomerId = allPaidShares.find((s) => s.method === "ledger" && s.ledgerCustomerId)?.ledgerCustomerId ?? ""
  const [method, setMethod] = useState<PanelPaymentMethod>("cash")
  const [discountType, setDiscountType] = useState<PanelDiscountType>(() => {
    if (splitTarget) return "percent"
    if (table?.discount?.type === "amount") return "amount"
    if (table?.discount?.type === "complimentary") return "complimentary"
    if (canPercent) return "percent"
    if (canAmount) return "amount"
    return "complimentary"
  })
  const [discountValue, setDiscountValue] = useState(() => {
    if (splitTarget || !table?.discount) return ""
    return table.discount.type === "complimentary" ? "100" : String(table.discount.value)
  })
  const [discountReason, setDiscountReason] = useState(() => (splitTarget ? "" : table?.discount?.reason ?? ""))
  const [receivedAmount, setReceivedAmount] = useState("")
  const [tipAmount, setTipAmount] = useState("")
  const [splitCash, setSplitCash] = useState("")
  const [splitCard, setSplitCard] = useState("")
  const [splitMealCard, setSplitMealCard] = useState("")
  const [splitMultinet, setSplitMultinet] = useState("")
  const [splitLedger, setSplitLedger] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ledgerCustomerId, setLedgerCustomerId] = useState(lockedShareLedgerCustomerId); useEffect(() => {
    if (lockedShareLedgerCustomerId && !ledgerCustomerId) setLedgerCustomerId(lockedShareLedgerCustomerId)
  }, [lockedShareLedgerCustomerId, ledgerCustomerId])
  const splitLedgerVal = Math.max(0, Number.isFinite(parseFloat(splitLedger)) ? parseFloat(splitLedger) : 0)
  const needsLedgerCustomer = method === "ledger" || (method === "split" && splitLedgerVal > 0); useEffect(() => {
    if (token && needsLedgerCustomer) void ledgerRefresh()
  }, [token, needsLedgerCustomer, ledgerRefresh]); useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting && !submittingRef.current) onClose()
    }
    window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isSubmitting, onClose])
  const paidShares = !splitTarget ? allPaidShares : []
  const alreadyPaidMinorUnits = paidShares.reduce((s, p) => s + toMinorUnits(p.amount), 0)
  const alreadyPaidAmount = fromMinorUnits(alreadyPaidMinorUnits)
  const rawMinorUnits = Math.max(0, toMinorUnits(baseTotal))
  const parsedDiscount = parseFloat(discountValue)
  const discountNum = isPersonShare
    ? 0
    : discountType === "complimentary"
      ? 100
      : Number.isFinite(parsedDiscount) && parsedDiscount > 0
        ? parsedDiscount
        : 0
  const isExistingUnchangedDiscount =
    !splitTarget &&
    Boolean(table?.discount) &&
    table?.discount?.type === discountType &&
    (discountType === "complimentary" || table?.discount?.value === discountNum)
  const isExceedingLimit =
    !isPersonShare &&
    discountNum > 0 &&
    !isExistingUnchangedDiscount &&
    !isBoss &&
    ((discountType === "percent" && (!canPercent || discountNum > maxPct)) ||
      (discountType === "amount" && (!canAmount || (maxAmt != null && discountNum > maxAmt))) ||
      (discountType === "complimentary" && !canComplimentary))
  const discountMinorUnits = computeDiscountMinorUnits(rawMinorUnits, discountNum > 0 ? { type: discountType, value: discountNum } : null)
  const discountAmount = fromMinorUnits(discountMinorUnits)
  const netMinorUnits = Math.max(0, rawMinorUnits - discountMinorUnits - alreadyPaidMinorUnits)
  const parsedTip = parseFloat(tipAmount)
  const tipMinorUnits = !isPersonShare && Number.isFinite(parsedTip) && parsedTip > 0 ? toMinorUnits(parsedTip) : 0
  const tipVal = fromMinorUnits(tipMinorUnits)
  const parsedReceived = parseFloat(receivedAmount)
  const receivedMinorUnits = Number.isFinite(parsedReceived) && parsedReceived > 0 ? toMinorUnits(parsedReceived) : 0
  const received = fromMinorUnits(receivedMinorUnits)
  const change = fromMinorUnits(receivedMinorUnits - (netMinorUnits + tipMinorUnits))
  const splitCashVal = Math.max(0, Number.isFinite(parseFloat(splitCash)) ? parseFloat(splitCash) : 0)
  const splitCardVal = Math.max(0, Number.isFinite(parseFloat(splitCard)) ? parseFloat(splitCard) : 0)
  const splitMealVal = Math.max(0, Number.isFinite(parseFloat(splitMealCard)) ? parseFloat(splitMealCard) : 0)
  const splitMultinetVal = Math.max(0, Number.isFinite(parseFloat(splitMultinet)) ? parseFloat(splitMultinet) : 0)
  const splitMinorUnits =
    toMinorUnits(splitCashVal) + toMinorUnits(splitCardVal) + toMinorUnits(splitMealVal) + toMinorUnits(splitMultinetVal) + toMinorUnits(splitLedgerVal)
  const splitRemainingMinorUnits = netMinorUnits - splitMinorUnits
  const splitRemaining = fromMinorUnits(splitRemainingMinorUnits)
  const effectiveLedgerCustomerId = lockedShareLedgerCustomerId || ledgerCustomerId
  const canConfirm = () => {
    if (isExceedingLimit) return false; if (!isPersonShare && discountType === "percent" && discountNum > 100) return false; if (!isPersonShare && discountNum > 0 && !discountReason.trim() && !table?.discount?.reason) return false; if (method === "cash") return receivedMinorUnits >= netMinorUnits + tipMinorUnits
    if (method === "split") {
      if (splitRemainingMinorUnits !== 0 || splitMinorUnits <= 0) return false; if (splitLedgerVal > 0 && !effectiveLedgerCustomerId) return false
      return true
    }
    if (method === "ledger") return Boolean(effectiveLedgerCustomerId)
    return true
  }
  useEffect(() => {
    if (!token) return
    latestTableStatusRef.current = "checkout"
    void api.tables.update(token, tableId, { status: "checkout" }).catch(() => {}); return () => {
      if (!completedRef.current && latestTableStatusRef.current === "checkout") {
        void api.tables.update(token, tableId, { status: preCheckoutStatusRef.current }).catch(() => {})
      }
    }
  }, [token, tableId])
  const handleConfirm = async () => {
    if (isSubmitting || submittingRef.current || !canConfirm()) return
    submittingRef.current = true; setIsSubmitting(true)
    try {
      if (splitTarget?.mode === "person-share") {
        const res = await payPersonShare(
          tableId,
          splitTarget.shareIndex,
          method as CloseCheckSplitMethod,
          splitTarget.amount,
          method === "ledger" ? { ledgerCustomerId: effectiveLedgerCustomerId } : undefined,
        ); if (!res.ok) return
        completedRef.current = true; if (!res.fullyClosed && token) void api.tables.update(token, tableId, { status: preCheckoutStatusRef.current }).catch(() => {}); showToast(
          res.fullyClosed
            ? `${table?.name || "Masa"} tüm kişi payları ödendi ve masa kapatıldı`
            : `${table?.name || "Masa"} - ${splitTarget.shareIndex + 1}. kişi payı (${formatCurrency(splitTarget.amount)} TL) ödendi`,
          "success",
        ); onClose()
        return
      }
      const discount =
        discountType === "complimentary" || discountNum > 0
          ? {
              type: discountType,
              value: discountType === "complimentary" ? 100 : discountNum,
              reason: discountReason.trim() || table?.discount?.reason || "İndirim",
            }
          : undefined
      const rawSplitDetails =
        method === "split"
          ? [
              { method: "cash" as const, amount: splitCashVal },
              { method: "credit-card" as const, amount: splitCardVal },
              { method: "meal-card" as const, amount: splitMealVal },
              { method: "multinet" as const, amount: splitMultinetVal },
              { method: "ledger" as const, amount: splitLedgerVal },
            ].filter((s) => s.amount > 0)
          : undefined
      let finalMethod: PanelPaymentMethod = method
      let finalSplitDetails: { method: CloseCheckSplitMethod; amount: number }[] | undefined = rawSplitDetails
      let finalLedgerCustomerId =
        method === "ledger" || (method === "split" && splitLedgerVal > 0) ? effectiveLedgerCustomerId : undefined
      let finalLedgerDebtAmount: number | undefined = method === "split" && splitLedgerVal > 0 ? splitLedgerVal : undefined
      if (!splitTarget && paidShares.length > 0) {
        const byMethodMinorUnits = new Map<CloseCheckSplitMethod, number>()
        let ledgerDebtMinorUnits = method === "ledger" ? netMinorUnits : method === "split" ? toMinorUnits(splitLedgerVal) : 0
        for (const s of paidShares) {
          byMethodMinorUnits.set(s.method, (byMethodMinorUnits.get(s.method) ?? 0) + toMinorUnits(s.amount)); if (s.method === "ledger" && s.ledgerCustomerId) {
            finalLedgerCustomerId = s.ledgerCustomerId
            ledgerDebtMinorUnits += toMinorUnits(s.amount)
          }
        }
        if (netMinorUnits > 0) {
          if (method === "split" && rawSplitDetails) {
            for (const sd of rawSplitDetails) {
              byMethodMinorUnits.set(sd.method, (byMethodMinorUnits.get(sd.method) ?? 0) + toMinorUnits(sd.amount))
            }
          } else if (method !== "split") {
            byMethodMinorUnits.set(method, (byMethodMinorUnits.get(method) ?? 0) + netMinorUnits)
          }
        }
        finalMethod = "split"
        finalSplitDetails = Array.from(byMethodMinorUnits.entries()).map(([m, k]) => ({ method: m, amount: fromMinorUnits(k) })); if (finalLedgerCustomerId && ledgerDebtMinorUnits > 0) finalLedgerDebtAmount = fromMinorUnits(ledgerDebtMinorUnits)
      }
      const res = await closeTableWithPayment(tableId, finalMethod, discount, finalSplitDetails, {
        ...(finalLedgerCustomerId ? { ledgerCustomerId: finalLedgerCustomerId } : {}),
        ...(finalLedgerDebtAmount != null ? { ledgerDebtAmount: finalLedgerDebtAmount } : {}),
        ...(tipVal > 0 ? { tip: tipVal } : {}),
        ...(splitTarget?.mode === "items" ? { lines: splitTarget.lines } : {}),
      }); if (!res.ok || !res.completedOrder) return
      completedRef.current = true; if (res.tableFullyClosed === false && token) {
        void api.tables.update(token, tableId, { status: preCheckoutStatusRef.current }).catch(() => {})
      }
      showToast(
        res.tableFullyClosed === false
          ? `${table?.name || "Masa"} - seçili ürünler tahsil edildi (${formatCurrency(res.completedOrder.netAmount)} TL)`
          : `${res.completedOrder.tableName || table?.name || "Masa"} hesabı kesildi - ${formatCurrency(res.completedOrder.netAmount)} TL`,
        "success",
      ); onClose()
    } finally {
      submittingRef.current = false; setIsSubmitting(false)
    }
  }
  const availableMethods = METHODS.filter((m) => {
    if (m.id === "split" && (isPersonShare || !canSplitBill)) return false; if (m.id === "ledger" && !canAssignLedger) return false
    return true
  })
  const headerTitle = isPersonShare
    ? `Kişi Payı Ödeme (${splitTarget.shareIndex + 1}/${splitTarget.personCount}. Kişi)`
    : isItemsSplit
      ? `Seçili Ürünleri Öde (${splitTarget.lines.length} Kalem)`
      : "Hesap Kes"
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[90vh] overflow-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f]">{headerTitle}</h3>
          <button type="button" disabled={isSubmitting} onClick={onClose} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50">
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="text-center bg-[#f5f5f7] rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#86868b] font-semibold">
              {isPersonShare ? "Kişi Payı Tutarı" : isItemsSplit ? "Seçilen Ürünler Tutarı" : "Toplam Tutar"}
            </p>
            <p className="text-[28px] font-bold text-[#1d1d1f] mt-1">{"₺"}{formatCurrency(baseTotal)}</p>
            {discountAmount > 0 && <p className="text-[13px] text-red-500 mt-1">- {"₺"}{formatCurrency(discountAmount)} indirim</p>}
            {alreadyPaidAmount > 0 && (
              <p className="text-[13px] text-[#007aff] mt-1">- {"₺"}{formatCurrency(alreadyPaidAmount)} ödenen kişi payları ({paidShares.length} kişi)</p>
            )}
            {tipVal > 0 && <p className="text-[13px] text-emerald-600 mt-1">+ {"₺"}{formatCurrency(tipVal)} bahşiş</p>}
            {(discountAmount > 0 || alreadyPaidAmount > 0 || tipVal > 0) && (
              <p className="text-[20px] font-bold text-[#34c759] mt-0.5">Tahsil Edilecek: {"₺"}{formatCurrency(fromMinorUnits(netMinorUnits + tipMinorUnits))}</p>
            )}
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2 block">Ödeme Yöntemi</label>
            <div className="grid grid-cols-3 gap-2">
              {availableMethods.map((m) => {
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
            {needsLedgerCustomer && (
              <div className="mt-3 space-y-2">
                <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block">Cari Müşteri *</label>
                <CustomSelect
                  value={effectiveLedgerCustomerId}
                  disabled={isSubmitting || Boolean(lockedShareLedgerCustomerId)}
                  onChange={(e) => setLedgerCustomerId(e.target.value)}
                  className="w-full h-[40px] px-3 text-[13px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 text-[#1d1d1f]"
                >
                  <option value="">Seçin...</option>
                  {ledgerCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.balance > 0 ? ` (borç: ${formatCurrency(c.balance)} TL)` : c.balance < 0 ? ` (alacak: ${formatCurrency(-c.balance)} TL)` : ""}
                    </option>
                  ))}
                </CustomSelect>
                {lockedShareLedgerCustomerId && <p className="text-[11px] text-[#007aff]">Önceki kişi payında seçilen cari müşteri kullanılmaktadır.</p>}
                {ledgerCustomers.length === 0 && <p className="text-[11px] text-amber-600">Kasada Cariler sekmesinden müşteri ekleyin.</p>}
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
                  <button key={amt} type="button" disabled={isSubmitting} onClick={() => setReceivedAmount(String(amt))} className="px-3 py-1.5 bg-[#f5f5f7] rounded-lg text-[12px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors disabled:opacity-50">{amt} TL</button>
                ))}
                <button type="button" disabled={isSubmitting} onClick={() => setReceivedAmount(String(fromMinorUnits(netMinorUnits + tipMinorUnits)))} className="px-3 py-1.5 bg-[#e63462]/10 rounded-lg text-[12px] font-medium text-[#e63462] hover:bg-[#e63462]/20 transition-colors disabled:opacity-50">Tam Tutar</button>
              </div>
              {received >= fromMinorUnits(netMinorUnits + tipMinorUnits) && change > 0 && (
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
                  ...(canAssignLedger ? [{ label: "Cari (Açık Hesap)", val: splitLedger, set: setSplitLedger }] : []),
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
              <div className={`flex items-center justify-between p-3 rounded-xl ${splitRemainingMinorUnits === 0 ? "bg-[#34c759]/10" : "bg-[#ff9500]/10"}`}>
                <span className={`text-[14px] font-medium ${splitRemainingMinorUnits === 0 ? "text-[#34c759]" : "text-[#ff9500]"}`}>
                  {splitRemainingMinorUnits === 0 ? "Tamamlandı" : splitRemainingMinorUnits > 0 ? "Kalan" : "Fazla"}
                </span>
                <span className={`text-[17px] font-bold ${splitRemainingMinorUnits === 0 ? "text-[#34c759]" : "text-[#ff9500]"}`}>
                  {"₺"}{formatCurrency(Math.abs(splitRemaining))}
                </span>
              </div>
            </div>
          )}
          {!isPersonShare && canAnyDiscount && (
            <div>
              <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2 block">İndirim / İkram</label>
              <div className="flex gap-2 mb-2">
                {(
                  [
                    { id: "percent" as const, label: "% Yüzde", allowed: canPercent },
                    { id: "amount" as const, label: "Tutar", allowed: canAmount },
                    { id: "complimentary" as const, label: "Tam İkram", allowed: canComplimentary },
                  ] as const
                )
                  .filter((dt) => dt.allowed)
                  .map((dt) => (
                    <button
                      key={dt.id}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setDiscountType(dt.id); setDiscountValue(dt.id === "complimentary" ? "100" : "")
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
                  placeholder={discountNum > 0 ? "İndirim sebebi *" : "Sebep"}
                  className="flex-1 h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
                />
              </div>
              {isExceedingLimit && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">
                  <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Girilen indirim yetki limitinizi aşıyor (Maks %{maxPct}{maxAmt != null ? `, Maks ${maxAmt} TL` : ""}).</span>
                </div>
              )}
            </div>
          )}
          {!isPersonShare && (
            <div className="flex items-center justify-between gap-3">
              <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide">Bahşiş (Opsiyonel)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                disabled={isSubmitting}
                value={tipAmount}
                onChange={(e) => setTipAmount(sanitizePositiveDecimalInput(e.target.value))}
                placeholder="₺ 0.00"
                className="w-[140px] h-[36px] px-3 text-[13px] text-right bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
              />
            </div>
          )}
          {!splitTarget && onOpenSplitBill && (
            <button type="button" disabled={isSubmitting} onClick={onOpenSplitBill} className="flex items-center justify-center gap-2 h-[40px] bg-[#007aff]/10 rounded-xl text-[13px] font-medium text-[#007aff] hover:bg-[#007aff]/20 transition-colors disabled:opacity-50">
              <SplitSquareVertical className="h-4 w-4" /> Hesabı Böl (Kişi/Ürün Bazında)
            </button>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button type="button" disabled={isSubmitting} onClick={onClose} className="flex-1 h-[40px] rounded-xl border border-[#d1d1d6]/60 text-[14px] font-medium text-[#86868b] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50">Vazgeç</button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || !canConfirm()}
            className="flex-1 h-[40px] rounded-xl bg-[#34c759] hover:bg-[#2db84e] text-white text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> İşleniyor...</>
            ) : method === "cash" && change > 0 ? (
              `Onayla (${formatCurrency(change)} TL Para Üstü)`
            ) : (
              `₺${formatCurrency(fromMinorUnits(netMinorUnits + tipMinorUnits))} Onayla`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
