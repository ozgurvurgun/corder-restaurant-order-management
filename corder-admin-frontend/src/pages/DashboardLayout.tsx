import { useEffect } from "react"
import { Outlet, useNavigate, NavLink } from "react-router-dom"
import { usePlatformAuth } from "@/lib/auth-context"
import { LayoutDashboard, UtensilsCrossed, Crown, LogOut } from "lucide-react"

export function DashboardLayout() {
  const { isAuthenticated, user, logout } = usePlatformAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) navigate("/login", { replace: true })
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) return null

  const nav = [
    { to: "/dashboard", label: "Özet", icon: LayoutDashboard },
    { to: "/dashboard/bosses", label: "Patronlar (Boss)", icon: Crown },
    { to: "/dashboard/restaurants", label: "Restoranlar & Şubeler", icon: UtensilsCrossed },
  ]

  return (
    <div className="min-h-dvh flex bg-[#0f0f0f]">
      <aside className="w-60 flex-shrink-0 border-r border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a] flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#e63462] flex items-center justify-center text-white font-bold text-sm">
            C
          </div>
          <div>
            <span className="text-sm font-semibold text-white block leading-tight">Corder Cloud</span>
            <span className="text-[11px] text-zinc-400 block leading-tight">Platform Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/dashboard"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[#e63462]/15 text-[#e63462] font-medium"
                    : "text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-[#2a2a2a]">
          <div className="rounded-lg px-3 py-2 text-xs text-zinc-500">
            {user?.email}
          </div>
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Çıkış
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
