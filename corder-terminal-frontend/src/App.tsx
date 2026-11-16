import { useState, useEffect } from "react"
import { useApp } from "@/lib/store"
import { useToast } from "@/components/ios-toast"
import { LoginScreen } from "@/components/login-screen"
import { UserSelectScreen } from "@/components/user-select-screen"
import { TablesScreen } from "@/components/tables-screen"
import { TableDetailScreen } from "@/components/table-detail-screen"
import { OrderMenuScreen } from "@/components/order-menu-screen"
import { CartScreen } from "@/components/cart-screen"
import { MoveTableScreen } from "@/components/move-table-screen"
import { OpenOrdersScreen } from "@/components/open-orders-screen"
import { MoveOrderItemScreen } from "@/components/move-order-item-screen"

export default function App() {
  const {
    isLoggedIn,
    currentUser,
    activeScreen,
    selectedTable,
    logout,
    setActiveScreen,
    selectTable,
    releaseTableSession,
  } = useApp()
  const { showToast } = useToast()
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [moveItemPick, setMoveItemPick] = useState<{ itemId: string; productName: string } | null>(null)

  const currentTableId = selectedTable?.id ?? selectedTableId

  useEffect(() => {
    if (!currentUser) {
      setSelectedTableId(null)
      setMoveItemPick(null)
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
      showToast(
        res.holderName ? `Bu masada şu an ${res.holderName} çalışıyor.` : "Masa başka garsonda açık.",
        "error"
      )
      return
    }
    setSelectedTableId(tableId)
    setActiveScreen("table-detail")
  }

  const handleNewOrder = () => setActiveScreen("order")
  const handleOpenCart = () => setActiveScreen("cart")

  const handleBackToTables = () => {
    releaseTableSession()
    setSelectedTableId(null)
    setActiveScreen("tables")
  }

  const handleBackToTableDetail = () => setActiveScreen("table-detail")
  const handleBackToMenu = () => setActiveScreen("order")
  const handleMoveTable = () => setActiveScreen("move-table")

  const handleTableMoved = () => {
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

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-md min-h-dvh relative">
        <LoginScreen onLogin={handleLogin} />
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md min-h-dvh relative">
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
            onMoveItem={(itemId, productName) => {
              setMoveItemPick({ itemId, productName })
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

  return <div className="mx-auto max-w-md min-h-dvh relative">{renderTerminalScreen()}</div>
}
