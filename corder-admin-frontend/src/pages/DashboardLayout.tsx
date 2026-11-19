import { useEffect } from "react"
import { Outlet, useNavigate, NavLink, useLocation, Link } from "react-router-dom"
import { usePlatformAuth } from "@/lib/auth-context"
import { useAdminStore } from "@/lib/store"
import {
  Home,
  UtensilsCrossed,
  Crown,
  CreditCard,
  Bell,
  LogOut,
  ShieldCheck,
  RefreshCw,
  Plus,
} from "lucide-react"

const NAV_GROUPS = [
  {
    label: "Genel",
    items: [
      { to: "/dashboard", label: "Ana Sayfa", mobileLabel: "Özet", icon: Home, end: true },
      { to: "/dashboard/notifications", label: "Bildirim Merkezi", mobileLabel: "Bildirim", icon: Bell, end: false },
    ],
  },
  {
    label: "Mekan & Franchise",
    items: [
      { to: "/dashboard/bosses", label: "Marka & Şube Bossları", mobileLabel: "Bosslar", icon: Crown, end: false },
      { to: "/dashboard/restaurants", label: "Restoranlar & Şubeler", mobileLabel: "Restoranlar", icon: UtensilsCrossed, end: false },
    ],
  },
  {
    label: "Finans & Tahsilat",
    items: [
      { to: "/dashboard/billing", label: "Ücretler & Tahsilat", mobileLabel: "Tahsilat", icon: CreditCard, end: false },
    ],
  },
]

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items)

function resolvePageTitle(pathname: string): string {
  if (pathname === "/dashboard/bosses") return "Marka & Şube Boss Hesapları"
  if (pathname.startsWith("/dashboard/notifications")) return "Anlık & Zamanlanmış Bildirim Merkezi"
  if (pathname === "/dashboard/restaurants/new") return "Yeni Restoran / Franchise Şubesi"
  if (pathname.startsWith("/dashboard/restaurants/")) return "Restoran & Şube Detayı"
  if (pathname.startsWith("/dashboard/restaurants")) return "Restoranlar & Franchise Ağı"
  if (pathname.startsWith("/dashboard/billing")) return "Abonelik & Dönemsel Tahsilat Yönetimi"
  return "Platform Özeti"
}

export function DashboardLayout() {
  const { isAuthenticated, user, logout } = usePlatformAuth()
  const { loadRestaurants, loadAllBosses, restaurantsLoading, bossesLoading } = useAdminStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isAuthenticated) navigate("/login", { replace: true })
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) return null

  const isRefreshing = restaurantsLoading || bossesLoading
  const pageTitle = resolvePageTitle(location.pathname)

  const handleRefresh = () => {
    void loadRestaurants()
    void loadAllBosses()
  }

  return (
    <div className="h-dvh flex overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      {/* Desktop Left Sidebar matching Merchant & Boss Panel */}
      <aside className="hidden md:flex w-[240px] h-full flex-col border-r border-[#d1d1d6]/60 bg-[#f5f5f7]/80 backdrop-blur-2xl flex-shrink-0 select-none">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
          <img
            src="/corder-logo.png"
            alt="Corder Admin"
            className="w-8 h-8 rounded-lg object-cover shadow-sm flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] font-semibold text-[#1d1d1f] leading-tight truncate">
              Corder Admin
            </h1>
            <p className="text-[11px] text-[#86868b] leading-tight">
              Platform Yönetim Merkezi
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 flex flex-col gap-3 overflow-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors w-full text-left ${
                        isActive
                          ? "bg-[#e63462]/10 text-[#e63462]"
                          : "text-[#1d1d1f] hover:bg-black/[0.04]"
                      }`
                    }
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-[#d1d1d6]/40 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1.5 border border-[#d1d1d6]/50">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#e63462]">
              <ShieldCheck className="w-3 h-3" />
              Platform Yöneticisi
            </span>
            <span className="text-[10px] text-[#86868b]">Root</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#e63462]/15 flex items-center justify-center">
              <span className="text-[11px] font-semibold text-[#e63462]">
                {user?.email?.trim()?.charAt(0)?.toUpperCase() ?? "A"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#1d1d1f] leading-tight truncate">
                Platform Admin
              </p>
              <p className="text-[10px] text-[#86868b] leading-tight truncate">
                {user?.email || ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
              title="Çıkış Yap"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top White HeaderBar matching Merchant & Boss Panel */}
        <header className="h-[52px] flex items-center justify-between gap-4 px-3 sm:px-4 border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-[16px] font-semibold text-[#1d1d1f] truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/restaurants/new"
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#e63462] hover:bg-[#d42d56] text-white text-[12px] font-semibold transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Yeni Şube Ekle
            </Link>

            <button
              type="button"
              onClick={handleRefresh}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]/70 text-[#636366] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              title="Verileri Yenile"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-[#e63462]" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]/70 text-[#86868b] hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Çıkış Yap"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-3 sm:p-4">
          <Outlet />
        </main>

        {/* Mobile Bottom Tab Navigation Bar */}
        <nav
          aria-label="Alt Gezinme Menüsü"
          className="md:hidden flex-shrink-0 border-t border-[#d1d1d6]/70 bg-white/95 backdrop-blur-2xl safe-bottom"
        >
          <div className="mx-auto flex h-[58px] max-w-xl items-center justify-around px-2">
            {FLAT_NAV.map(({ to, mobileLabel, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
                    isActive ? "text-[#e63462]" : "text-[#86868b] hover:text-[#1d1d1f]"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-medium tracking-tight">
                  {mobileLabel}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
