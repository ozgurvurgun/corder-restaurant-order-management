import { useState, useEffect, useRef } from "react"
import { Loader2, X } from "lucide-react"
import type { LedgerCustomer } from "@/lib/panel-types"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}

export interface AssignLedgerTarget {
  orderId: string
  itemId: string
  itemName: string
  unitPrice: number
  maxQty: number
}

export function TableLedgerModal(props: {
  target: AssignLedgerTarget
  ledgerCustomers: LedgerCustomer[]
  assignItemsToLedger: (
    lines: { itemId: string; quantity?: number }[],
    ledgerCustomerId: string,
  ) => Promise<{ ok: boolean; amount?: number }>
  onClose: () => void
  onAssigned: (itemName: string, amount: number) => void
  onError: () => void
}) {
  const {
    target,
    ledgerCustomers,
    assignItemsToLedger,
    onClose,
    onAssigned,
    onError,
  } = props
  const [assignQty, setAssignQty] = useState(target.maxQty)
  const [assignCustomerId, setAssignCustomerId] = useState("")
  const [assignLoading, setAssignLoading] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    setAssignQty(target.maxQty)
  }, [target.maxQty])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !assignLoading && !submittingRef.current) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [assignLoading, onClose])

  const safeQty = Math.min(target.maxQty, Math.max(1, Math.floor(assignQty) || 1))

  const handleConfirm = async () => {
    if (!assignCustomerId || assignLoading || submittingRef.current || safeQty < 1) return
    submittingRef.current = true
    setAssignLoading(true)
    try {
      const res = await assignItemsToLedger(
        [{ itemId: target.itemId, quantity: safeQty }],
        assignCustomerId,
      )
      if (res.ok) {
        onAssigned(
          target.itemName,
          res.amount ?? target.unitPrice * safeQty,
        )
      } else {
        onError()
      }
    } finally {
      submittingRef.current = false
      setAssignLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f]">
            Cariye At
          </h3>
          <button
            type="button"
            disabled={assignLoading}
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50"
          >
            <X className="w-4 h-4 text-[#86868b]" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-[14px] font-medium text-[#1d1d1f]">
            {target.itemName}
          </p>
          <div>
            <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block mb-1.5">
              Adet (Cariye)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={target.maxQty}
                disabled={assignLoading}
                value={safeQty}
                onChange={(e) => {
                  const v = Math.floor(Number(e.target.value))
                  if (!Number.isFinite(v) || v < 1) return
                  setAssignQty(Math.min(target.maxQty, Math.max(1, v)))
                }}
                className="w-24 h-[42px] px-3 text-[13px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 focus:outline-none focus:ring-2 focus:ring-[#e63462]/30"
              />
              <span className="text-[12px] text-[#86868b]">
                / {target.maxQty} adet
              </span>
            </div>
          </div>
          <p className="text-[13px] text-[#86868b]">
            Borç tutarı:{" "}
            <span className="font-semibold text-[#1d1d1f]">
              {"\u20BA"}
              {formatCurrency(target.unitPrice * safeQty)}
            </span>
          </p>
          <div>
            <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block mb-1.5">
              Cari Müşteri
            </label>
            <select
              value={assignCustomerId}
              disabled={assignLoading}
              onChange={(e) => setAssignCustomerId(e.target.value)}
              className="w-full h-[42px] px-3 text-[13px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 focus:outline-none focus:ring-2 focus:ring-[#e63462]/30"
            >
              <option value="">Seçin...</option>
              {ledgerCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {ledgerCustomers.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-2">
                Kasa → Cariler sekmesinden müşteri ekleyin.
              </p>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[#f0f0f0] flex gap-2">
          <button
            type="button"
            disabled={assignLoading}
            onClick={onClose}
            className="flex-1 h-[40px] rounded-xl border border-[#d1d1d6]/60 text-[14px] font-medium text-[#86868b] disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={assignLoading || !assignCustomerId}
            onClick={() => void handleConfirm()}
            className="flex-1 h-[40px] rounded-xl bg-amber-600 text-white text-[14px] font-semibold hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Onayla"}
          </button>
        </div>
      </div>
    </div>
  )
}
