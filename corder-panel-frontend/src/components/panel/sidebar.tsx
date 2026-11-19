import {
  LayoutGrid,
  ListOrdered,
  Package,
  Users,
  BarChart3,
  Settings,
  Wallet,
  Warehouse,
  Wrench,
  Home,
  LogOut,
  Megaphone,
  ShoppingBag,
  Building2,
  ShieldCheck,
  CreditCard,
} from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelI18n } from "@/lib/panel-i18n"
import { usePanelAuth } from "@/lib/panel-auth"
import type { PanelViewId } from "@/lib/panel-types"
import { CustomSelect } from "@/components/ui/custom-inputs"

export type PanelScreen = PanelViewId

interface SidebarProps {
  activeScreen: PanelViewId
  onNavigate: (screen: PanelViewId) => void
}

export default function PanelSidebar({
  activeScreen,
  onNavigate,
}: SidebarProps) {
  const { currentUser, settings, notifications } = usePanelStore()
  const { locale, t } = usePanelI18n()
  const {
    currentBusiness,
    businesses,
    switchBusiness,
    sessionUser,
    isBoss,
    hasPermission,
    limits,
    logout,
  } = usePanelAuth()
  const unreadCount = notifications.filter((n) => !n.read).length

  const NAV_GROUPS = [
    {
      label: locale === "tr" ? "Genel" : "General",
      items: [
        {
          id: "dashboard" as PanelViewId,
          label: locale === "tr" ? "Ana Sayfa" : "Dashboard",
          icon: Home,
          visible: true,
        },
      ],
    },
    {
      label: locale === "tr" ? "Operasyon" : "Operations",
      items: [
        {
          id: "tables" as PanelViewId,
          label: t("tables"),
          icon: LayoutGrid,
          visible: hasPermission("order.view", "order.create", "billing.close_check"),
        },
        {
          id: "quick-sale" as PanelViewId,
          label: locale === "tr" ? "Hızlı Satış" : "Quick Sale",
          icon: ShoppingBag,
          visible: hasPermission("order.quick_sale", "billing.close_check"),
        },
        {
          id: "live-orders" as PanelViewId,
          label: t("completedOrders"),
          icon: ListOrdered,
          visible: hasPermission(
            "reports.view_operational",
            "billing.close_check",
            "billing.edit_completed_order"
          ),
        },
        {
          id: "cash-register" as PanelViewId,
          label: t("cashRegister"),
          icon: Wallet,
          visible: hasPermission(
            "cash.view",
            "cash.shift_open",
            "cash.shift_close",
            "ledger.view"
          ),
        },
      ],
    },
    {
      label: locale === "tr" ? "Yönetim" : "Management",
      items: [
        {
          id: "products" as PanelViewId,
          label: t("products"),
          icon: Package,
          visible: hasPermission(
            "catalog.view",
            "catalog.manage_products",
            "catalog.change_price",
            "catalog.toggle_stock"
          ),
        },
        {
          id: "campaigns" as PanelViewId,
          label: locale === "tr" ? "Kampanyalar" : "Campaigns",
          icon: Megaphone,
          visible: hasPermission("catalog.manage_campaigns"),
        },
        {
          id: "stock" as PanelViewId,
          label: t("stock"),
          icon: Warehouse,
          visible: hasPermission(
            "inventory.view",
            "inventory.manage_materials",
            "inventory.stock_movement",
            "inventory.count_adjust"
          ),
        },
        {
          id: "users" as PanelViewId,
          label: t("users"),
          icon: Users,
          visible: hasPermission("staff.view", "staff.manage", "roles.manage"),
        },
      ],
    },
    {
      label: locale === "tr" ? "Analiz & Sistem" : "Analytics & System",
      items: [
        {
          id: "reports" as PanelViewId,
          label: t("reports"),
          icon: BarChart3,
          visible: hasPermission(
            "reports.view_operational",
            "reports.view_financial",
            "reports.view_staff_performance"
          ),
        },
        {
          id: "technical" as PanelViewId,
          label: t("technical"),
          icon: Wrench,
          visible: hasPermission("system.manage_printers", "reports.view_audit_logs"),
        },
        {
          id: "billing" as PanelViewId,
          label: locale === "tr" ? "Abonelik & Ödeme" : "Subscription & Payment",
          icon: CreditCard,
          visible: isBoss || hasPermission("system.manage_settings", "reports.view_financial"),
        },
        {
          id: "settings" as PanelViewId,
          label: t("settings"),
          icon: Settings,
          visible: hasPermission("system.manage_settings", "system.manage_tables"),
        },
      ],
    },
  ]

  return (
    <aside className="w-[240px] h-full flex flex-col border-r border-[#d1d1d6]/60 dark:border-[#38383a] bg-[#f5f5f7]/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl flex-shrink-0 select-none">
      {/* App header */}
      <div className="px-5 pt-5 pb-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <img
            src="/corder-logo.png"
            alt="Corder"
            className="w-8 h-8 rounded-lg object-cover shadow-sm flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white leading-tight truncate">
              {currentBusiness?.name || settings.name || "Corder"}
            </h1>
            <p className="text-[11px] text-[#86868b] leading-tight">
              {locale === "tr" ? "Merchant Paneli" : "Merchant Panel"}
            </p>
          </div>
        </div>

        {/* Multi-Branch Switcher for Boss */}
        {businesses.length > 1 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[#d1d1d6]/80 bg-white px-2.5 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#e63462] flex-shrink-0" />
            <CustomSelect
              value={currentBusiness?.id ?? ""}
              onChange={(e) => void switchBusiness(e.target.value).catch(() => {})}
              className="w-full bg-transparent text-[11px] font-semibold text-[#1d1d1f]"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  Şube: {b.name}
                </option>
              ))}
            </CustomSelect>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1 flex flex-col gap-3 overflow-auto">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((i) => i.visible)
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label}>
              <p className="px-2.5 text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  const isActive = activeScreen === item.id
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors w-full text-left ${
                        isActive
                          ? "bg-[#e63462]/10 text-[#e63462]"
                          : "text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] flex-shrink-0 ${
                          isActive ? "text-[#e63462]" : "text-[#86868b]"
                        }`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.id === "technical" && unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#e63462] text-white text-[10px] font-bold flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User info, Role & Discount Limit Badge & Logout */}
      <div className="px-4 py-3 border-t border-[#d1d1d6]/40 dark:border-[#38383a] space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1.5 border border-[#d1d1d6]/50">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#e63462]">
            <ShieldCheck className="w-3 h-3" />
            {sessionUser?.roleLabel || (isBoss ? "İşletme Sahibi (Boss)" : currentUser?.role)}
          </span>
          <span className="text-[10px] text-[#86868b]">
            İskonto: %{limits.maxDiscountPercent}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#e63462]/15 flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#e63462]">
              {(sessionUser?.name || currentUser?.name)?.trim()?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white leading-tight truncate">
              {sessionUser?.name || currentUser?.name || "Kullanıcı"}
            </p>
            <p className="text-[10px] text-[#86868b] leading-tight truncate">
              {sessionUser?.email || ""}
            </p>
          </div>
          <button
            onClick={logout}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
            title={locale === "tr" ? "Çıkış Yap" : "Logout"}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
