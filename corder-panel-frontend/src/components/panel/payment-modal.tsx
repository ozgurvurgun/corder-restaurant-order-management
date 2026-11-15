import { useEffect, useRef, useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"
import type { PaymentMethod } from "@/lib/panel-types"
import { X, Banknote, CreditCard, UtensilsCrossed, SplitSquareVertical, Wallet, BookUser } from "lucide-react"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}

const METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "nakit", label: "Nakit", icon: Banknote },
  { id: "kredi-karti", label: "Kredi Karti", icon: CreditCard },
  { id: "yemek-karti", label: "Yemek Karti", icon: UtensilsCrossed },
  { id: "multinet", label: "Multinet", icon: Wallet },
  { id: "coklu", label: "Karma Odeme", icon: SplitSquareVertical },
  { id: "cari", label: "Cariye At", icon: BookUser },
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
  const table = tables.find((t) => t.id === tableId)
  const [method, setMethod] = useState<PaymentMethod>("nakit")
  const [discountType, setDiscountType] = useState<"percent" | "amount">(() => {
    if (table?.discount?.type === "amount") return "amount"
    return "percent"
  })
  const [discountValue, setDiscountValue] = useState(() => {
    if (!table?.discount) return ""
    if (table.discount.type === "ikram") return "100"
    return String(table.discount.value)
  })
  const [discountReason, setDiscountReason] = useState(() => table?.discount?.reason ?? "")
  const [receivedAmount, setReceivedAmount] = useState("")
  const [splitNakit, setSplitNakit] = useState("")
  const [splitKart, setSplitKart] = useState("")
  const [splitYemek, setSplitYemek] = useState("")
  const [splitMultinet, setSplitMultinet] = useState("")
  const [loading, setLoading] = useState(false)
  const [ledgerCustomerId, setLedgerCustomerId] = useState("")

  useEffect(() => {
    if (!token || method !== "cari") return
    void ledgerRefresh()
  }, [token, method, ledgerRefresh])

  const rawKurus = Math.max(0, Math.round(total * 100))
  const discountNum = parseFloat(discountValue) || 0
  const discountKurus =
    discountNum <= 0 || rawKurus <= 0
      ? 0
      : discountType === "percent"
        ? Math.min(rawKurus, Math.round((rawKurus * Math.min(100, discountNum)) / 100))
        : Math.min(rawKurus, Math.round(discountNum * 100))
  const discountAmount = discountKurus / 100
  const netKurus = Math.max(0, rawKurus - discountKurus)
  const netTotal = netKurus / 100

  const receivedKurus = Math.max(0, Math.round((parseFloat(receivedAmount) || 0) * 100))
  const received = receivedKurus / 100
  const change = (receivedKurus - netKurus) / 100

  const splitKurus =
    Math.max(0, Math.round((parseFloat(splitNakit) || 0) * 100)) +
    Math.max(0, Math.round((parseFloat(splitKart) || 0) * 100)) +
    Math.max(0, Math.round((parseFloat(splitYemek) || 0) * 100)) +
    Math.max(0, Math.round((parseFloat(splitMultinet) || 0) * 100))
  const splitRemainingKurus = netKurus - splitKurus
  const splitRemaining = splitRemainingKurus / 100

  const canConfirm = () => {
    if (method === "nakit") return receivedKurus >= netKurus
    if (method === "coklu") return splitRemainingKurus === 0
    if (method === "cari") return Boolean(ledgerCustomerId)
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
    setLoading(true)
    const discount =
      discountNum > 0
        ? { type: discountType, value: discountNum, reason: discountReason || "Indirim" }
        : undefined
    const splitDetails = method === "coklu" ? [
      { method: "nakit" as const, amount: parseFloat(splitNakit) || 0 },
      { method: "kredi-karti" as const, amount: parseFloat(splitKart) || 0 },
      { method: "yemek-karti" as const, amount: parseFloat(splitYemek) || 0 },
      { method: "multinet" as const, amount: parseFloat(splitMultinet) || 0 },
    ].filter(s => s.amount > 0) : undefined
    const res = await closeTableWithPayment(
      tableId,
      method,
      discount,
      splitDetails,
      method === "cari" ? { ledgerCustomerId } : undefined,
    )
    setLoading(false)
    if (!res.ok || !res.completedOrder) {
      showToast(res.error || "Hesap kapatilamadi", "error")
      return
    }
    completedRef.current = true
    showToast(
      `${res.completedOrder.tableName || table?.name || "Masa"} hesabi kesildi - ${formatCurrency(res.completedOrder.netAmount)} TL`,
      "success",
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[90vh] overflow-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f]">Hesap Kes</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Total */}
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

          {/* Payment method */}
          <div>
            <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2 block">Odeme Yontemi</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-[12px] font-medium transition-colors ${
                      method === m.id
                        ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]"
                        : "border-[#d1d1d6]/60 text-[#1d1d1f] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {m.label}
                  </button>
                )
              })}
            </div>
            {method === "cari" && (
              <div className="mt-3 space-y-2">
                <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block">Cari musteri</label>
                <select
                  value={ledgerCustomerId}
                  onChange={(e) => setLedgerCustomerId(e.target.value)}
                  className="w-full h-[40px] px-3 text-[13px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 focus:outline-none focus:ring-2 focus:ring-[#e63462]/30 text-[#1d1d1f]"
                >
                  <option value="">Secin...</option>
                  {ledgerCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.balance > 0 ? ` (borc: ${formatCurrency(c.balance)} TL)` : c.balance < 0 ? ` (alacak: ${formatCurrency(-c.balance)} TL)` : ""}
                    </option>
                  ))}
                </select>
                {ledgerCustomers.length === 0 && (
                  <p className="text-[11px] text-amber-600">Kasada Cariler sekmesinden musteri ekleyin.</p>
                )}
              </div>
            )}
          </div>

          {/* Cash - Change */}
          {method === "nakit" && (
            <div className="space-y-3">
              <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide block">Alinan Tutar</label>
              <input
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-[52px] px-4 text-[24px] font-bold text-center bg-[#f5f5f7] rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-[#e63462] text-[#1d1d1f]"
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setReceivedAmount(String(amt))}
                    className="px-3 py-1.5 bg-[#f5f5f7] rounded-lg text-[12px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors"
                  >
                    {amt} TL
                  </button>
                ))}
                <button
                  onClick={() => setReceivedAmount(String(netTotal))}
                  className="px-3 py-1.5 bg-[#e63462]/10 rounded-lg text-[12px] font-medium text-[#e63462] hover:bg-[#e63462]/20 transition-colors"
                >
                  Tam Tutar
                </button>
              </div>
              {received >= netTotal && change > 0 && (
                <div className="flex items-center justify-between p-3 bg-[#34c759]/10 rounded-xl">
                  <span className="text-[14px] font-medium text-[#34c759]">Para Ustu</span>
                  <span className="text-[20px] font-bold text-[#34c759]">{"₺"}{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          )}

          {/* Split payment */}
          {method === "coklu" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Nakit</label>
                  <input
                    type="number"
                    value={splitNakit}
                    onChange={(e) => setSplitNakit(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Kredi Karti</label>
                  <input
                    type="number"
                    value={splitKart}
                    onChange={(e) => setSplitKart(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Yemek Karti</label>
                  <input
                    type="number"
                    value={splitYemek}
                    onChange={(e) => setSplitYemek(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Multinet</label>
                  <input
                    type="number"
                    value={splitMultinet}
                    onChange={(e) => setSplitMultinet(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
                  />
                </div>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-xl ${splitRemainingKurus === 0 ? "bg-[#34c759]/10" : "bg-[#ff9500]/10"}`}>
                <span className={`text-[14px] font-medium ${splitRemainingKurus === 0 ? "text-[#34c759]" : "text-[#ff9500]"}`}>
                  {splitRemainingKurus === 0 ? "Tamamlandi" : splitRemainingKurus > 0 ? "Kalan" : "Fazla"}
                </span>
                <span className={`text-[17px] font-bold ${splitRemainingKurus === 0 ? "text-[#34c759]" : "text-[#ff9500]"}`}>
                  {"₺"}{formatCurrency(Math.abs(splitRemaining))}
                </span>
              </div>
            </div>
          )}

          {/* Discount */}
          <div>
            <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2 block">Indirim / Ikram</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setDiscountType("percent")}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                  discountType === "percent" ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]" : "border-[#d1d1d6]/60 text-[#86868b]"
                }`}
              >
                % Yuzde
              </button>
              <button
                onClick={() => setDiscountType("amount")}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                  discountType === "amount" ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]" : "border-[#d1d1d6]/60 text-[#86868b]"
                }`}
              >
                Tutar
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percent" ? "% 0" : "₺ 0"}
                className="w-[100px] h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
              />
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Sebep (opsiyonel)"
                className="flex-1 h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 text-[#1d1d1f]"
              />
            </div>
          </div>

          {/* Split Bill Button */}
          {onOpenSplitBill && (
            <button
              onClick={onOpenSplitBill}
              className="flex items-center justify-center gap-2 h-[40px] bg-[#007aff]/10 rounded-xl text-[13px] font-medium text-[#007aff] hover:bg-[#007aff]/20 transition-colors"
            >
              <SplitSquareVertical className="h-4 w-4" />
              Hesabi Bol (Kisi/Urun Bazinda)
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button onClick={onClose} className="flex-1 h-[40px] rounded-xl border border-[#d1d1d6]/60 text-[14px] font-medium text-[#86868b] hover:bg-[#f5f5f7] transition-colors">
            Vazgec
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !canConfirm()}
            className="flex-1 h-[40px] rounded-xl bg-[#34c759] hover:bg-[#2db84e] text-white text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Isleniyor..." : method === "nakit" && change > 0 ? `Onayla (${formatCurrency(change)} TL Para Ustu)` : `₺${formatCurrency(netTotal)} Onayla`}
          </button>
        </div>
      </div>
    </div>
  )
}
