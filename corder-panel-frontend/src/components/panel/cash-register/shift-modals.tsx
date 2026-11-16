import { AlertTriangle, X } from "lucide-react"
import type { CashShift } from "@/lib/panel-types"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}

export function OpenShiftModal(props: {
  openBalance: string
  setOpenBalance: (v: string) => void
  shiftError: string
  shiftLoading: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const {
    openBalance,
    setOpenBalance,
    shiftError,
    shiftLoading,
    onClose,
    onSubmit,
  } = props
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Kasa Ac</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
          >
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>
        <div className="px-6 py-5">
          {shiftError && (
            <p className="text-[13px] text-red-500 mb-3">{shiftError}</p>
          )}
          <label className="text-[12px] font-medium text-[#86868b] mb-1.5 block">
            Acilis Bakiyesi
          </label>
          <input
            type="number"
            value={openBalance}
            onChange={(e) => setOpenBalance(e.target.value)}
            placeholder="0.00"
            autoFocus
            disabled={shiftLoading}
            className="w-full h-[40px] px-3 text-[15px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
          />
        </div>
        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button
            onClick={onClose}
            disabled={shiftLoading}
            className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b]"
          >
            Vazgec
          </button>
          <button
            onClick={onSubmit}
            disabled={shiftLoading}
            className="flex-1 h-[38px] rounded-xl bg-[#34c759] text-white text-[13px] font-semibold hover:bg-[#2db84e] disabled:opacity-50"
          >
            {shiftLoading ? "Aciliyor…" : "Kasayi Ac"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CloseShiftModal(props: {
  currentShift: CashShift | null
  closeBalance: string
  setCloseBalance: (v: string) => void
  closeNotes: string
  setCloseNotes: (v: string) => void
  shiftError: string
  shiftLoading: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const {
    currentShift,
    closeBalance,
    setCloseBalance,
    closeNotes,
    setCloseNotes,
    shiftError,
    shiftLoading,
    onClose,
    onSubmit,
  } = props
  const expected =
    (currentShift?.openingBalance || 0) +
    (currentShift?.cashIn || 0) -
    (currentShift?.cashOut || 0)
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
            Kasa Kapat
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
          >
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-[12px] text-amber-700">
              <p className="font-semibold mb-0.5">
                Beklenen bakiye: {"\u20BA"}
                {formatCurrency(expected)}
              </p>
              <p>Kasadaki fiziksel tutari girin.</p>
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-[#86868b] mb-1.5 block">
              Kapanis Bakiyesi
            </label>
            <input
              type="number"
              value={closeBalance}
              onChange={(e) => setCloseBalance(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full h-[40px] px-3 text-[15px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-[#86868b] mb-1.5 block">
              Not (opsiyonel)
            </label>
            <input
              type="text"
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Aciklama..."
              disabled={shiftLoading}
              className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
            />
          </div>
          {shiftError && <p className="text-[13px] text-red-500">{shiftError}</p>}
        </div>
        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button
            onClick={onClose}
            disabled={shiftLoading}
            className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b]"
          >
            Vazgec
          </button>
          <button
            onClick={onSubmit}
            disabled={shiftLoading}
            className="flex-1 h-[38px] rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 disabled:opacity-50"
          >
            {shiftLoading ? "Kapatiliyor…" : "Kasayi Kapat"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AddCashTransactionModal(props: {
  txType: "expense" | "cash-in" | "cash-out"
  setTxType: (v: "expense" | "cash-in" | "cash-out") => void
  txAmount: string
  setTxAmount: (v: string) => void
  txDesc: string
  setTxDesc: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const {
    txType,
    setTxType,
    txAmount,
    setTxAmount,
    txDesc,
    setTxDesc,
    onClose,
    onSubmit,
  } = props
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
            Islem Ekle
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
          >
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          <div className="flex gap-2">
            {(["expense", "cash-in", "cash-out"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTxType(t)}
                className={`flex-1 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors ${
                  txType === t
                    ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]"
                    : "border-[#d1d1d6]/60 text-[#86868b]"
                }`}
              >
                {t === "expense"
                  ? "Gider"
                  : t === "cash-in"
                    ? "Nakit Giris"
                    : "Nakit Cikis"}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={txAmount}
            onChange={(e) => setTxAmount(e.target.value)}
            placeholder="Tutar"
            autoFocus
            className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
          />
          <input
            type="text"
            value={txDesc}
            onChange={(e) => setTxDesc(e.target.value)}
            placeholder="Aciklama"
            className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
          />
        </div>
        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b]"
          >
            Vazgec
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 h-[38px] rounded-xl bg-[#e63462] text-white text-[13px] font-semibold hover:bg-[#d42d56]"
          >
            Ekle
          </button>
        </div>
      </div>
    </div>
  )
}
