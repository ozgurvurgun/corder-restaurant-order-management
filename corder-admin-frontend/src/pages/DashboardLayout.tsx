import { useEffect } from "react"
import { Outlet, useNavigate, NavLink } from "react-router-dom"
import { usePlatformAuth } from "@/lib/auth-context"
import { LayoutDashboard, UtensilsCrossed, LogOut } from "lucide-react"

export function DashboardLayout() {
  const { isAuthenticated, user, logout } = usePlatformAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) navigate("/login", { replace: true })
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) return null

  const nav = [
    { to: "/dashboard", label: "Özet", icon: LayoutDashboard },
    { to: "/dashboard/restaurants", label: "Restoranlar", icon: UtensilsCrossed },
  ]

  return (
    <div className="min-h-dvh flex bg-[#0f0f0f]">
      <aside className="w-56 flex-shrink-0 border-r border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a]">
          <span className="text-sm font-medium text-white">Corder Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/dashboard"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
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
