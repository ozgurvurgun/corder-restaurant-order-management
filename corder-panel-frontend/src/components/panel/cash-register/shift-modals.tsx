import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Loader2, Printer, X } from "lucide-react"
import type { CashShift } from "@/lib/panel-types"
import { formatCurrency, fromMinorUnits, toMinorUnits } from "@/lib/format"

export function OpenShiftModal(props: {
  openBalance: string
  setOpenBalance: (v: string) => void
  shiftError: string
  shiftLoading: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const { openBalance, setOpenBalance, shiftError, shiftLoading, onClose, onSubmit } = props

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !shiftLoading) onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [shiftLoading, onClose])

  const parsedBalance = parseFloat(openBalance)
  const isValidBalance = openBalance.trim() !== "" && Number.isFinite(parsedBalance) && parsedBalance >= 0

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Kasa Aç</h3>
          <button type="button" disabled={shiftLoading} onClick={onClose} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50">
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>
        <div className="px-6 py-5">
          {shiftError && <p className="text-[13px] text-red-500 mb-3">{shiftError}</p>}
          <label className="text-[12px] font-medium text-[#86868b] mb-1.5 block">Açılış Bakiyesi</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={openBalance}
            onChange={(e) => {
              const v = e.target.value
              if (v !== "" && Number(v) < 0) return
              setOpenBalance(v)
            }}
            placeholder="0.00"
            autoFocus
            disabled={shiftLoading}
            className="w-full h-[40px] px-3 text-[15px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
          />
        </div>
        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button type="button" onClick={onClose} disabled={shiftLoading} className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b] disabled:opacity-50">
            Vazgeç
          </button>
          <button type="button" onClick={onSubmit} disabled={shiftLoading || !isValidBalance} className="flex-1 h-[38px] rounded-xl bg-[#34c759] text-white text-[13px] font-semibold hover:bg-[#2db84e] disabled:opacity-50 flex items-center justify-center gap-1.5">
            {shiftLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Açılıyor…</> : "Kasayı Aç"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CloseShiftModal(props: {
  currentShift: CashShift | null
  closedShift?: CashShift | null
  printingReport?: boolean
  onPrintZReport?: (shiftId: string) => void
  closeBalance: string
  setCloseBalance: (v: string) => void
  closeNotes: string
  setCloseNotes: (v: string) => void
  shiftError: string
  shiftLoading: boolean
  canViewExpected?: boolean
  openTablesCount?: number
  onClose: () => void
  onSubmit: () => void
}) {
  const {
    currentShift,
    closedShift = null,
    printingReport = false,
    onPrintZReport,
    closeBalance,
    setCloseBalance,
    closeNotes,
    setCloseNotes,
    shiftError,
    shiftLoading,
    canViewExpected = true,
    openTablesCount = 0,
    onClose,
    onSubmit,
  } = props

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !shiftLoading && !printingReport) onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [shiftLoading, printingReport, onClose])

  if (closedShift) {
    const expMinor =
      toMinorUnits(closedShift.openingBalance || 0) +
      toMinorUnits(closedShift.cashIn || 0) -
      toMinorUnits(closedShift.cashOut || 0)
    const countMinor = toMinorUnits(closedShift.closingBalance || 0)
    const diffMinor = countMinor - expMinor
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#34c759]" />
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                Kasa Vardiyası Kapatıldı - Z Raporu Basılsın mı?
              </h3>
            </div>
            <button
              type="button"
              disabled={printingReport}
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5 text-[#86868b]" />
            </button>
          </div>
          <div className="px-6 py-5 space-y-3 text-[13px]">
            <p className="text-[#86868b] text-[12px]">
              Vardiya başarıyla kapatıldı. Z Raporunu şimdi kasa termal yazıcısından basabilir veya daha sonra X / Z Raporu geçmişinden alabilirsiniz.
            </p>
            <div className="bg-[#f5f5f7] rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#86868b]">Toplam Ciro</span>
                <span className="font-bold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(closedShift.totalRevenue || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Beklenen Kasa</span>
                <span className="font-medium text-[#1d1d1f]">{"\u20BA"}{formatCurrency(fromMinorUnits(expMinor))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Sayılan Kapanış</span>
                <span className="font-semibold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(closedShift.closingBalance || 0)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-[#d1d1d6]/50">
                <span className="text-[#86868b]">Kasa Farkı</span>
                <span className={`font-bold ${diffMinor === 0 ? "text-green-600" : diffMinor > 0 ? "text-blue-600" : "text-red-600"}`}>
                  {diffMinor === 0
                    ? "Tam (\u20BA0,00)"
                    : diffMinor > 0
                      ? `+\u20BA${formatCurrency(fromMinorUnits(diffMinor))} (Fazla)`
                      : `-\u20BA${formatCurrency(fromMinorUnits(Math.abs(diffMinor)))} (Açık)`}
                </span>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-[#f0f0f0] flex flex-col gap-2">
            <button
              type="button"
              disabled={printingReport}
              onClick={() => onPrintZReport?.(closedShift.id)}
              className="w-full h-[40px] rounded-xl bg-[#1d1d1f] text-white text-[13px] font-semibold hover:bg-[#3a3a3c] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {printingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Kasa Yazıcısından Z Raporu Bas
            </button>
            <button
              type="button"
              disabled={printingReport}
              onClick={onClose}
              className="w-full h-[36px] rounded-xl border border-[#d1d1d6]/60 text-[12px] font-medium text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-50"
            >
              Şimdi Değil (Geçmişten Alınabilir)
            </button>
          </div>
        </div>
      </div>
    )
  }

  const expectedMinorUnits =
    toMinorUnits(currentShift?.openingBalance || 0) +
    toMinorUnits(currentShift?.cashIn || 0) -
    toMinorUnits(currentShift?.cashOut || 0)
  const expected = fromMinorUnits(expectedMinorUnits)
  const parsedClose = parseFloat(closeBalance)
  const isValidClose = closeBalance.trim() !== "" && Number.isFinite(parsedClose) && parsedClose >= 0
  const diffMinorUnits = isValidClose ? toMinorUnits(parsedClose) - expectedMinorUnits : 0

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Kasa Kapat</h3>
          <button
            type="button"
            disabled={shiftLoading}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          {openTablesCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-[12px] text-red-700">
                <p className="font-semibold mb-0.5">Dikkat: Şu anda açık olan {openTablesCount} masa var!</p>
                <p>Açık masaların adisyonları bu vardiya kapanışına dahil edilmez.</p>
              </div>
            </div>
          )}

          <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-[12px] text-amber-700">
              {canViewExpected ? (
                <>
                  <p className="font-semibold mb-0.5">Beklenen bakiye: {"\u20BA"}{formatCurrency(expected)}</p>
                  <p>Kasadaki fiziksel nakit tutarını sayarak girin.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold mb-0.5">Kör Sayım</p>
                  <p>Kasadaki fiziksel nakit tutarını sayarak girin.</p>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#86868b] mb-1.5 block">Sayılan Kapanış Bakiyesi *</label>
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={shiftLoading}
              value={closeBalance}
              onChange={(e) => {
                const v = e.target.value
                if (v !== "" && Number(v) < 0) return
                setCloseBalance(v)
              }}
              placeholder="Fiziksel nakit tutarını girin..."
              autoFocus
              className="w-full h-[40px] px-3 text-[15px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
            />
          </div>

          {canViewExpected && isValidClose && (
            <div
              className={`rounded-xl px-3 py-2 text-[12px] font-medium flex items-center justify-between ${
                diffMinorUnits === 0
                  ? "bg-green-50 text-green-700"
                  : diffMinorUnits > 0
                    ? "bg-blue-50 text-blue-700"
                    : "bg-red-50 text-red-700"
              }`}
            >
              <span>Kasa Farkı</span>
              <span className="font-bold">
                {diffMinorUnits === 0
                  ? "Tam (\u20BA0,00)"
                  : diffMinorUnits > 0
                    ? `+\u20BA${formatCurrency(fromMinorUnits(diffMinorUnits))} (Fazla)`
                    : `-\u20BA${formatCurrency(fromMinorUnits(Math.abs(diffMinorUnits)))} (Açık)`}
              </span>
            </div>
          )}

          <div>
            <label className="text-[12px] font-medium text-[#86868b] mb-1.5 block">Not (opsiyonel)</label>
            <input
              type="text"
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Açıklama..."
              disabled={shiftLoading}
              className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
            />
          </div>
          {shiftError && <p className="text-[13px] text-red-500">{shiftError}</p>}
        </div>
        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button type="button" onClick={onClose} disabled={shiftLoading} className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b] disabled:opacity-50">
            Vazgeç
          </button>
          <button type="button" onClick={onSubmit} disabled={shiftLoading || !isValidClose} className="flex-1 h-[38px] rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {shiftLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Kapatılıyor…</> : "Kasayı Kapat"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AddCashTransactionModal(props: {
  txType: "expense" | "cash-in" | "cash-out"
  setTxType: (v: "expense" | "cash-in" | "cash-out") => void
  expenseMethod?: "cash" | "credit-card"
  setExpenseMethod?: (v: "cash" | "credit-card") => void
  txAmount: string
  setTxAmount: (v: string) => void
  txDesc: string
  setTxDesc: (v: string) => void
  canTxIn?: boolean
  canTxOut?: boolean
  onClose: () => void
  onSubmit: () => Promise<void> | void
}) {
  const {
    txType,
    setTxType,
    expenseMethod = "cash",
    setExpenseMethod,
    txAmount,
    setTxAmount,
    txDesc,
    setTxDesc,
    canTxIn = true,
    canTxOut = true,
    onClose,
    onSubmit,
  } = props
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const allowedTypes = (["expense", "cash-in", "cash-out"] as const).filter((t) =>
    t === "cash-in" ? canTxIn : canTxOut,
  )

  useEffect(() => {
    if (allowedTypes.length > 0 && !allowedTypes.includes(txType)) {
      setTxType(allowedTypes[0])
    }
  }, [allowedTypes, txType, setTxType])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting && !submittingRef.current) onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isSubmitting, onClose])

  const parsedAmount = parseFloat(txAmount)
  const isValid =
    allowedTypes.includes(txType) && Number.isFinite(parsedAmount) && parsedAmount > 0 && txDesc.trim().length > 0

  const handleConfirm = async () => {
    if (!isValid || isSubmitting || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    try {
      await onSubmit()
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">İşlem Ekle</h3>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          <div className="flex gap-2">
            {allowedTypes.map((t) => (
              <button
                key={t}
                type="button"
                disabled={isSubmitting}
                onClick={() => setTxType(t)}
                className={`flex-1 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors ${
                  txType === t ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]" : "border-[#d1d1d6]/60 text-[#86868b]"
                }`}
              >
                {t === "expense" ? "Gider" : t === "cash-in" ? "Nakit Giriş" : "Nakit Çıkış"}
              </button>
            ))}
          </div>
          {txType === "expense" && setExpenseMethod && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block">Ödeme Yöntemi</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setExpenseMethod("cash")}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors ${
                    expenseMethod === "cash"
                      ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]"
                      : "border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" /> Nakit (Kasadan)
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setExpenseMethod("credit-card")}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors ${
                    expenseMethod === "credit-card"
                      ? "border-[#007aff] bg-[#007aff]/5 text-[#007aff]"
                      : "border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" /> Kredi Kartı
                </button>
              </div>
              <p className="text-[11px] text-[#86868b]">
                {expenseMethod === "credit-card"
                  ? "Kredi kartı ile yapılan giderler kasadaki fiziksel nakit bakiyesinden düşülmez."
                  : "Nakit giderler kasadaki fiziksel nakit bakiyesinden (Beklenen Kasa) düşülür."}
              </p>
            </div>
          )}
          <input
            type="number"
            min={0.01}
            step="0.01"
            disabled={isSubmitting}
            value={txAmount}
            onChange={(e) => {
              const v = e.target.value
              if (v !== "" && Number(v) < 0) return
              setTxAmount(v)
            }}
            placeholder="Tutar"
            autoFocus
            className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
          />
          <input
            type="text"
            disabled={isSubmitting}
            value={txDesc}
            onChange={(e) => setTxDesc(e.target.value)}
            placeholder="Açıklama *"
            className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
          />
        </div>
        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b] disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!isValid || isSubmitting}
            onClick={() => void handleConfirm()}
            className="flex-1 h-[38px] rounded-xl bg-[#e63462] text-white text-[13px] font-semibold hover:bg-[#d42d56] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ekle"}
          </button>
        </div>
      </div>
    </div>
  )
}
