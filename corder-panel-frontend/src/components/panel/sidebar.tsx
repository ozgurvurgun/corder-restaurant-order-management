import {
  LayoutGrid, ListOrdered, Package, Users, BarChart3, Settings, Utensils,
  Wallet, Warehouse, Wrench, Home, LogOut, Megaphone, ShoppingBag,
} from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelI18n } from "@/lib/panel-i18n"
import { usePanelAuth } from "@/lib/panel-auth"

export type PanelScreen = "dashboard" | "tables" | "quick-sale" | "live-orders" | "products" | "users" | "reports" | "settings" | "kasa" | "stock" | "teknik" | "campaigns"

interface SidebarProps {
  activeScreen: PanelScreen
  onNavigate: (screen: PanelScreen) => void
}

export default function PanelSidebar({ activeScreen, onNavigate }: SidebarProps) {
  const { currentUser, settings, notifications } = usePanelStore()
  const { locale, t } = usePanelI18n()
  const { currentBusiness, logout } = usePanelAuth()
  const unreadCount = notifications.filter((n) => !n.read).length

  const NAV_GROUPS = [
    {
      label: locale === "tr" ? "Genel" : "General",
      items: [
        { id: "dashboard" as PanelScreen, label: locale === "tr" ? "Ana Sayfa" : "Dashboard", icon: Home },
      ],
    },
    {
      label: locale === "tr" ? "Operasyon" : "Operations",
      items: [
        { id: "tables" as PanelScreen, label: t("tables"), icon: LayoutGrid },
        { id: "quick-sale" as PanelScreen, label: locale === "tr" ? "Hizli Satis" : "Quick Sale", icon: ShoppingBag },
        { id: "live-orders" as PanelScreen, label: t("completedOrders"), icon: ListOrdered },
        { id: "kasa" as PanelScreen, label: t("cashRegister"), icon: Wallet },
      ],
    },
    {
      label: locale === "tr" ? "Yonetim" : "Management",
      items: [
        { id: "products" as PanelScreen, label: t("products"), icon: Package },
        { id: "campaigns" as PanelScreen, label: locale === "tr" ? "Kampanyalar" : "Campaigns", icon: Megaphone },
        { id: "stock" as PanelScreen, label: t("stock"), icon: Warehouse },
        { id: "users" as PanelScreen, label: t("users"), icon: Users },
      ],
    },
    {
      label: locale === "tr" ? "Analiz & Sistem" : "Analytics & System",
      items: [
        { id: "reports" as PanelScreen, label: t("reports"), icon: BarChart3 },
        { id: "teknik" as PanelScreen, label: locale === "tr" ? "Teknik" : "Technical", icon: Wrench },
        { id: "settings" as PanelScreen, label: t("settings"), icon: Settings },
      ],
    },
  ]

  return (
    <aside className="w-[240px] h-full flex flex-col border-r border-[#d1d1d6]/60 dark:border-[#38383a] bg-[#f5f5f7]/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl flex-shrink-0 select-none">
      {/* App header */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#e63462] flex items-center justify-center">
          <Utensils className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white leading-tight">{currentBusiness?.name || settings.name || "Corder"}</h1>
          <p className="text-[11px] text-[#86868b] leading-tight">
            {locale === "tr" ? "Yonetim Paneli" : "Management Panel"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1 flex flex-col gap-3 overflow-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">{group.label}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
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
                    <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-[#e63462]" : "text-[#86868b]"}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.id === "teknik" && unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#e63462] text-white text-[10px] font-bold flex items-center justify-center">{unreadCount}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info & Logout */}
      <div className="px-4 py-3 border-t border-[#d1d1d6]/40 dark:border-[#38383a]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#e63462]/15 flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#e63462]">
              {currentUser?.name?.trim()?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white leading-tight capitalize truncate">
              {currentUser?.name?.trim() || (locale === "tr" ? "Yonetici" : "Admin")}
            </p>
            <p className="text-[10px] text-[#86868b] leading-tight capitalize">{currentUser?.role}</p>
          </div>
          <button
            onClick={logout}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
            title={locale === "tr" ? "Cikis Yap" : "Logout"}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
