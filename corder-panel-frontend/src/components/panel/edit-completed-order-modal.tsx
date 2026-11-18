import { useEffect, useMemo, useRef, useState } from "react"
import type { ClosedTable, PanelOrder, PanelPaymentMethod } from "@/lib/panel-types"
import { itemCountsTowardBill } from "@/lib/panel-types"
import type { CompletedOrderSnapshotDto, CompletedPaymentSnapshotDto } from "@/lib/api"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"
import { Loader2, X } from "lucide-react"
import { computeDiscountMinorUnits, formatCurrency, fromMinorUnits, toMinorUnits } from "@/lib/format"

function cloneOrders(orders: PanelOrder[]): PanelOrder[] {
  return orders.map((o) => ({
    ...o,
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
    items: o.items.map((i) => ({
      ...i,
      createdAt: new Date(i.createdAt),
      cancelledAt: i.cancelledAt ? new Date(i.cancelledAt) : undefined,
      sentAt: i.sentAt ? new Date(i.sentAt) : undefined,
    })),
  }))
}

function ordersToSnapshots(orders: PanelOrder[]): CompletedOrderSnapshotDto[] {
  const now = new Date().toISOString()
  return orders.map((o) => ({
    id: o.id,
    tableId: o.tableId || "",
    userId: o.userId || "",
    ...(o.userName ? { userName: o.userName } : {}),
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    updatedAt: now,
    ...(o.mergedFrom ? { mergedFrom: o.mergedFrom } : {}),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      price: i.price,
      quantity: i.quantity,
      ...(i.note ? { note: i.note } : {}),
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      ...(i.cancelReason ? { cancelReason: i.cancelReason } : {}),
      ...(i.cancelledBy ? { cancelledBy: i.cancelledBy } : {}),
      ...(i.cancelledAt ? { cancelledAt: i.cancelledAt.toISOString() } : {}),
    })),
  }))
}

function paymentToSnapshot(
  p: ClosedTable["payment"],
): CompletedPaymentSnapshotDto {
  return {
    id: p.id,
    tableId: p.tableId || "",
    tableName: p.tableName || "",
    orderIds: [...p.orderIds],
    amount: p.amount,
    method: p.method,
    splitDetails: p.splitDetails?.map((s) => ({ ...s })),
    discount: p.discount ? { ...p.discount } : undefined,
    tip: p.tip,
    processedBy: p.processedBy,
    createdAt: p.createdAt.toISOString(),
    ...(p.ledgerCustomerId || p.ledgerCustomerName
      ? {
          ledgerCustomerId: p.ledgerCustomerId,
          ledgerCustomerName: p.ledgerCustomerName,
        }
      : {}),
  }
}

const METHODS: { value: PanelPaymentMethod; label: string }[] = [
  { value: "cash", label: "Nakit" },
  { value: "credit-card", label: "Kredi Kartı" },
  { value: "meal-card", label: "Yemek Kartı" },
  { value: "multinet", label: "Multinet" },
  { value: "split", label: "Çoklu Ödeme" },
  { value: "ledger", label: "Cari" },
]

const SPLIT_METHODS: { key: PanelPaymentMethod; label: string }[] = [
  { key: "cash", label: "Nakit" },
  { key: "credit-card", label: "Kredi Kartı" },
  { key: "meal-card", label: "Yemek Kartı" },
  { key: "multinet", label: "Multinet" },
  { key: "ledger", label: "Cari" },
]

type Props = {
  closedTable: ClosedTable
  onClose: () => void
}

export function EditCompletedOrderModal({ closedTable, onClose }: Props) {
  const { updateCompletedOrder, currentUser, ledgerCustomers } = usePanelStore()
  const { showToast } = usePanelToast()
  const [draftOrders, setDraftOrders] = useState<PanelOrder[]>(() =>
    cloneOrders(closedTable.orders),
  )
  const [method, setMethod] = useState<PanelPaymentMethod>(closedTable.payment.method,)
  const [ledgerCustomerId, setLedgerCustomerId] = useState<string>(closedTable.payment.ledgerCustomerId || ledgerCustomers[0]?.id || "",)
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {
      cash: "",
      "credit-card": "",
      "meal-card": "",
      multinet: "",
      ledger: "",
    }
    if (closedTable.payment.splitDetails) {
      for (const sd of closedTable.payment.splitDetails) {
        if (sd.amount > 0) {map[sd.method] = String(sd.amount)}
      }
    }
    return map
  })

  const [cancellingTarget, setCancellingTarget] = useState<{
    orderId: string
    itemId: string
  } | null>(null)
  const [cancelReasonInput, setCancelReasonInput] = useState("")
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  const originalQtyByItemId = useMemo(() => {
    const map = new Map<string, number>(); for (const o of closedTable.orders) {
      for (const i of o.items) {map.set(i.id, i.quantity)}
    }
    return map
  }, [closedTable.orders]); useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !savingRef.current) {
        if (cancellingTarget) {
          setCancellingTarget(null); setCancelReasonInput("")
        } else {onClose()}
      }
    }
    window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown)
  }, [saving, cancellingTarget, onClose])

  const rawTotalMinorUnits = useMemo(() => {
    return draftOrders.reduce(
      (s, o) =>
        s +
        o.items
          .filter(itemCountsTowardBill)
          .reduce((a, i) => a + toMinorUnits(i.price) * i.quantity, 0),
      0,
    )
  }, [draftOrders])

  const rawTotal = fromMinorUnits(rawTotalMinorUnits)
  const previewDiscountMinorUnits = useMemo(
    () => computeDiscountMinorUnits(rawTotalMinorUnits, closedTable.payment.discount),
    [rawTotalMinorUnits, closedTable.payment.discount],
  )
  const previewDiscount = fromMinorUnits(previewDiscountMinorUnits)
  const previewNetMinorUnits = Math.max(0, rawTotalMinorUnits - previewDiscountMinorUnits)
  const previewNet = fromMinorUnits(previewNetMinorUnits)

  const splitSumMinorUnits = useMemo(() => {
    if (method !== "split") return 0
    return SPLIT_METHODS.reduce((acc, m) => {
      const val = parseFloat(String(splitInputs[m.key] || "").replace(",", "."))
      return acc + (Number.isFinite(val) && val > 0 ? toMinorUnits(val) : 0)
    }, 0)
  }, [method, splitInputs])

  const splitHasLedger = useMemo(() => {
    if (method !== "split") return false
    const val = parseFloat(String(splitInputs.ledger || "").replace(",", "."))
    return Number.isFinite(val) && val > 0
  }, [method, splitInputs.ledger])

  const splitDiffMinorUnits = previewNetMinorUnits - splitSumMinorUnits
  const isSplitValid = method !== "split" || splitDiffMinorUnits === 0
  const isLedgerValid =
    (method !== "ledger" && !splitHasLedger) || Boolean(ledgerCustomerId)

  const setQty = (orderId: string, itemId: string, qty: number) => {
    if (!Number.isFinite(qty) || qty < 1) return
    const maxQty = originalQtyByItemId.get(itemId) ?? qty
    const q = Math.min(maxQty, Math.max(1, Math.floor(qty))); setDraftOrders((prev) =>
      prev.map((o) =>
        o.id !== orderId
          ? o
          : {
              ...o,
              items: o.items.map((i) =>
                i.id === itemId ? { ...i, quantity: q } : i,
              ),
            },
      ),
    )
  }

  const confirmCancelLine = () => {
    if (!cancellingTarget) return
    const reason = cancelReasonInput.trim(); if (!reason) {
      showToast("Lütfen iptal nedenini girin", "error")
      return
    }
    const { orderId, itemId } = cancellingTarget
    const by = currentUser?.name || "Yönetici"
    setDraftOrders((prev) =>
      prev.map((o) =>
        o.id !== orderId
          ? o
          : {
              ...o,
              items: o.items.map((i) =>
                i.id === itemId
                  ? {
                      ...i,
                      status: "cancelled" as const,
                      cancelReason: reason,
                      cancelledBy: by,
                      cancelledAt: new Date(),
                    }
                  : i,
              ),
            },
      ),
    ); setCancellingTarget(null); setCancelReasonInput("")
  }

  const handleSave = async () => {
    if (saving || savingRef.current || !isSplitValid || !isLedgerValid) return
    savingRef.current = true; setSaving(true)
    try {
      const selectedLedgerCust = ledgerCustomers.find((c) => c.id === ledgerCustomerId,)
      const splitDetails =
        method === "split"
          ? SPLIT_METHODS.map((m) => {
              const val = parseFloat(String(splitInputs[m.key] || "").replace(",", "."),)
              return {
                method: m.key,
                amount: Number.isFinite(val) && val > 0 ? fromMinorUnits(toMinorUnits(val)) : 0,
              }
            }).filter((sd) => sd.amount > 0)
          : undefined

      const paymentSnap = paymentToSnapshot({
        ...closedTable.payment,
        method,
        amount: previewNet,
        splitDetails,
        ledgerCustomerId:
          method === "ledger" || splitHasLedger ? ledgerCustomerId : undefined,
        ledgerCustomerName:
          method === "ledger" || splitHasLedger
            ? selectedLedgerCust?.name || closedTable.payment.ledgerCustomerName
            : undefined,
      })
      const body = {
        orders: ordersToSnapshots(draftOrders),
        payment: paymentSnap,
      }
      const ok = await updateCompletedOrder(closedTable.id, body); if (ok) {
        showToast("Kayıt güncellendi", "success"); onClose()
      }
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-white rounded-2xl shadow-xl border border-[#d1d1d6]/60">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e8ed]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Tamamlanan Hesabı Düzenle</h3>
          <button type="button" disabled={saving} onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] disabled:opacity-50">
            <X className="w-4 h-4 text-[#86868b]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 text-[13px]">
          <p className="text-[11px] text-[#86868b] mb-3">
            {closedTable.tableName} — miktar azaltabilir, satır iptal edebilir
            veya ödeme yöntemini değiştirebilirsiniz. Toplamlar sunucuda
            doğrulanır.
          </p>
          {draftOrders.map((order, oi) => (
            <div key={order.id} className="mb-4">
              <p className="text-[11px] font-semibold text-[#86868b] mb-1">
                Adisyon #{oi + 1}
              </p>
              <div className="rounded-lg border border-[#e8e8ed] divide-y divide-[#f0f0f0]">
                {order.items.map((item) => {
                  const ledgerLike = item.status === "ledger"
                  const voidLine = item.status === "cancelled"
                  const billable = itemCountsTowardBill(item)
                  const maxQty = originalQtyByItemId.get(item.id) ?? item.quantity
                  const isCancellingThis =
                    cancellingTarget?.orderId === order.id &&
                    cancellingTarget?.itemId === item.id
                  return (
                    <div key={item.id} className="px-3 py-2 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-[120px]">
                          <span className={ voidLine ? "line-through text-[#86868b]" : ledgerLike ? "text-amber-950" : "text-[#1d1d1f]" }>
                            {item.productName}
                          </span>
                          {ledgerLike && (
                            <span className="block text-[10px] text-amber-800 font-medium">Cariye yazıldı</span>
                          )}
                          {voidLine && item.cancelReason && (
                            <span className="block text-[10px] text-red-600">
                              İptal: {item.cancelReason}
                            </span>
                          )}
                        </div>
                        {billable ? (
                          <>
                            <label className="flex items-center gap-1 text-[11px] text-[#86868b]">
                              Adet
                              <input type="number" min={1} max={maxQty} disabled={saving} className="w-14 h-8 px-2 rounded-md border border-[#d1d1d6] text-right" value={item.quantity} onChange={(e) => setQty( order.id, item.id, Number(e.target.value), ) } />
                            </label>
                            <button type="button" disabled={saving} onClick={() => { setCancellingTarget({ orderId: order.id, itemId: item.id, }); setCancelReasonInput("") }} className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50">
                              İptal
                            </button>
                          </>
                        ) : null}
                      </div>
                      {isCancellingThis && (
                        <div className="flex items-center gap-1.5 bg-red-50/70 p-2 rounded-lg border border-red-200">
                          <input
                            type="text"
                            autoFocus
                            value={cancelReasonInput}
                            onChange={(e) =>
                              setCancelReasonInput(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmCancelLine()
                            }}
                            placeholder="İptal nedeni girin *"
                            className="flex-1 h-7 px-2 text-[11px] bg-white rounded border border-red-200 focus:outline-none focus:border-red-400"
                          />
                          <button type="button" onClick={confirmCancelLine} className="h-7 px-2.5 bg-red-600 text-white rounded text-[11px] font-medium hover:bg-red-700">Onayla</button>
                          <button type="button" onClick={() => { setCancellingTarget(null); setCancelReasonInput("") }} className="h-7 px-2 text-[11px] text-[#86868b] hover:text-[#1d1d1f]">
                            Vazgeç
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="mt-2">
            <label className="block text-[11px] font-medium text-[#86868b] mb-1">Ödeme yöntemi</label>
            <select disabled={saving} className="w-full h-10 px-3 rounded-lg border border-[#d1d1d6] bg-white" value={method} onChange={(e) => setMethod(e.target.value as PanelPaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {method === "split" && (
            <div className="mt-3 p-3 rounded-xl border border-[#d1d1d6]/60 bg-[#fafafa] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#1d1d1f]">Çoklu Ödeme Dağılımı</span>
                <span className={`text-[11px] font-semibold ${ splitDiffMinorUnits === 0 ? "text-green-600" : "text-red-600" }`}>
                  {splitDiffMinorUnits === 0
                    ? "Toplam Eşleşti"
                    : splitDiffMinorUnits > 0
                      ? `Kalan: \u20BA${formatCurrency(fromMinorUnits(splitDiffMinorUnits))}`
                      : `Fazla: \u20BA${formatCurrency(fromMinorUnits(Math.abs(splitDiffMinorUnits)))}`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SPLIT_METHODS.map((m) => (
                  <label key={m.key} className="text-[11px] text-[#86868b]">
                    {m.label}
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={saving}
                      value={splitInputs[m.key] || ""}
                      onChange={(e) =>
                        setSplitInputs((prev) => ({
                          ...prev,
                          [m.key]: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                      className="mt-0.5 w-full h-8 px-2 text-[12px] bg-white rounded border border-[#d1d1d6]"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {(method === "ledger" || splitHasLedger) && (
            <div className="mt-3">
              <label className="block text-[11px] font-medium text-[#86868b] mb-1">Cari Müşteri *</label>
              <select disabled={saving} value={ledgerCustomerId} onChange={(e) => setLedgerCustomerId(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#d1d1d6] bg-white">
                <option value="">Cari Müşteri Seçin</option>
                {ledgerCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg bg-[#f5f5f7] text-[12px] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#86868b]">Ara toplam (önizleme)</span>
              <span>
                {"₺"}
                {formatCurrency(rawTotal)}
              </span>
            </div>
            {previewDiscount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>İndirim (mevcut)</span>
                <span>
                  -{"₺"}
                  {formatCurrency(previewDiscount)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t border-[#e0e0e0]">
              <span>Net (önizleme)</span>
              <span>
                {"₺"}
                {formatCurrency(previewNet)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-[#e8e8ed]">
          <button type="button" disabled={saving} onClick={onClose} className="flex-1 h-10 rounded-xl border border-[#d1d1d6] text-[13px] font-medium disabled:opacity-50">Vazgeç</button>
          <button
            type="button"
            disabled={saving || !isSplitValid || !isLedgerValid}
            onClick={() => void handleSave()}
            className="flex-1 h-10 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              "Kaydet"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
