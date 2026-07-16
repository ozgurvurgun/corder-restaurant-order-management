import { useMemo, useState } from "react"
import type { ClosedTable, PanelOrder, PaymentMethod } from "@/lib/panel-types"
import { itemCountsTowardBill, itemIsLedgerLike } from "@/lib/panel-types"
import type { CompletedOrderSnapshotDto, CompletedPaymentSnapshotDto } from "@/lib/api"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"
import { X } from "lucide-react"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}

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
    tableId: o.tableId,
    userId: o.userId,
    userName: o.userName,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    updatedAt: now,
    mergedFrom: o.mergedFrom,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      price: i.price,
      quantity: i.quantity,
      note: i.note,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      cancelReason: i.cancelReason,
      cancelledBy: i.cancelledBy,
      cancelledAt: i.cancelledAt?.toISOString(),
    })),
  }))
}

function paymentToSnapshot(p: ClosedTable["payment"]): CompletedPaymentSnapshotDto {
  return {
    id: p.id,
    tableId: p.tableId,
    tableName: p.tableName,
    orderIds: [...p.orderIds],
    amount: p.amount,
    method: p.method,
    splitDetails: p.splitDetails?.map((s) => ({ ...s })),
    discount: p.discount ? { ...p.discount } : undefined,
    tip: p.tip,
    processedBy: p.processedBy,
    createdAt: p.createdAt.toISOString(),
    ...(p.ledgerCustomerId || p.ledgerCustomerName
      ? { ledgerCustomerId: p.ledgerCustomerId, ledgerCustomerName: p.ledgerCustomerName }
      : {}),
  }
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "nakit", label: "Nakit" },
  { value: "kredi-karti", label: "Kredi karti" },
  { value: "yemek-karti", label: "Yemek karti" },
  { value: "multinet", label: "Multinet" },
  { value: "coklu", label: "Coklu odeme" },
  { value: "cari", label: "Cari" },
]

type Props = {
  closedTable: ClosedTable
  onClose: () => void
}

export function EditCompletedOrderModal({ closedTable, onClose }: Props) {
  const { updateCompletedOrder, currentUser } = usePanelStore()
  const { showToast } = usePanelToast()
  const [draftOrders, setDraftOrders] = useState<PanelOrder[]>(() => cloneOrders(closedTable.orders))
  const [method, setMethod] = useState<PaymentMethod>(closedTable.payment.method)
  const [saving, setSaving] = useState(false)

  const rawTotal = useMemo(() => {
    return draftOrders.reduce(
      (s, o) =>
        s +
        o.items.filter(itemCountsTowardBill).reduce((a, i) => a + i.price * i.quantity, 0),
      0,
    )
  }, [draftOrders])

  const previewDiscount = useMemo(() => {
    const d = closedTable.payment.discount
    if (!d || rawTotal <= 0) return 0
    if (d.type === "percent") {
      if (d.value >= 100) return rawTotal
      return Math.round((rawTotal * d.value) / 100)
    }
    return Math.min(d.value, rawTotal)
  }, [closedTable.payment.discount, rawTotal])

  const previewNet = Math.max(0, rawTotal - previewDiscount)

  const setQty = (orderId: string, itemId: string, qty: number) => {
    const q = Math.max(1, Math.floor(qty) || 1)
    setDraftOrders((prev) =>
      prev.map((o) =>
        o.id !== orderId
          ? o
          : {
              ...o,
              items: o.items.map((i) => (i.id === itemId ? { ...i, quantity: q } : i)),
            },
      ),
    )
  }

  const cancelLine = (orderId: string, itemId: string) => {
    const reason = window.prompt("Iptal nedeni?")?.trim()
    if (!reason) return
    const by = currentUser?.name || "Yonetici"
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
    )
  }

  const handleSave = async () => {
    setSaving(true)
    const paymentSnap = paymentToSnapshot({
      ...closedTable.payment,
      method,
      amount: previewNet,
    })
    const body = {
      orders: ordersToSnapshots(draftOrders),
      payment: paymentSnap,
    }
    const prevNet = closedTable.netAmount
    const prevMethod = closedTable.payment.method
    const ok = await updateCompletedOrder(closedTable.id, body, {
      previousNet: prevNet,
      previousMethod: prevMethod,
    })
    setSaving(false)
    if (ok) {
      showToast("Kayit guncellendi", "success")
      onClose()
    } else {
      showToast("Kaydedilemedi (yetki veya baglanti)", "error")
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-white rounded-2xl shadow-xl border border-[#d1d1d6]/60">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e8ed]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Tamamlanan hesabi duzenle</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f5f5f7]">
            <X className="w-4 h-4 text-[#86868b]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 text-[13px]">
          <p className="text-[11px] text-[#86868b] mb-3">
            {closedTable.tableName} — miktar ve odeme yontemi; satirlari iptal edebilirsiniz. Toplamlar sunucuda hesaplanir.
          </p>
          {draftOrders.map((order, oi) => (
            <div key={order.id} className="mb-4">
              <p className="text-[11px] font-semibold text-[#86868b] mb-1">Adisyon #{oi + 1}</p>
              <div className="rounded-lg border border-[#e8e8ed] divide-y divide-[#f0f0f0]">
                {order.items.map((item) => {
                  const ledgerLike = itemIsLedgerLike(item)
                  const voidLine = item.status === "cancelled" && !ledgerLike
                  const billable = itemCountsTowardBill(item)
                  return (
                  <div key={item.id} className="px-3 py-2 flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[120px]">
                      <span className={voidLine ? "line-through text-[#86868b]" : ledgerLike ? "text-amber-950" : "text-[#1d1d1f]"}>
                        {item.productName}
                      </span>
                      {ledgerLike && (
                        <span className="block text-[10px] text-amber-800 font-medium">Cariye yazildi</span>
                      )}
                      {voidLine && item.cancelReason && (
                        <span className="block text-[10px] text-red-600">Iptal: {item.cancelReason}</span>
                      )}
                    </div>
                    {billable ? (
                      <>
                        <label className="flex items-center gap-1 text-[11px] text-[#86868b]">
                          Adet
                          <input
                            type="number"
                            min={1}
                            className="w-14 h-8 px-2 rounded-md border border-[#d1d1d6] text-right"
                            value={item.quantity}
                            onChange={(e) => setQty(order.id, item.id, Number(e.target.value))}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => cancelLine(order.id, item.id)}
                          className="text-[11px] font-medium text-red-600 hover:underline"
                        >
                          Iptal
                        </button>
                      </>
                    ) : null}
                  </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="mt-2">
            <label className="block text-[11px] font-medium text-[#86868b] mb-1">Odeme yontemi</label>
            <select
              className="w-full h-10 px-3 rounded-lg border border-[#d1d1d6] bg-white"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-[#f5f5f7] text-[12px] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#86868b]">Ara toplam (onizleme)</span>
              <span>{"₺"}{formatCurrency(rawTotal)}</span>
            </div>
            {previewDiscount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Indirim (mevcut)</span>
                <span>-{"₺"}{formatCurrency(previewDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t border-[#e0e0e0]">
              <span>Net (onizleme)</span>
              <span>{"₺"}{formatCurrency(previewNet)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-[#e8e8ed]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[#d1d1d6] text-[13px] font-medium"
          >
            Vazgec
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 h-10 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  )
}
