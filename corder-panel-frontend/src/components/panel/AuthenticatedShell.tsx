import { useCallback, useEffect, useState } from "react"
import { PanelProvider } from "@/lib/panel-store"
import { I18nProvider } from "@/lib/panel-i18n"
import { usePanelAuth } from "@/lib/panel-auth"
import type { PanelViewId } from "@/lib/panel-types"
import {
  isEditableElement,
  resolveAltViewShortcut,
} from "@/lib/shortcuts/shortcut-catalog.policy"
import { PanelToastProvider } from "@/components/panel/panel-toast"
import { PanelFontSizeProvider } from "@/components/panel/panel-font-size-provider"
import PanelSidebar from "@/components/panel/sidebar"
import { HeaderBar } from "@/components/panel/header-bar"
import { ShortcutsGuideModal } from "@/components/panel/shortcuts/shortcuts-guide-modal"
import { CommandPaletteModal } from "@/components/panel/shortcuts/command-palette-modal"
import DashboardView from "@/components/panel/dashboard-view"
import TablesView from "@/components/panel/tables-view"
import QuickSaleView from "@/components/panel/quick-sale-view"
import CompletedOrdersView from "@/components/panel/live-orders-view"
import ProductManagement from "@/components/panel/product-management"
import UserManagement from "@/components/panel/user-management"
import ReportsView from "@/components/panel/reports-view"
import SettingsView from "@/components/panel/settings-view"
import BillingView, { prefetchBillingInfo } from "@/components/panel/billing-view"
import CashRegisterView from "@/components/panel/cash-register-view"
import StockView from "@/components/panel/stock-view"
import TechnicalView from "@/components/panel/technical-view"
import CampaignManagement from "@/components/panel/campaign-management"
import { SystemUpdateModal } from "@/components/panel/SystemUpdateModal"

function isViewPermitted(
  view: PanelViewId,
  isBoss: boolean,
  hasPermission: (...keys: string[]) => boolean,
): boolean {
  if (isBoss || view === "dashboard") return true
  switch (view) {
    case "tables":
      return hasPermission("order.view", "order.create", "billing.close_check")
    case "quick-sale":
      return hasPermission("order.quick_sale", "billing.close_check")
    case "live-orders":
      return hasPermission(
        "reports.view_operational",
        "billing.close_check",
        "billing.edit_completed_order",
      )
    case "cash-register":
      return hasPermission(
        "cash.view",
        "cash.shift_open",
        "cash.shift_close",
        "ledger.view",
      )
    case "products":
      return hasPermission(
        "catalog.view",
        "catalog.manage_products",
        "catalog.change_price",
        "catalog.toggle_stock",
      )
    case "campaigns":
      return hasPermission("catalog.manage_campaigns")
    case "stock":
      return hasPermission(
        "inventory.view",
        "inventory.manage_materials",
        "inventory.stock_movement",
        "inventory.count_adjust",
      )
    case "users":
      return hasPermission("staff.view", "staff.manage", "roles.manage")
    case "reports":
      return hasPermission(
        "reports.view_operational",
        "reports.view_financial",
        "reports.view_staff_performance",
      )
    case "technical":
      return hasPermission("system.manage_printers", "reports.view_audit_logs")
    case "billing":
      return hasPermission("system.manage_settings", "reports.view_financial")
    case "settings":
      return hasPermission("system.manage_settings", "system.manage_tables")
  }
}

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
    case "billing":
      return <BillingView />
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [shortcutsGuideOpen, setShortcutsGuideOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const { token, currentBusiness, isBoss, hasPermission } = usePanelAuth()

  const checkViewAllowed = useCallback(
    (view: PanelViewId) => isViewPermitted(view, isBoss, hasPermission),
    [isBoss, hasPermission],
  )

  useEffect(() => {
    prefetchBillingInfo(token, currentBusiness?.id)
  }, [token, currentBusiness?.id])

  useEffect(() => {
    if (!checkViewAllowed(activeView)) {
      setActiveView("dashboard")
    }
  }, [activeView, checkViewAllowed])

  const handleNavigate = useCallback(
    (view: PanelViewId) => {
      if (!checkViewAllowed(view)) return
      setActiveView(view)
      setMobileMenuOpen(false)
    },
    [checkViewAllowed],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setShortcutsGuideOpen(false)
        setCommandPaletteOpen((prev) => !prev)
        return
      }
      const altTargetView = resolveAltViewShortcut(e)
      if (altTargetView) {
        if (checkViewAllowed(altTargetView)) {
          e.preventDefault()
          setCommandPaletteOpen(false)
          setShortcutsGuideOpen(false)
          handleNavigate(altTargetView)
        }
        return
      }
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key === "?" &&
        !isEditableElement(e.target)
      ) {
        e.preventDefault()
        setCommandPaletteOpen(false)
        setShortcutsGuideOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [checkViewAllowed, handleNavigate])

  return (
    <PanelProvider>
      <I18nProvider>
        <PanelToastProvider>
          <PanelFontSizeProvider>
            <div className="h-dvh w-full overflow-hidden flex bg-[#f5f5f7] dark:bg-[#000000]">
              <PanelSidebar
                activeScreen={activeView}
                onNavigate={handleNavigate}
                mobileOpen={mobileMenuOpen}
                onCloseMobile={() => setMobileMenuOpen(false)}
                onOpenShortcutsGuide={() => setShortcutsGuideOpen(true)}
              />
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <HeaderBar
                  activeView={activeView}
                  onOpenMobileMenu={() => setMobileMenuOpen(true)}
                  onOpenShortcutsGuide={() => setShortcutsGuideOpen(true)}
                  onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                />
                <main className="flex-1 overflow-hidden min-w-0">
                  {renderScreen(activeView, handleNavigate)}
                </main>
              </div>
              <CommandPaletteModal
                open={commandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                onNavigate={handleNavigate}
                isViewAllowed={checkViewAllowed}
                onOpenShortcutsGuide={() => setShortcutsGuideOpen(true)}
              />
              <ShortcutsGuideModal
                open={shortcutsGuideOpen}
                onClose={() => setShortcutsGuideOpen(false)}
                onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              />
              <SystemUpdateModal />
            </div>
          </PanelFontSizeProvider>
        </PanelToastProvider>
      </I18nProvider>
    </PanelProvider>
  )
}
