import { useState, useEffect } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { itemCountsTowardBill, itemIsLedgerLike } from "@/lib/panel-types"
import { formatCurrency, formatIstanbulTime, fromMinorUnits, toMinorUnits } from "@/lib/format"
import { usePanelToast } from "./panel-toast"
import { usePanelAuth } from "@/lib/panel-auth"
import PaymentModal, { type PaymentSplitTarget } from "./payment-modal"
import OrderCancelModal from "./order-cancel-modal"
import SplitBillModal from "./split-bill-modal"
import DiscountModal from "./discount-modal"
import MoveTableModal from "./move-table-modal"
import MoveOrderItemModal from "./move-order-item-modal"
import AddTableOrderModal from "./add-table-order-modal"
import { TableLedgerModal, type AssignLedgerTarget } from "./tables/table-ledger-modal"
import { X, CreditCard, Printer, ArrowRightLeft, User, Clock, Percent, Users, Tag, Gift, CornerUpRight, BookUser, CircleX, Plus, Lock } from "lucide-react"
function getUserName(users: { id: string; name: string }[], id: string) {return users.find((u) => u.id === id)?.name ?? ""}
type PaymentTargetState = { mode: "full" } | PaymentSplitTarget
interface Props {
  tableId: string
  onClose: () => void
}
export default function TableDetailPanel({ tableId, onClose }: Props) {
  const { tables, users, getTableOrders, getTableTotal, reprintReceipt, clearDiscount, clearSplitBill, ledgerCustomers, ledgerRefresh, assignItemsToLedger, revertLedgerOrderItem } = usePanelStore()
  const { token, hasPermission } = usePanelAuth()
  const { showToast } = usePanelToast()
  const canCreateOrder = hasPermission("order.create")
  const canCloseCheck = hasPermission("billing.close_check")
  const canSplitBill = hasPermission("billing.split_bill")
  const canDiscount = hasPermission(
    "discount.apply_percent",
    "discount.apply_amount",
    "discount.complimentary",
  )
  const canRemoveDiscount = hasPermission("discount.remove")
  const canPrintReceipt = hasPermission("order.print_receipt")
  const canMoveTable = hasPermission("table.move")
  const canMoveItems = hasPermission("order.move_items")
  const canCancelItem = hasPermission("order.cancel_item")
  const canAssignLedger = hasPermission("ledger.assign_order")
  const canRevertLedger = hasPermission("ledger.revert_item")
  const [activeTab, setActiveTab] = useState(0)
  const [paymentTarget, setPaymentTarget] = useState<PaymentTargetState | null>(null)
  const [showSplitBill, setShowSplitBill] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showMoveTable, setShowMoveTable] = useState(false)
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [moveItem, setMoveItem] = useState<{
    orderId: string
    itemId: string
    itemName: string
  } | null>(null)
  const [cancelItem, setCancelItem] = useState<{
    orderId: string
    itemId: string
    itemName: string
  } | null>(null)
  const [assignLedger, setAssignLedger] = useState<AssignLedgerTarget | null>(null)
  const [revertLedgerItemId, setRevertLedgerItemId] = useState<string | null>(null); useEffect(() => {
    if (!assignLedger || !token) return
    void ledgerRefresh()
  }, [assignLedger, token, ledgerRefresh])
  const table = tables.find((t) => t.id === tableId)
  const tableOrders = getTableOrders(tableId)
  const rawTotal = getTableTotal(tableId)
  const discount = table?.discount
  const discountAmount = discount?.amount || 0
  const total = fromMinorUnits(Math.max(0, toMinorUnits(rawTotal) - toMinorUnits(discountAmount))); if (!table) return null
  const safeTab = Math.min(activeTab, Math.max(tableOrders.length - 1, 0))
  const activeOrder = tableOrders[safeTab]
  const activeOrderHasPrintableLines = Boolean(activeOrder && activeOrder.items.some((i) => itemCountsTowardBill(i)),)
  const hasPaidPersonShares = table.splitInfo?.type === "person" &&
    (table.splitInfo.paidShares?.length ?? 0) > 0
  const handlePrint = () => {
    void reprintReceipt(tableId); showToast(`${table.name} masası — konsolide fiş yazıcıya gönderildi`, "success")
  }
  const handlePrintActiveOrder = () => {
    if (!activeOrder || !activeOrder.items.some((i) => itemCountsTowardBill(i))) return
    void reprintReceipt({ orderId: activeOrder.id }); showToast("Seçili adisyon fişi (notlarla) yazıcıya gönderildi", "success")
  }
  const renderSplitSection = () => {
    if (!table.splitInfo) return null
    const isPerson = table.splitInfo.type === "person" && Boolean(table.splitInfo.personCount)
    const count = table.splitInfo.personCount ?? 2
    const totalMinorUnits = Math.max(0, toMinorUnits(total))
    const paidShares = table.splitInfo.paidShares ?? []
    const paidSumMinorUnits = paidShares.reduce((s, p) => s + toMinorUnits(p.amount), 0)
    const remainingUnpaidMinorUnits = Math.max(0, totalMinorUnits - paidSumMinorUnits)
    const remainingUnpaid = fromMinorUnits(remainingUnpaidMinorUnits)
    const unpaidIndices = Array.from({ length: count }, (_, i) => i).filter((i) => !paidShares.some((p) => p.shareIndex === i),)
    const itemLines = table.splitInfo.type === "items" && table.splitInfo.amounts
        ? Object.entries(table.splitInfo.amounts)
            .filter(([, qty]) => qty > 0)
            .map(([itemId, quantity]) => ({ itemId, quantity }))
        : []
    const selectedTotal = table.splitInfo.selectedTotal ?? 0
    return (
      <div className="mt-2">
        <div className="flex items-center flex-wrap gap-2 text-[12px] mb-2">
          <span className="flex items-center gap-1 px-2 py-1 bg-[#007aff]/10 text-[#007aff] rounded-md font-medium"><Users className="w-3 h-3" /> {isPerson ? `${count} Kişiye Bölündü` : `${table.splitInfo.itemIds?.length ?? itemLines.length} Ürün Ayrıldı`} </span>
          {canSplitBill && !hasPaidPersonShares && (
            <button type="button" onClick={() => void clearSplitBill(tableId)} className="text-[11px] font-medium text-[#86868b] hover:text-[#ff3b30] underline underline-offset-2"> Bölmeyi kaldır </button>
          )}
          {hasPaidPersonShares && (
            <span className="text-[11px] text-[#86868b]"> ({paidShares.length}/{count} pay tahsil edildi) </span>
          )}
        </div>
        {isPerson && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: count }).map((_, idx) => {
                const paidShare = paidShares.find((p) => p.shareIndex === idx); if (paidShare) {
                  return (
                    <span key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#34c759]/15 text-[#248a3d] border border-[#34c759]/30 rounded-lg text-[11px] font-semibold"> ✓ {idx + 1}. Kişi: {formatCurrency(paidShare.amount)} TL Ödendi </span>
                  )
                }
                const uPos = unpaidIndices.indexOf(idx)
                const uCount = Math.max(1, unpaidIndices.length)
                const shareMinorUnits = uCount === 1
                    ? remainingUnpaidMinorUnits
                    : Math.floor(remainingUnpaidMinorUnits / uCount) +
                      (uPos >= 0 && uPos < remainingUnpaidMinorUnits % uCount ? 1 : 0)
                const shareAmount = fromMinorUnits(shareMinorUnits); return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!canCloseCheck || shareMinorUnits <= 0}
                    onClick={() =>
                      setPaymentTarget({
                        mode: "person-share",
                        shareIndex: idx,
                        personCount: count,
                        amount: shareAmount,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f7] rounded-lg text-[12px] font-medium hover:bg-[#e8e8ed] transition-colors disabled:opacity-50"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#007aff] text-white text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-[#1d1d1f]">
                      {formatCurrency(shareAmount)} TL
                    </span>
                  </button>
                )
              })}
            </div>
            {paidShares.length > 0 && (
              <p className="mt-1.5 text-[11px] font-semibold text-[#007aff]"> Kalan Tahsilat: ₺{formatCurrency(remainingUnpaid)} </p>
            )}
          </>
        )}
        {table.splitInfo.type === "items" && selectedTotal > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!canCloseCheck || itemLines.length === 0}
              onClick={() =>
                setPaymentTarget({
                  mode: "items",
                  lines: itemLines,
                  amount: selectedTotal,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007aff]/10 rounded-lg text-[12px] font-medium hover:bg-[#007aff]/20 transition-colors border border-[#007aff]/30 disabled:opacity-50"
            >
              <span className="w-5 h-5 rounded-full bg-[#007aff] text-white text-[10px] flex items-center justify-center">1</span>
              <span className="text-[#007aff]">{formatCurrency(selectedTotal)} TL</span>
              <span className="text-[10px] text-[#007aff]/80">(Ayrılan — Öde)</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f7] rounded-lg text-[12px] font-medium">
              <span className="w-5 h-5 rounded-full bg-[#86868b] text-white text-[10px] flex items-center justify-center">2</span>
              <span className="text-[#1d1d1f]"> {formatCurrency(fromMinorUnits(Math.max(0, toMinorUnits(total) - toMinorUnits(selectedTotal))))} TL </span>
              <span className="text-[10px] text-[#86868b]">(Masada Kalan)</span>
            </div>
          </div>
        )}
      </div>
    )
  }
  return (
    <>
      <div className="w-[400px] h-full border-l border-[#d1d1d6]/60 bg-white flex flex-col flex-shrink-0">
        <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 flex items-center justify-between px-4">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] truncate"> {table.name} </h3>
            {table.status === "checkout" && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Hesap Kesimde</span>
            )}
            {table.lockedByStaffName && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full"><Lock className="w-2.5 h-2.5" /> {table.lockedByStaffName} </span>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] transition-colors"><X className="w-3.5 h-3.5 text-[#86868b]" /></button>
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-[#f5f5f7]/50 border-b border-[#d1d1d6]/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[12px] text-[#86868b]">
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{" "} <span className="capitalize">{table.waiter || "-"}</span>
              </span>
              <span>{tableOrders.length} Adisyon</span>
            </div>
            <div className="text-right">
              {discount && (
                <span className="text-[12px] text-[#86868b] line-through mr-2"> {"₺"} {formatCurrency(rawTotal)} </span>
              )}
              <span className="text-[18px] font-bold text-[#e63462]"> {"₺"} {formatCurrency(total)} </span>
            </div>
          </div>
          {discount && (
            <div className="mt-2 flex items-center flex-wrap gap-2 text-[12px]">
              <span className="flex items-center gap-1 px-2 py-1 bg-[#e63462]/10 text-[#e63462] rounded-md font-medium">
                {discount.type === "complimentary" ? (
                  <Gift className="w-3 h-3" />
                ) : (
                  <Tag className="w-3 h-3" />
                )}
                {discount.type === "percent"
                  ? `%${discount.value}`
                  : discount.type === "complimentary"
                    ? "Tam İkram"
                    : `${formatCurrency(discount.value)} TL`}{" "}
                İndirim
              </span>
              <span className="text-[#86868b]">{discount.reason}</span>
              {canRemoveDiscount && !hasPaidPersonShares && (
                <button type="button" onClick={() => void clearDiscount(tableId)} className="text-[11px] font-medium text-[#86868b] hover:text-[#ff3b30] underline underline-offset-2"> İndirimi kaldır </button>
              )}
            </div>
          )}
          {renderSplitSection()}
        </div>
        {tableOrders.length > 1 && (
          <div className="flex-shrink-0 px-4 py-2 border-b border-[#d1d1d6]/40 flex gap-1.5 overflow-x-auto">
            {tableOrders.map((order, idx) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                title={order.userName?.trim() || getUserName(users, order.userId) || undefined}
                className={`px-3 py-1 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${
                  safeTab === idx
                    ? "bg-[#e63462] text-white"
                    : "bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed]"
                }`}
              >
                #{idx + 1}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-auto">
          {!activeOrder && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <p className="text-[13px] text-[#86868b] mb-3">Bu masada henüz adisyon yok</p>
              <button
                type="button"
                onClick={() => setShowAddOrder(true)}
                disabled={!canCreateOrder || table.status === "checkout"}
                className="flex items-center gap-1.5 px-4 h-[36px] rounded-xl bg-[#e63462] text-white text-[13px] font-semibold hover:bg-[#d12d57] disabled:opacity-45 disabled:pointer-events-none transition-colors"
              >
                <Plus className="w-4 h-4" /> Sipariş Gir
              </button>
            </div>
          )}
          {activeOrder && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-3 text-[11px] text-[#86868b]">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> Garson:{" "} {activeOrder.userName?.trim() || getUserName(users, activeOrder.userId) || "Personel"} </span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatIstanbulTime(activeOrder.createdAt)} </span>
                {activeOrder.mergedFrom && (
                  <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded"><ArrowRightLeft className="w-3 h-3" /> {activeOrder.mergedFrom}{" "} masasından </span>
                )}
              </div>
              <div className="flex flex-col">
                {activeOrder.items.map((item, idx, arr) => {
                  const ledgerLike = itemIsLedgerLike(item)
                  const struck = item.status === "cancelled" && !ledgerLike
                  const showActions = itemCountsTowardBill(item); return (
                    <div key={item.id} className={`py-2.5 ${idx < arr.length - 1 ? "border-b border-[#f0f0f0]" : ""} ${ledgerLike ? "bg-amber-50/80 -mx-2 px-2 rounded-lg" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className={`text-[13px] font-medium ${struck ? "line-through text-[#86868b]" : ledgerLike ? "text-amber-950" : "text-[#1d1d1f]"}`}> {item.productName} </span>
                          {item.note && (
                            <p className="text-[11px] text-[#86868b] italic mt-0.5"> * {item.note} </p>
                          )}
                          {ledgerLike && (
                            <p className="text-[11px] text-amber-800 mt-0.5 font-medium">Cariye yazıldı</p>
                          )}
                          {struck && item.cancelledBy && (
                            <p className="text-[11px] text-red-600 mt-0.5"> İptal eden: {item.cancelledBy} </p>
                          )}
                          {struck && item.cancelReason && (
                            <p className="text-[11px] text-red-600 mt-0.5"> Sebep: {item.cancelReason} </p>
                          )}
                        </div>
                        <div className="flex items-start gap-1 flex-shrink-0">
                          {item.status === "ledger" && token && canRevertLedger && (
                            <button
                              type="button"
                              title="Cariyi geri al"
                              aria-label="Cariyi geri al"
                              disabled={revertLedgerItemId === item.id}
                              onClick={async () => {
                                setRevertLedgerItemId(item.id)
                                const res = await revertLedgerOrderItem(item.id); setRevertLedgerItemId(null); if (res.ok) {
                                  showToast(
                                    `Satır adisyona alındı (${formatCurrency(res.amount ?? 0)} TL hesaptan düşüldü)`,
                                    "success",
                                  )
                                }
                              }}
                              className="mt-0.5 p-1 rounded-full text-amber-900 hover:bg-amber-200/90 disabled:opacity-45 transition-colors"
                            >
                              <CircleX className="w-[18px] h-[18px]" strokeWidth={2} />
                            </button>
                          )}
                          <div className="text-right flex-shrink-0">
                            <span className={`text-[13px] font-medium ${struck ? "line-through text-[#86868b]" : ledgerLike ? "text-amber-900" : "text-[#e63462]"}`}> {"₺"} {formatCurrency(fromMinorUnits(toMinorUnits(item.price) * item.quantity))} </span>
                            <p className="text-[11px] text-[#86868b]">{item.quantity} adet</p>
                          </div>
                        </div>
                      </div>
                      {showActions && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {canMoveItems && (
                            <button type="button" onClick={() => setMoveItem({ orderId: activeOrder.id, itemId: item.id, itemName: item.productName, }) } className="text-[11px] text-[#007aff] hover:text-[#0051d5] font-medium inline-flex items-center gap-0.5"><CornerUpRight className="w-3 h-3" /> Başka masaya </button>
                          )}
                          {token && canAssignLedger && (
                            <button type="button" onClick={() => setAssignLedger({ orderId: activeOrder.id, itemId: item.id, itemName: item.productName, unitPrice: item.price, maxQty: item.quantity, }) } className="text-[11px] text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-0.5"><BookUser className="w-3 h-3" /> Cariye at </button>
                          )}
                          {canCancelItem && (
                            <button type="button" onClick={() => setCancelItem({ orderId: activeOrder.id, itemId: item.id, itemName: item.productName, }) } className="text-[11px] text-red-500 hover:text-red-600 font-medium"> İptal Et </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        {discount && (
          <div className="flex-shrink-0 px-4 py-3 bg-[#fef3f5] border-t border-[#e63462]/20">
            <div className="flex justify-between text-[13px] mb-1">
              <span className="text-[#86868b]">Ara Toplam</span>
              <span className="text-[#1d1d1f]"> {"₺"} {formatCurrency(rawTotal)} </span>
            </div>
            <div className="flex justify-between text-[13px] text-[#e63462]">
              <span>İndirim ({discount.reason})</span>
              <span> -{"₺"} {formatCurrency(discountAmount)} </span>
            </div>
            <div className="flex justify-between text-[15px] font-bold mt-1 pt-1 border-t border-[#e63462]/20">
              <span className="text-[#1d1d1f]">Toplam</span>
              <span className="text-[#e63462]"> {"₺"} {formatCurrency(total)} </span>
            </div>
          </div>
        )}
        <div className="flex-shrink-0 border-t border-[#d1d1d6]/60 p-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowAddOrder(true)}
            disabled={!canCreateOrder || table.status === "checkout"}
            className="flex items-center justify-center gap-2 w-full h-[40px] bg-[#e63462] hover:bg-[#d12d57] disabled:opacity-45 disabled:pointer-events-none text-white rounded-xl text-[14px] font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Sipariş Gir
          </button>
          <button
            onClick={() => setPaymentTarget({ mode: "full" })}
            disabled={!canCloseCheck || tableOrders.length === 0}
            className="flex items-center justify-center gap-2 w-full h-[40px] bg-[#34c759] hover:bg-[#2db84e] disabled:opacity-45 disabled:pointer-events-none text-white rounded-xl text-[14px] font-semibold transition-colors"
          >
            <CreditCard className="w-4 h-4" /> Hesap Kes
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSplitBill(true)}
              disabled={!canSplitBill || tableOrders.length === 0 || hasPaidPersonShares}
              title={
                hasPaidPersonShares
                  ? "Kişi payı tahsilatı başladıktan sonra bölüşüm değiştirilemez"
                  : undefined
              }
              className={`flex-1 flex items-center justify-center gap-1.5 h-[36px] rounded-xl text-[13px] font-medium transition-colors disabled:opacity-45 disabled:pointer-events-none ${
                table.splitInfo
                  ? "bg-[#007aff]/10 text-[#007aff] border border-[#007aff]/30"
                  : "bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Hesap Böl
            </button>
            <button
              onClick={() => setShowDiscount(true)}
              disabled={!canDiscount || tableOrders.length === 0 || hasPaidPersonShares}
              className={`flex-1 flex items-center justify-center gap-1.5 h-[36px] rounded-xl text-[13px] font-medium transition-colors disabled:opacity-45 disabled:pointer-events-none ${
                discount
                  ? "bg-[#e63462]/10 text-[#e63462] border border-[#e63462]/30"
                  : "bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"
              }`}
            >
              <Percent className="w-3.5 h-3.5" /> İndirim
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!canPrintReceipt || tableOrders.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 h-[36px] bg-[#f5f5f7] hover:bg-[#e8e8ed] disabled:opacity-45 disabled:pointer-events-none rounded-xl text-[12px] font-medium text-[#1d1d1f] transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Masa fişi
              </button>
              <button
                type="button"
                onClick={handlePrintActiveOrder}
                disabled={!canPrintReceipt || !activeOrder || !activeOrderHasPrintableLines}
                className="flex-1 flex items-center justify-center gap-1.5 h-[36px] bg-[#f5f5f7] hover:bg-[#e8e8ed] disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed rounded-xl text-[12px] font-medium text-[#1d1d1f] transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Adisyon fişi
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowMoveTable(true)}
              disabled={!canMoveTable || tableOrders.length === 0}
              className="w-full flex items-center justify-center gap-1.5 h-[36px] bg-[#f5f5f7] hover:bg-[#e8e8ed] disabled:opacity-45 disabled:pointer-events-none rounded-xl text-[13px] font-medium text-[#1d1d1f] transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Taşı
            </button>
          </div>
        </div>
      </div>
      {showAddOrder && (
        <AddTableOrderModal tableId={tableId} tableName={table.name} onClose={() => setShowAddOrder(false)} onSuccess={() => { setShowAddOrder(false); showToast(`${table.name} — sipariş gönderildi`, "success") }} />
      )}
      {paymentTarget && (
        <PaymentModal
          tableId={tableId}
          total={rawTotal}
          splitTarget={paymentTarget.mode === "full" ? undefined : paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onOpenSplitBill={
            canSplitBill && !hasPaidPersonShares
              ? () => {
                  setPaymentTarget(null); setShowSplitBill(true)
                }
              : undefined
          }
        />
      )}
      {showSplitBill && (
        <SplitBillModal tableId={tableId} total={total} onClose={() => setShowSplitBill(false)} onPayItemsNow={(lines, selectedTotal) => { setShowSplitBill(false); setPaymentTarget({ mode: "items", lines, amount: selectedTotal }) }} />
      )}
      {showDiscount && (
        <DiscountModal tableId={tableId} total={rawTotal} onClose={() => setShowDiscount(false)} />
      )}
      {showMoveTable && (
        <MoveTableModal tableId={tableId} onClose={() => setShowMoveTable(false)} />
      )}
      {moveItem && (
        <MoveOrderItemModal sourceTableId={tableId} itemIds={[moveItem.itemId]} productHint={moveItem.itemName} onClose={() => setMoveItem(null)} />
      )}
      {cancelItem && (
        <OrderCancelModal orderId={cancelItem.orderId} itemId={cancelItem.itemId} itemName={cancelItem.itemName} onClose={() => setCancelItem(null)} />
      )}
      {assignLedger && (
        <TableLedgerModal
          target={assignLedger}
          ledgerCustomers={ledgerCustomers}
          assignItemsToLedger={assignItemsToLedger}
          onClose={() => setAssignLedger(null)}
          onAssigned={(itemName, amount) => {
            showToast(
              `${itemName} Cariye yazıldı (${formatCurrency(amount)} TL)`,
              "success",
            ); setAssignLedger(null)
          }}
          onError={() => {}}
        />
      )}
    </>
  )
}
