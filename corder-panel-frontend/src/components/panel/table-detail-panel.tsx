import { useState, useEffect } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { itemCountsTowardBill, itemIsLedgerLike } from "@/lib/panel-types"
import { usePanelToast } from "./panel-toast"
import { usePanelAuth } from "@/lib/panel-auth"
import PaymentModal from "./payment-modal"
import OrderCancelModal from "./order-cancel-modal"
import SplitBillModal from "./split-bill-modal"
import DiscountModal from "./discount-modal"
import MoveTableModal from "./move-table-modal"
import MoveOrderItemModal from "./move-order-item-modal"
import AddTableOrderModal from "./add-table-order-modal"
import { TableLedgerModal, type AssignLedgerTarget } from "./tables/table-ledger-modal"
import { X, CreditCard, Printer, ArrowRightLeft, User, Clock, Percent, Users, Tag, Gift, CornerUpRight, BookUser, CircleX, Plus } from "lucide-react"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }
function formatTime(d: Date) { return new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) }
function getUserName(users: { id: string; name: string }[], id: string) { return users.find((u) => u.id === id)?.name ?? "" }

interface Props {
  tableId: string
  onClose: () => void
}

export default function TableDetailPanel({ tableId, onClose }: Props) {
  const {
    tables, users, getTableOrders, getTableTotal, reprintReceipt, clearDiscount,
    ledgerCustomers, ledgerRefresh, assignItemsToLedger, revertLedgerOrderItem,
  } = usePanelStore()
  const { token } = usePanelAuth()
  const { showToast } = usePanelToast()
  const [activeTab, setActiveTab] = useState(0)
  const [showPayment, setShowPayment] = useState(false)
  const [showSplitBill, setShowSplitBill] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showMoveTable, setShowMoveTable] = useState(false)
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [moveItem, setMoveItem] = useState<{ orderId: string; itemId: string; itemName: string } | null>(null)
  const [cancelItem, setCancelItem] = useState<{ orderId: string; itemId: string; itemName: string } | null>(null)
  const [assignLedger, setAssignLedger] = useState<AssignLedgerTarget | null>(null)
  const [revertLedgerItemId, setRevertLedgerItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!assignLedger || !token) return
    void ledgerRefresh()
  }, [assignLedger, token, ledgerRefresh])

  const table = tables.find((t) => t.id === tableId)
  const tableOrders = getTableOrders(tableId)
  const rawTotal = getTableTotal(tableId)
  const discount = table?.discount
  const discountAmount = discount?.amount || 0
  const total = Math.max(0, rawTotal - discountAmount)

  if (!table) return null
  const safeTab = Math.min(activeTab, Math.max(tableOrders.length - 1, 0))
  const activeOrder = tableOrders[safeTab]
  const activeOrderHasPrintableLines = Boolean(activeOrder && activeOrder.items.some((i) => itemCountsTowardBill(i)))

  const handlePrint = () => {
    void reprintReceipt(tableId)
    showToast(`${table.name} masasi — konsolide fis yaziciya gonderildi`, "success")
  }

  const handlePrintActiveOrder = () => {
    if (!activeOrder || !activeOrder.items.some((i) => itemCountsTowardBill(i))) return
    void reprintReceipt({ orderId: activeOrder.id })
    showToast("Secili adisyon fisi (notlarla) yaziciya gonderildi", "success")
  }

  return (
    <>
      <div className="w-[400px] h-full border-l border-[#d1d1d6]/60 bg-white flex flex-col flex-shrink-0">
        <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 flex items-center justify-between px-4">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{table.name}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] transition-colors">
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>

        <div className="flex-shrink-0 px-4 py-3 bg-[#f5f5f7]/50 border-b border-[#d1d1d6]/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[12px] text-[#86868b]">
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> <span className="capitalize">{table.waiter}</span></span>
              <span>{tableOrders.length} Adisyon</span>
            </div>
            <div className="text-right">
              {discount && <span className="text-[12px] text-[#86868b] line-through mr-2">{"₺"}{formatCurrency(rawTotal)}</span>}
              <span className="text-[18px] font-bold text-[#e63462]">{"₺"}{formatCurrency(total)}</span>
            </div>
          </div>

          {discount && (
            <div className="mt-2 flex items-center flex-wrap gap-2 text-[12px]">
              <span className="flex items-center gap-1 px-2 py-1 bg-[#e63462]/10 text-[#e63462] rounded-md font-medium">
                {discount.type === "complimentary" ? <Gift className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
                {discount.type === "percent" ? `%${discount.value}` : discount.type === "complimentary" ? "Tam Ikram" : `${formatCurrency(discount.value)} TL`} Indirim
              </span>
              <span className="text-[#86868b]">{discount.reason}</span>
              <button type="button" onClick={() => clearDiscount(tableId)} className="text-[11px] font-medium text-[#86868b] hover:text-[#ff3b30] underline underline-offset-2">
                Indirimi kaldir
              </button>
            </div>
          )}

          {table.splitInfo && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-[12px] mb-2">
                <span className="flex items-center gap-1 px-2 py-1 bg-[#007aff]/10 text-[#007aff] rounded-md font-medium">
                  <Users className="w-3 h-3" />
                  {table.splitInfo.type === "person" ? `${table.splitInfo.personCount} Kisiye Bolundu` : `${table.splitInfo.itemIds?.length} Urun Ayrildi`}
                </span>
              </div>
              {table.splitInfo.type === "person" && table.splitInfo.personCount && (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: table.splitInfo.personCount }).map((_, idx) => (
                    <button key={idx} onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f7] rounded-lg text-[12px] font-medium hover:bg-[#e8e8ed] transition-colors">
                      <span className="w-5 h-5 rounded-full bg-[#007aff] text-white text-[10px] flex items-center justify-center">{idx + 1}</span>
                      <span className="text-[#1d1d1f]">{formatCurrency(table.splitInfo?.perPersonAmount || 0)} TL</span>
                    </button>
                  ))}
                </div>
              )}
              {table.splitInfo.type === "items" && table.splitInfo.selectedTotal && (
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007aff]/10 rounded-lg text-[12px] font-medium hover:bg-[#007aff]/20 transition-colors border border-[#007aff]/30">
                    <span className="w-5 h-5 rounded-full bg-[#007aff] text-white text-[10px] flex items-center justify-center">1</span>
                    <span className="text-[#007aff]">{formatCurrency(table.splitInfo.selectedTotal)} TL</span>
                    <span className="text-[10px] text-[#007aff]/70">(Ayrilan)</span>
                  </button>
                  <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f7] rounded-lg text-[12px] font-medium hover:bg-[#e8e8ed] transition-colors">
                    <span className="w-5 h-5 rounded-full bg-[#86868b] text-white text-[10px] flex items-center justify-center">2</span>
                    <span className="text-[#1d1d1f]">{formatCurrency(total - table.splitInfo.selectedTotal)} TL</span>
                    <span className="text-[10px] text-[#86868b]">(Kalan)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {tableOrders.length > 1 && (
          <div className="flex-shrink-0 px-4 py-2 border-b border-[#d1d1d6]/40 flex gap-1.5 overflow-x-auto">
            {tableOrders.map((order, idx) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                title={order.userName?.trim() || getUserName(users, order.userId) || undefined}
                className={`px-3 py-1 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${safeTab === idx ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed]"}`}
              >
                #{idx + 1}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {!activeOrder && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <p className="text-[13px] text-[#86868b] mb-3">Bu masada henuz adisyon yok</p>
              <button type="button" onClick={() => setShowAddOrder(true)} disabled={table.status === "checkout"} className="flex items-center gap-1.5 px-4 h-[36px] rounded-xl bg-[#e63462] text-white text-[13px] font-semibold hover:bg-[#d12d57] disabled:opacity-45 disabled:pointer-events-none transition-colors">
                <Plus className="w-4 h-4" /> Siparis Gir
              </button>
            </div>
          )}
          {activeOrder && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-3 text-[11px] text-[#86868b]">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> Garson: {activeOrder.userName?.trim() || getUserName(users, activeOrder.userId) || "Personel"}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(activeOrder.createdAt)}</span>
                {activeOrder.mergedFrom && (
                  <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    <ArrowRightLeft className="w-3 h-3" /> {activeOrder.mergedFrom} masasindan
                  </span>
                )}
              </div>

              <div className="flex flex-col">
                {activeOrder.items.map((item, idx, arr) => {
                  const ledgerLike = itemIsLedgerLike(item)
                  const struck = item.status === "cancelled" && !ledgerLike
                  const showActions = itemCountsTowardBill(item)
                  return (
                    <div key={item.id} className={`py-2.5 ${idx < arr.length - 1 ? "border-b border-[#f0f0f0]" : ""} ${ledgerLike ? "bg-amber-50/80 -mx-2 px-2 rounded-lg" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className={`text-[13px] font-medium ${struck ? "line-through text-[#86868b]" : ledgerLike ? "text-amber-950" : "text-[#1d1d1f]"}`}>
                            {item.productName}
                          </span>
                          {item.note && <p className="text-[11px] text-[#86868b] italic mt-0.5">* {item.note}</p>}
                          {ledgerLike && <p className="text-[11px] text-amber-800 mt-0.5 font-medium">Cariye yazildi</p>}
                          {struck && item.cancelledBy && <p className="text-[11px] text-red-600 mt-0.5">Iptal eden: {item.cancelledBy}</p>}
                          {struck && item.cancelReason && <p className="text-[11px] text-red-600 mt-0.5">Sebep: {item.cancelReason}</p>}
                        </div>
                        <div className="flex items-start gap-1 flex-shrink-0">
                          {item.status === "ledger" && token && (
                            <button
                              type="button"
                              title="Cariyi geri al"
                              aria-label="Cariyi geri al"
                              disabled={revertLedgerItemId === item.id}
                              onClick={async () => {
                                setRevertLedgerItemId(item.id)
                                const res = await revertLedgerOrderItem(item.id)
                                setRevertLedgerItemId(null)
                                if (res.ok) showToast(`Satir adisyona alindi (${formatCurrency(res.amount ?? 0)} TL hesaptan dusuldu)`, "success")
                                else showToast("Geri alinamadi (kayit veya vardiya)", "error")
                              }}
                              className="mt-0.5 p-1 rounded-full text-amber-900 hover:bg-amber-200/90 disabled:opacity-45 transition-colors"
                            >
                              <CircleX className="w-[18px] h-[18px]" strokeWidth={2} />
                            </button>
                          )}
                          <div className="text-right flex-shrink-0">
                            <span className={`text-[13px] font-medium ${struck ? "line-through text-[#86868b]" : ledgerLike ? "text-amber-900" : "text-[#e63462]"}`}>
                              {"₺"}{formatCurrency(item.price * item.quantity)}
                            </span>
                            <p className="text-[11px] text-[#86868b]">{item.quantity} adet</p>
                          </div>
                        </div>
                      </div>
                      {showActions && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          <button type="button" onClick={() => setMoveItem({ orderId: activeOrder.id, itemId: item.id, itemName: item.productName })} className="text-[11px] text-[#007aff] hover:text-[#0051d5] font-medium inline-flex items-center gap-0.5">
                            <CornerUpRight className="w-3 h-3" /> Baska masaya
                          </button>
                          {token && (
                            <button type="button" onClick={() => setAssignLedger({ orderId: activeOrder.id, itemId: item.id, itemName: item.productName, unitPrice: item.price, maxQty: item.quantity })} className="text-[11px] text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-0.5">
                              <BookUser className="w-3 h-3" /> Cariye at
                            </button>
                          )}
                          <button type="button" onClick={() => setCancelItem({ orderId: activeOrder.id, itemId: item.id, itemName: item.productName })} className="text-[11px] text-red-500 hover:text-red-600 font-medium">
                            Iptal Et
                          </button>
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
              <span className="text-[#1d1d1f]">{"₺"}{formatCurrency(rawTotal)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-[#e63462]">
              <span>Indirim ({discount.reason})</span>
              <span>-{"₺"}{formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-[15px] font-bold mt-1 pt-1 border-t border-[#e63462]/20">
              <span className="text-[#1d1d1f]">Toplam</span>
              <span className="text-[#e63462]">{"₺"}{formatCurrency(total)}</span>
            </div>
          </div>
        )}

        <div className="flex-shrink-0 border-t border-[#d1d1d6]/60 p-4 flex flex-col gap-2">
          <button type="button" onClick={() => setShowAddOrder(true)} disabled={table.status === "checkout"} className="flex items-center justify-center gap-2 w-full h-[40px] bg-[#e63462] hover:bg-[#d12d57] disabled:opacity-45 disabled:pointer-events-none text-white rounded-xl text-[14px] font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Siparis Gir
          </button>
          <button onClick={() => setShowPayment(true)} disabled={tableOrders.length === 0} className="flex items-center justify-center gap-2 w-full h-[40px] bg-[#34c759] hover:bg-[#2db84e] disabled:opacity-45 disabled:pointer-events-none text-white rounded-xl text-[14px] font-semibold transition-colors">
            <CreditCard className="w-4 h-4" /> Hesap Kes
          </button>
          <div className="flex gap-2">
            <button onClick={() => setShowSplitBill(true)} disabled={tableOrders.length === 0} className={`flex-1 flex items-center justify-center gap-1.5 h-[36px] rounded-xl text-[13px] font-medium transition-colors disabled:opacity-45 disabled:pointer-events-none ${table.splitInfo ? "bg-[#007aff]/10 text-[#007aff] border border-[#007aff]/30" : "bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"}`}>
              <Users className="w-3.5 h-3.5" /> Hesap Bol
            </button>
            <button onClick={() => setShowDiscount(true)} disabled={tableOrders.length === 0} className={`flex-1 flex items-center justify-center gap-1.5 h-[36px] rounded-xl text-[13px] font-medium transition-colors disabled:opacity-45 disabled:pointer-events-none ${discount ? "bg-[#e63462]/10 text-[#e63462] border border-[#e63462]/30" : "bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"}`}>
              <Percent className="w-3.5 h-3.5" /> Indirim
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button type="button" onClick={handlePrint} disabled={tableOrders.length === 0} className="flex-1 flex items-center justify-center gap-1.5 h-[36px] bg-[#f5f5f7] hover:bg-[#e8e8ed] disabled:opacity-45 disabled:pointer-events-none rounded-xl text-[12px] font-medium text-[#1d1d1f] transition-colors">
                <Printer className="w-3.5 h-3.5" /> Masa fisi
              </button>
              <button type="button" onClick={handlePrintActiveOrder} disabled={!activeOrder || !activeOrderHasPrintableLines} className="flex-1 flex items-center justify-center gap-1.5 h-[36px] bg-[#f5f5f7] hover:bg-[#e8e8ed] disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed rounded-xl text-[12px] font-medium text-[#1d1d1f] transition-colors">
                <Printer className="w-3.5 h-3.5" /> Adisyon fisi
              </button>
            </div>
            <button type="button" onClick={() => setShowMoveTable(true)} disabled={tableOrders.length === 0} className="w-full flex items-center justify-center gap-1.5 h-[36px] bg-[#f5f5f7] hover:bg-[#e8e8ed] disabled:opacity-45 disabled:pointer-events-none rounded-xl text-[13px] font-medium text-[#1d1d1f] transition-colors">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Tasi
            </button>
          </div>
        </div>
      </div>

      {showAddOrder && <AddTableOrderModal tableId={tableId} tableName={table.name} onClose={() => setShowAddOrder(false)} onSuccess={() => { setShowAddOrder(false); showToast(`${table.name} — siparis gonderildi`, "success") }} />}
      {showPayment && <PaymentModal tableId={tableId} total={rawTotal} onClose={() => setShowPayment(false)} />}
      {showSplitBill && <SplitBillModal tableId={tableId} total={total} onClose={() => setShowSplitBill(false)} />}
      {showDiscount && <DiscountModal tableId={tableId} total={rawTotal} onClose={() => setShowDiscount(false)} />}
      {showMoveTable && <MoveTableModal tableId={tableId} onClose={() => setShowMoveTable(false)} />}
      {moveItem && <MoveOrderItemModal sourceTableId={tableId} itemIds={[moveItem.itemId]} productHint={moveItem.itemName} onClose={() => setMoveItem(null)} />}
      {cancelItem && <OrderCancelModal orderId={cancelItem.orderId} itemId={cancelItem.itemId} itemName={cancelItem.itemName} onClose={() => setCancelItem(null)} />}
      {assignLedger && (
        <TableLedgerModal
          target={assignLedger}
          ledgerCustomers={ledgerCustomers}
          assignItemsToLedger={assignItemsToLedger}
          onClose={() => setAssignLedger(null)}
          onAssigned={(itemName, amount) => { showToast(`${itemName} Cariye yazildi (${formatCurrency(amount)} TL)`, "success"); setAssignLedger(null) }}
          onError={() => showToast("Cariye atanamadi", "error")}
        />
      )}
    </>
  )
}
