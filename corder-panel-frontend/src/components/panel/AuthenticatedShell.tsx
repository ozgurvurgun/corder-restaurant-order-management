import { useState } from "react"
import { PanelProvider } from "@/lib/panel-store"
import { I18nProvider } from "@/lib/panel-i18n"
import { PanelToastProvider } from "@/components/panel/panel-toast"
import { PanelFontSizeProvider } from "@/components/panel/panel-font-size-provider"
import PanelSidebar, { type PanelScreen } from "@/components/panel/sidebar"
import { HeaderBar } from "@/components/panel/header-bar"
import DashboardView from "@/components/panel/dashboard-view"
import TablesView from "@/components/panel/tables-view"
import QuickSaleView from "@/components/panel/quick-sale-view"
import CompletedOrdersView from "@/components/panel/live-orders-view"
import ProductManagement from "@/components/panel/product-management"
import UserManagement from "@/components/panel/user-management"
import ReportsView from "@/components/panel/reports-view"
import SettingsView from "@/components/panel/settings-view"
import KasaView from "@/components/panel/kasa-view"
import StockView from "@/components/panel/stock-view"
import TeknikView from "@/components/panel/teknik-view"
import CampaignManagement from "@/components/panel/campaign-management"

function renderScreen(activeScreen: PanelScreen, onNavigate: (s: PanelScreen) => void) {
  switch (activeScreen) {
    case "dashboard": return <DashboardView onNavigate={onNavigate} />
    case "tables": return <TablesView />
    case "quick-sale": return <QuickSaleView />
    case "live-orders": return <CompletedOrdersView />
    case "products": return <ProductManagement />
    case "users": return <UserManagement />
    case "reports": return <ReportsView />
    case "settings": return <SettingsView />
    case "kasa": return <KasaView />
    case "stock": return <StockView />
    case "teknik": return <TeknikView />
    case "campaigns": return <CampaignManagement />
  }
}

export function AuthenticatedShell() {
  const [activeScreen, setActiveScreen] = useState<PanelScreen>("dashboard")

  return (
    <PanelProvider>
      <I18nProvider>
        <PanelToastProvider>
          <PanelFontSizeProvider>
            <div className="h-dvh w-full overflow-hidden flex bg-[#f5f5f7] dark:bg-[#000000]">
              <PanelSidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
              <div className="flex-1 flex flex-col overflow-hidden">
                <HeaderBar />
                <main className="flex-1 overflow-hidden">
                  {renderScreen(activeScreen, setActiveScreen)}
                </main>
              </div>
            </div>
          </PanelFontSizeProvider>
        </PanelToastProvider>
      </I18nProvider>
    </PanelProvider>
  )
}
