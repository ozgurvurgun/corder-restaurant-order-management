import { useState } from "react"
import {
  ArrowLeft,
  Plus,
  ArrowRightLeft,
  Printer,
  User,
  ChevronRight,
  Lock,
  ListOrdered,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency, translateApiError } from "@/lib/format"
import { useToast } from "@/components/ios-toast"
import { ConfirmDialog } from "./confirm-dialog"

interface TableDetailScreenProps {
  tableId: string
  onBack: () => void
  onNewOrder: () => void
  onMoveTable: () => void
  onViewOpenOrders: () => void
}

export function TableDetailScreen({
  tableId,
  onBack,
  onNewOrder,
  onMoveTable,
  onViewOpenOrders,
}: TableDetailScreenProps) {
  const { showToast } = useToast()
  const {
    tables,
    getTableOrders,
    getTableTotal,
    getCartItemCount,
    printReceipt,
    currentUser,
    hasPermission,
  } = useApp()
  const [isPrinting, setIsPrinting] = useState(false)
  const [showMoveConfirm, setShowMoveConfirm] = useState(false)

  const table = tables.find((t) => t.id === tableId)
  if (!table) return null

  const tableOrders = getTableOrders(tableId)
  const total = getTableTotal(tableId)
  const subtotal = table.subtotalAmount
  const hasDiscount = Boolean(table.discount && subtotal > total)
  const orderCount = tableOrders.length
  const cartCount = getCartItemCount()
  const isBillRequested = table.status === "bill-requested"

  const canCreateOrder = hasPermission("order.create")
  const canMoveTable = hasPermission("table.move")
  const canPrintReceipt = hasPermission("order.print_receipt")

  const handleMoveConfirmed = () => {
    setShowMoveConfirm(false)
    onMoveTable()
  }

  const handlePrint = async () => {
    if (isPrinting) return
    if (!canPrintReceipt) {
      showToast("Adisyon yazdırma yetkiniz bulunmuyor", "error")
      return
    }
    setIsPrinting(true)
    try {
      await printReceipt(tableId)
      showToast("Adisyon yazıcıya gönderildi")
    } catch (e) {
      showToast(translateApiError(e, "Yazdırılamadı"), "error")
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#e63462] via-[#c62a6b] to-[#7b2d8e] safe-top safe-bottom">
      <div className="flex-1 flex flex-col items-center px-6 pt-10">
        {/* Table Name */}
        <h1 className="text-[32px] font-bold text-white tracking-tight mt-4">
          {table.name.replace(" ", " - #")}
        </h1>

        {/* Waiter + Role + Check Count - Clickable */}
        <button
          type="button"
          onClick={onViewOpenOrders}
          className="flex items-center gap-3 text-white/75 mt-2 mb-1 active:text-white transition-colors py-2"
          disabled={orderCount === 0}
        >
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            <span className="text-[15px] font-medium capitalize">
              {table.activeWaiter || currentUser?.name || "-"}
            </span>
            {currentUser?.roleLabel && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                {currentUser.roleLabel}
              </span>
            )}
          </div>
          <span className="text-[15px] font-medium">{orderCount} Adisyon</span>
          {orderCount > 0 && <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="mt-1 mb-8 text-center">
          {hasDiscount && (
            <p className="text-white/60 text-[13px] line-through">
              {"Ara Toplam ₺"}
              {formatCurrency(subtotal)}
            </p>
          )}
          <p className="text-white text-[24px] font-bold">
            {"Hesap ₺"}
            {formatCurrency(total)}
          </p>
        </div>

        {/* iOS-style Action List */}
        <div className="w-full max-w-xs flex flex-col gap-3">
          <ActionRow
            icon={<Plus className="h-[20px] w-[20px]" />}
            label={cartCount > 0 ? `Siparişe Devam Et (${cartCount})` : "Yeni Adisyon / Ürün Ekle"}
            locked={!canCreateOrder}
            onClick={() => {
              if (!canCreateOrder) {
                showToast("Yeni sipariş açma yetkiniz bulunmuyor", "error")
                return
              }
              onNewOrder()
            }}
            disabled={isBillRequested}
            color="text-[#e63462]"
          />
          {orderCount > 0 && (
            <ActionRow
              icon={<ListOrdered className="h-[20px] w-[20px]" />}
              label={`Açık Adisyonlar (${orderCount})`}
              onClick={onViewOpenOrders}
              color="text-[#e63462]"
            />
          )}
          <ActionRow
            icon={<ArrowRightLeft className="h-[20px] w-[20px]" />}
            label="Masayı Taşı / Birleştir"
            locked={!canMoveTable}
            onClick={() => {
              if (!canMoveTable) {
                showToast(
                  "Masa taşıma yetkiniz bulunmuyor",
                  "error"
                )
                return
              }
              setShowMoveConfirm(true)
            }}
            disabled={isBillRequested || orderCount === 0}
            color="text-[#e63462]"
          />
          <ActionRow
            icon={<Printer className="h-[20px] w-[20px]" />}
            label={isPrinting ? "Yazdırılıyor..." : "Adisyon Yazdır"}
            locked={!canPrintReceipt}
            onClick={() => void handlePrint()}
            disabled={isPrinting || orderCount === 0}
            color="text-[#e63462]"
          />
        </div>
        {isBillRequested && (
          <p className="mt-4 text-[12px] font-medium text-white/90 bg-[#0a84ff]/30 border border-white/25 rounded-xl px-3.5 py-2.5 text-center max-w-xs">
            Bu masada hesap kesme penceresi açık. Pencere kapanana kadar terminalden yeni sipariş alınamaz.
          </p>
        )}
      </div>

      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center justify-center gap-2 text-white/80 active:text-white py-2.5 mx-6 transition-colors"
      >
        <ArrowLeft className="h-[18px] w-[18px]" />
        <span className="font-semibold text-[15px]">Masalara Dön</span>
      </button>

      {/* Footer */}
      <div className="text-center pb-1.5 pt-0.5">
        <p className="text-white/30 text-[12px] font-medium">Powered By</p>
        <p className="text-white/60 font-bold text-[13px] tracking-wider mt-0.5">
          COMPART SOFTWARE
        </p>
      </div>

      {/* Move Table Confirmation */}
      <ConfirmDialog
        open={showMoveConfirm}
        title="Masayı Taşı"
        message={`${table.name} masasını başka bir masaya taşımak veya birleştirmek istediğinize emin misiniz?`}
        confirmText="Hedef Masa Seç"
        cancelText="Vazgeç"
        onConfirm={handleMoveConfirmed}
        onCancel={() => setShowMoveConfirm(false)}
      />
    </div>
  )
}

function ActionRow({
  icon,
  label,
  onClick,
  disabled,
  locked,
  color,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  locked?: boolean
  color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-between bg-white/95 backdrop-blur-sm ${color} font-semibold py-[14px] px-5 rounded-2xl shadow-sm transition-all active:scale-[0.98] active:bg-white/80 disabled:opacity-40`}
    >
      <div className="flex items-center gap-3.5">
        {icon}
        <span className="text-[16px]">{label}</span>
      </div>
      {locked && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">
          <Lock className="h-3 w-3" /> Yetki Yok
        </span>
      )}
    </button>
  )
}
