import { useState } from "react"
import {
  ArrowLeft,
  Plus,
  ArrowRightLeft,
  Printer,
  User,
  ChevronRight,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency } from "@/lib/services"
import { useToast } from "@/components/ios-toast"
import { ConfirmDialog } from "./confirm-dialog"

interface TableDetailScreenProps {
  tableId: string
  onBack: () => void
  onNewOrder: () => void
  onMoveTable: () => void
  onViewAdisyonlar: () => void
}

export function TableDetailScreen({
  tableId,
  onBack,
  onNewOrder,
  onMoveTable,
  onViewAdisyonlar,
}: TableDetailScreenProps) {
  const { showToast } = useToast()
  const { tables, getTableOrders, getTableTotal, printReceipt, currentUser } = useApp()
  const [printing, setPrinting] = useState(false)
  const [showMoveConfirm, setShowMoveConfirm] = useState(false)

  const table = tables.find((t) => t.id === tableId)
  if (!table) return null

  const tableOrders = getTableOrders(tableId)
  const total = getTableTotal(tableId)
  const orderCount = tableOrders.length
  const isCheckoutLocked = table.status === "checkout"

  const handleMoveConfirmed = () => {
    setShowMoveConfirm(false)
    onMoveTable()
  }

  const handlePrint = async () => {
    setPrinting(true)
    await printReceipt(tableId)
    showToast("Adisyon yazdirildi")
    setPrinting(false)
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#e63462] via-[#c62a6b] to-[#7b2d8e] safe-top safe-bottom">
      <div className="flex-1 flex flex-col items-center px-6 pt-10">
        {/* Table Name */}
        <h1 className="text-[32px] font-bold text-white tracking-tight mt-4">
          {table.name.replace(" ", " - #")}
        </h1>

        {/* Waiter + Check Count - Clickable */}
        <button
          onClick={onViewAdisyonlar}
          className="flex items-center gap-3 text-white/70 mt-2 mb-1 active:text-white transition-colors py-2"
          disabled={orderCount === 0}
        >
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            <span className="text-[15px] font-medium capitalize">
              {table.waiter || currentUser?.name || "-"}
            </span>
          </div>
          <span className="text-[15px] font-medium">{orderCount} Adisyon</span>
          {orderCount > 0 && <ChevronRight className="h-4 w-4" />}
        </button>

        <p className="text-white text-[22px] font-bold mt-1 mb-10">
          {"Hesap ₺"}{formatCurrency(total)}
        </p>

        {/* iOS-style Action List */}
        <div className="w-full max-w-xs flex flex-col gap-3">
          <ActionRow
            icon={<Plus className="h-[20px] w-[20px]" />}
            label="Yeni Adisyon"
            onClick={onNewOrder}
            disabled={isCheckoutLocked}
            color="text-[#e63462]"
          />
          <ActionRow
            icon={<ArrowRightLeft className="h-[20px] w-[20px]" />}
            label="Masayi Tasi"
            onClick={() => setShowMoveConfirm(true)}
            disabled={isCheckoutLocked}
            color="text-[#e63462]"
          />
          <ActionRow
            icon={<Printer className="h-[20px] w-[20px]" />}
            label="Yazdir"
            onClick={handlePrint}
            disabled={printing || total === 0}
            color="text-[#e63462]"
          />
        </div>
        {isCheckoutLocked && (
          <p className="mt-3 text-[12px] font-medium text-white/90 bg-[#0a84ff]/30 border border-white/25 rounded-xl px-3 py-2">
            Bu masada hesap kesme penceresi acik. Pencere kapanana kadar terminalden yeni siparis alinamaz.
          </p>
        )}
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center justify-center gap-2 text-white/80 active:text-white py-4 mx-6 transition-colors"
      >
        <ArrowLeft className="h-[18px] w-[18px]" />
        <span className="font-semibold text-[15px]">{"Masalara Don"}</span>
      </button>

      {/* Footer */}
      <div className="text-center pb-6">
        <p className="text-white/30 text-[12px] font-medium">Powered By</p>
        <p className="text-white/60 font-bold text-[13px] tracking-wider mt-0.5">
          COMPART SOFTWARE
        </p>
      </div>

      {/* Move Table Confirmation */}
      <ConfirmDialog
        open={showMoveConfirm}
        title="Masayi Tasi"
        message={`${table.name} masasini baska bir masaya tasimak istediginize emin misiniz?`}
        confirmText="Evet, Tasi"
        cancelText="Vazgec"
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
  color,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  color: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3.5 bg-white/95 backdrop-blur-sm ${color} font-semibold py-[14px] px-5 rounded-2xl shadow-sm transition-all active:scale-[0.98] active:bg-white/80 disabled:opacity-40`}
    >
      {icon}
      <span className="text-[16px]">{label}</span>
    </button>
  )
}
