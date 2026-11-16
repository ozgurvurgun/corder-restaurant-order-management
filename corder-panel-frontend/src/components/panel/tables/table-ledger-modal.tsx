import { useState, useEffect } from "react"
import { X } from "lucide-react"
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

  useEffect(() => {
    setAssignQty(target.maxQty)
  }, [target.maxQty])

  const handleConfirm = async () => {
    if (!assignCustomerId) return
    setAssignLoading(true)
    const res = await assignItemsToLedger(
      [{ itemId: target.itemId, quantity: assignQty }],
      assignCustomerId,
    )
    setAssignLoading(false)
    if (res.ok) {
      onAssigned(
        target.itemName,
        res.amount ?? target.unitPrice * assignQty,
      )
    } else {
      onError()
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f]">
            Cariye at
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
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
                value={assignQty}
                onChange={(e) => {
                  const v = Math.floor(Number(e.target.value))
                  if (!Number.isFinite(v)) return
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
            Borc tutari:{" "}
            <span className="font-semibold text-[#1d1d1f]">
              {"\u20BA"}
              {formatCurrency(target.unitPrice * assignQty)}
            </span>
          </p>
          <div>
            <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block mb-1.5">
              Cari musteri
            </label>
            <select
              value={assignCustomerId}
              onChange={(e) => setAssignCustomerId(e.target.value)}
              className="w-full h-[42px] px-3 text-[13px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 focus:outline-none focus:ring-2 focus:ring-[#e63462]/30"
            >
              <option value="">Secin...</option>
              {ledgerCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {ledgerCustomers.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-2">
                Kasa → Cariler sekmesinden musteri ekleyin.
              </p>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[#f0f0f0] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[40px] rounded-xl border border-[#d1d1d6]/60 text-[14px] font-medium text-[#86868b]"
          >
            Vazgec
          </button>
          <button
            type="button"
            disabled={assignLoading || !assignCustomerId}
            onClick={() => void handleConfirm()}
            className="flex-1 h-[40px] rounded-xl bg-amber-600 text-white text-[14px] font-semibold hover:bg-amber-700 disabled:opacity-50"
          >
            {assignLoading ? "..." : "Onayla"}
          </button>
        </div>
      </div>
    </div>
  )
}
