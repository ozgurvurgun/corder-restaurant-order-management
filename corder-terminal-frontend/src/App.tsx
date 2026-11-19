import { useState, useEffect } from "react"
import { WifiOff } from "lucide-react"
import { useApp } from "@/lib/store"
import { useToast } from "@/components/ios-toast"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LoginScreen } from "@/components/login-screen"
import { UserSelectScreen } from "@/components/user-select-screen"
import { TablesScreen } from "@/components/tables-screen"
import { TableDetailScreen } from "@/components/table-detail-screen"
import { OrderMenuScreen } from "@/components/order-menu-screen"
import { CartScreen } from "@/components/cart-screen"
import { MoveTableScreen } from "@/components/move-table-screen"
import { OpenOrdersScreen } from "@/components/open-orders-screen"
import { MoveOrderItemScreen } from "@/components/move-order-item-screen"
import { WaiterCallAlertBanner } from "@/components/notification-settings-modal"

export default function App() {
  const {
    isLoggedIn,
     isOffline,
    currentUser,
    activeScreen,
    selectedTable,
    cart,
    clearCart,
    logout,
    setActiveScreen,
    selectTable,
    releaseTableSession,
    waiterCalls,
    dismissWaiterCall,
  } = useApp()
  const { showToast } = useToast()
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [moveItemPick, setMoveItemPick] = useState<{
    itemId: string
    productName: string
    maxQuantity: number
  } | null>(null)
  const [forceUnlockPrompt, setForceUnlockPrompt] = useState<{ tableId: string; holderName: string } | null>(null)
  const [forceUnlockLoading, setForceUnlockLoading] = useState(false)
  const [leaveCartConfirm, setLeaveCartConfirm] = useState(false)

  const currentTableId = selectedTable?.id ?? selectedTableId

  useEffect(() => {
    if (!currentUser) {
      setSelectedTableId(null)
      setMoveItemPick(null)
      setForceUnlockPrompt(null)
      setLeaveCartConfirm(false)
    }
  }, [currentUser])

  const handleLogin = () => {
    setActiveScreen("tables")
  }

  const handleUserSelect = () => {
    setActiveScreen("tables")
  }

  const handleTableSelect = async (tableId: string) => {
    const res = await selectTable(tableId)
    if (!res.ok) {
      if (res.canForceUnlock) {
        setForceUnlockPrompt({
          tableId,
          holderName: res.holderName || "Başka bir garson",
        })
        return
      }
      showToast(
        res.holderName ? `Bu masada şu an ${res.holderName} çalışıyor.` : "Masa başka garsonda açık.",
        "error"
      )
      return
    }
    setSelectedTableId(tableId)
    setActiveScreen("table-detail")
  }

  const handleConfirmForceUnlock = async () => {
    if (!forceUnlockPrompt || forceUnlockLoading) return
    setForceUnlockLoading(true)
    try {
      const res = await selectTable(forceUnlockPrompt.tableId, true)
      if (!res.ok) {
        showToast(res.holderName || "Masa kilidi devralınamadı", "error")
        return
      }
      const targetId = forceUnlockPrompt.tableId
      setForceUnlockPrompt(null)
      setSelectedTableId(targetId)
      setActiveScreen("table-detail")
      showToast("Masa kilidi devralındı")
    } finally {
      setForceUnlockLoading(false)
    }
  }

  const handleNewOrder = () => setActiveScreen("order")
  const handleOpenCart = () => setActiveScreen("cart")

  const exitTableToFloor = () => {
    if (currentTableId) {
      clearCart(currentTableId)
    }
    releaseTableSession()
    setSelectedTableId(null)
    setLeaveCartConfirm(false)
    setActiveScreen("tables")
  }

  const handleBackToTables = () => {
    if (cart.length > 0) {
      setLeaveCartConfirm(true)
      return
    }
    exitTableToFloor()
  }

  const handleBackToTableDetail = () => setActiveScreen("table-detail")
  const handleBackToMenu = () => setActiveScreen("order")
  const handleMoveTable = () => setActiveScreen("move-table")

  const handleTableMoved = () => {
    if (currentTableId) clearCart(currentTableId)
    releaseTableSession()
    setSelectedTableId(null)
    setActiveScreen("tables")
  }

  const handleOrderSent = () => setActiveScreen("table-detail")
  const handleViewOpenOrders = () => setActiveScreen("open-orders")

  const handleStaffLogout = () => {
    logout()
    setSelectedTableId(null)
    setMoveItemPick(null)
  }

  const offlineBanner = isOffline ? (
    <div className="bg-amber-600 text-white px-4 py-1.5 text-[12px] font-semibold flex items-center justify-center gap-2 z-[60]">
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
      <span>İnternet bağlantısı yok - bağlantı bekleniyor, sepetiniz korunuyor</span>
    </div>
  ) : null

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-md min-h-dvh relative flex flex-col">
        {offlineBanner}
        <LoginScreen onLogin={handleLogin} />
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md min-h-dvh relative flex flex-col">
        {offlineBanner}
        <UserSelectScreen onSelect={handleUserSelect} />
      </div>
    )
  }

  const renderTerminalScreen = () => {
    switch (activeScreen) {
      case "tables":
        return <TablesScreen onTableSelect={handleTableSelect} onLogout={handleStaffLogout} />
      case "table-detail":
        if (!currentTableId) return <TablesScreen onTableSelect={handleTableSelect} onLogout={handleStaffLogout} />
        return (
          <TableDetailScreen
            tableId={currentTableId}
            onBack={handleBackToTables}
            onNewOrder={handleNewOrder}
            onMoveTable={handleMoveTable}
            onViewOpenOrders={handleViewOpenOrders}
          />
        )
      case "order":
        if (!currentTableId) return null
        return (
          <OrderMenuScreen
            tableId={currentTableId}
            onBack={handleBackToTableDetail}
            onCartOpen={handleOpenCart}
          />
        )
      case "cart":
        if (!currentTableId) return null
        return (
          <CartScreen
            tableId={currentTableId}
            onBack={handleBackToMenu}
            onOrderSent={handleOrderSent}
          />
        )
      case "move-table":
        if (!currentTableId) return null
        return (
          <MoveTableScreen
            fromTableId={currentTableId}
            onBack={handleBackToTableDetail}
            onMoved={handleTableMoved}
          />
        )
      case "open-orders":
        if (!currentTableId) return null
        return (
          <OpenOrdersScreen
            tableId={currentTableId}
            onBack={handleBackToTableDetail}
            onCartOpen={handleOpenCart}
            onNewOrder={handleNewOrder}
            onMoveItem={(itemId, productName, maxQuantity) => {
              setMoveItemPick({ itemId, productName, maxQuantity })
              setActiveScreen("move-item")
            }}
          />
        )
      case "move-item":
        if (!currentTableId || !moveItemPick) return null
        return (
          <MoveOrderItemScreen
            fromTableId={currentTableId}
            itemId={moveItemPick.itemId}
            productName={moveItemPick.productName}
            maxQuantity={moveItemPick.maxQuantity}
            onBack={() => {
              setMoveItemPick(null)
              setActiveScreen("open-orders")
            }}
          />
        )
      default:
        return <TablesScreen onTableSelect={handleTableSelect} onLogout={handleStaffLogout} />
    }
  }

  return (
    <div className="mx-auto max-w-md min-h-dvh relative flex flex-col">
      {offlineBanner}
      <WaiterCallAlertBanner calls={waiterCalls} onDismiss={dismissWaiterCall} />
      <div className="flex-1 relative">{renderTerminalScreen()}</div>

      <ConfirmDialog
        open={Boolean(forceUnlockPrompt)}
        title="Masa Kilidini Devral"
        message={
          forceUnlockPrompt
            ? `Bu masa şu an ${forceUnlockPrompt.holderName} tarafından açık görünüyor. Kilidi devralıp masayı açmak istiyor musunuz?`
            : ""
        }
        confirmText="Kilidi Devral"
        cancelText="Vazgeç"
        loading={forceUnlockLoading}
        destructive
        onConfirm={() => void handleConfirmForceUnlock()}
        onCancel={() => {
          if (!forceUnlockLoading) setForceUnlockPrompt(null)
        }}
      />

      <ConfirmDialog
        open={leaveCartConfirm}
        title="Sepette Gönderilmemiş Ürünler Var"
        message="Masadan çıkarsanız sepetteki gönderilmemiş ürünler silinecektir. Masadan çıkmak istiyor musunuz?"
        confirmText="Sepeti Sil ve Çık"
        cancelText="Masada Kal"
        destructive
        onConfirm={exitTableToFloor}
        onCancel={() => setLeaveCartConfirm(false)}
      />
    </div>
  )
}
