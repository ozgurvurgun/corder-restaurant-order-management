import { useState } from "react"
import { PanelProvider } from "@/lib/panel-store"
import { I18nProvider } from "@/lib/panel-i18n"
import type { PanelViewId } from "@/lib/panel-types"
import { PanelToastProvider } from "@/components/panel/panel-toast"
import { PanelFontSizeProvider } from "@/components/panel/panel-font-size-provider"
import PanelSidebar from "@/components/panel/sidebar"
import { HeaderBar } from "@/components/panel/header-bar"
import DashboardView from "@/components/panel/dashboard-view"
import TablesView from "@/components/panel/tables-view"
import QuickSaleView from "@/components/panel/quick-sale-view"
import CompletedOrdersView from "@/components/panel/live-orders-view"
import ProductManagement from "@/components/panel/product-management"
import UserManagement from "@/components/panel/user-management"
import ReportsView from "@/components/panel/reports-view"
import SettingsView from "@/components/panel/settings-view"
import CashRegisterView from "@/components/panel/cash-register-view"
import StockView from "@/components/panel/stock-view"
import TechnicalView from "@/components/panel/technical-view"
import CampaignManagement from "@/components/panel/campaign-management"

function renderScreen(
  activeView: PanelViewId,
  onNavigate: (view: PanelViewId) => void,
) {
  switch (activeView) {
    case "dashboard":
      return <DashboardView onNavigate={onNavigate} />
    case "tables":
      return <TablesView />
    case "quick-sale":
      return <QuickSaleView />
    case "live-orders":
      return <CompletedOrdersView />
    case "products":
      return <ProductManagement />
    case "users":
      return <UserManagement />
    case "reports":
      return <ReportsView />
    case "settings":
      return <SettingsView />
    case "cash-register":
      return <CashRegisterView />
    case "stock":
      return <StockView />
    case "technical":
      return <TechnicalView />
    case "campaigns":
      return <CampaignManagement />
  }
}

export function AuthenticatedShell() {
  const [activeView, setActiveView] = useState<PanelViewId>("dashboard")

  return (
    <PanelProvider>
      <I18nProvider>
        <PanelToastProvider>
          <PanelFontSizeProvider>
            <div className="h-dvh w-full overflow-hidden flex bg-[#f5f5f7] dark:bg-[#000000]">
              <PanelSidebar
                activeScreen={activeView}
                onNavigate={setActiveView}
              />
              <div className="flex-1 flex flex-col overflow-hidden">
                <HeaderBar />
                <main className="flex-1 overflow-hidden">
                  {renderScreen(activeView, setActiveView)}
                </main>
              </div>
            </div>
          </PanelFontSizeProvider>
        </PanelToastProvider>
      </I18nProvider>
    </PanelProvider>
  )
}
