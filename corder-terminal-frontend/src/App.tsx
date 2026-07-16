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
import { AdisyonlarScreen } from "@/components/adisyonlar-screen"
import { MoveOrderItemScreen } from "@/components/move-order-item-screen"

type Screen =
  | "login"
  | "user-select"
  | "tables"
  | "table-detail"
  | "order-menu"
  | "cart"
  | "move-table"
  | "move-order-item"
  | "adisyonlar"

export default function App() {
  const { isLoggedIn, currentUser, staffLogout, requestTableFocus, releaseTableFocus } = useApp()
  const { showToast } = useToast()
  const [screen, setScreen] = useState<Screen>("login")
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [moveItemPick, setMoveItemPick] = useState<{ itemId: string; productName: string } | null>(null)

  useEffect(() => {
    if (!isLoggedIn && screen !== "login") setScreen("login")
  }, [isLoggedIn, screen])

  // If already signed in while on the login screen, go to user-select or (if staff session exists) to tables
  useEffect(() => {
    if (isLoggedIn && screen === "login") {
      setScreen(currentUser ? "tables" : "user-select")
    }
  }, [isLoggedIn, screen, currentUser])

  // If staff session was restored (after refreshData), go from user-select to tables
  useEffect(() => {
    if (isLoggedIn && currentUser && screen === "user-select") {
      setScreen("tables")
    }
  }, [isLoggedIn, currentUser, screen])

  // Cannot enter tables/order screens until a user is selected
  useEffect(() => {
    if (isLoggedIn && screen !== "login" && screen !== "user-select" && !currentUser) {
      setScreen("user-select")
      setSelectedTableId(null)
    }
  }, [isLoggedIn, screen, currentUser])

  const handleLogin = () => setScreen("user-select")
  const handleUserSelect = () => setScreen("tables")
  const handleTableSelect = async (tableId: string) => {
    const r = await requestTableFocus(tableId)
    if (!r.ok) {
      showToast(
        r.holderName ? `Bu masada su an ${r.holderName} calisiyor.` : "Masa baska garsonda acik.",
        "error",
      )
      return
    }
    setSelectedTableId(tableId)
    setScreen("table-detail")
  }
  const handleNewOrder = () => setScreen("order-menu")
  const handleOpenCart = () => setScreen("cart")
  const handleBackToTables = () => {
    releaseTableFocus()
    setSelectedTableId(null)
    setScreen("tables")
  }
  const handleBackToTableDetail = () => setScreen("table-detail")
  const handleBackToMenu = () => setScreen("order-menu")
  const handleMoveTable = () => setScreen("move-table")
  const handleTableMoved = () => {
    releaseTableFocus()
    setSelectedTableId(null)
    setScreen("tables")
  }
  const handleOrderSent = () => setScreen("table-detail")
  const handleViewAdisyonlar = () => setScreen("adisyonlar")
  const handleLogout = () => {
    staffLogout()
    setScreen("user-select")
    setSelectedTableId(null)
  }

  const content = (() => {
    switch (screen) {
      case "login":
        return <LoginScreen onLogin={handleLogin} />
      case "user-select":
        return <UserSelectScreen onSelect={handleUserSelect} />
      case "tables":
        return <TablesScreen onTableSelect={handleTableSelect} onLogout={handleLogout} />
      case "table-detail":
        if (!selectedTableId) return null
        return (
          <TableDetailScreen
            tableId={selectedTableId}
            onBack={handleBackToTables}
            onNewOrder={handleNewOrder}
            onMoveTable={handleMoveTable}
            onViewAdisyonlar={handleViewAdisyonlar}
          />
        )
      case "order-menu":
        if (!selectedTableId) return null
        return (
          <OrderMenuScreen
            tableId={selectedTableId}
            onBack={handleBackToTableDetail}
            onCartOpen={handleOpenCart}
          />
        )
      case "cart":
        if (!selectedTableId) return null
        return (
          <CartScreen
            tableId={selectedTableId}
            onBack={handleBackToMenu}
            onOrderSent={handleOrderSent}
          />
        )
      case "move-table":
        if (!selectedTableId) return null
        return (
          <MoveTableScreen
            fromTableId={selectedTableId}
            onBack={handleBackToTableDetail}
            onMoved={handleTableMoved}
          />
        )
      case "adisyonlar":
        if (!selectedTableId) return null
        return (
          <AdisyonlarScreen
            tableId={selectedTableId}
            onBack={handleBackToTableDetail}
            onCartOpen={handleOpenCart}
            onNewOrder={handleNewOrder}
            onMoveItem={(itemId, productName) => {
              setMoveItemPick({ itemId, productName })
              setScreen("move-order-item")
            }}
          />
        )
      case "move-order-item":
        if (!selectedTableId || !moveItemPick) return null
        return (
          <MoveOrderItemScreen
            fromTableId={selectedTableId}
            itemId={moveItemPick.itemId}
            productName={moveItemPick.productName}
            onBack={() => {
              setMoveItemPick(null)
              setScreen("adisyonlar")
            }}
          />
        )
      default:
        return <LoginScreen onLogin={handleLogin} />
    }
  })()

  return (
    <div className="mx-auto max-w-md min-h-dvh relative">
      {content}
    </div>
  )
}
