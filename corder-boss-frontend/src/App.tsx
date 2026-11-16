import { useState } from "react"
import { BossStoreProvider, useBossStore } from "@/lib/boss-store"
import type { BossTabId } from "@/lib/types"
import { BossLogin } from "@/components/boss-login"
import { BranchSwitcherHeader } from "@/components/branch-switcher-header"
import { DashboardTab } from "@/components/dashboard-tab"
import { RolesPermissionsTab } from "@/components/roles-permissions-tab"
import { StaffUsersTab } from "@/components/staff-users-tab"
import { AnalyticsAuditTab } from "@/components/analytics-audit-tab"
import { OperationsCatalogTab } from "@/components/operations-catalog-tab"
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  BarChart3,
  Utensils,
} from "lucide-react"

const NAV_TABS: Array<{
  id: BossTabId
  label: string
  icon: typeof LayoutDashboard
}> = [
  { id: "dashboard", label: "Özet", icon: LayoutDashboard },
  { id: "permissions", label: "Yetkiler", icon: ShieldCheck },
  { id: "staff", label: "Ekip", icon: Users },
  { id: "analytics", label: "Analiz", icon: BarChart3 },
  { id: "operations", label: "Operasyon", icon: Utensils },
]

function BossShell() {
  const { isAuthenticated, toast } = useBossStore()
  const [activeTab, setActiveTab] = useState<BossTabId>("dashboard")

  if (!isAuthenticated) {
    return <BossLogin />
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f5f5f7] text-[#1d1d1f]">
      <BranchSwitcherHeader />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 px-4 w-full max-w-sm">
          <div
            className={`rounded-2xl px-4 py-3 text-center text-[13px] font-semibold text-white shadow-xl ${
              toast.type === "error" ? "bg-red-600" : "bg-[#1d1d1f]"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-24">
        {activeTab === "dashboard" && <DashboardTab onNavigate={setActiveTab} />}
        {activeTab === "permissions" && <RolesPermissionsTab />}
        {activeTab === "staff" && <StaffUsersTab />}
        {activeTab === "analytics" && <AnalyticsAuditTab />}
        {activeTab === "operations" && <OperationsCatalogTab />}
      </main>

      {/* Mobile-First Bottom Tab Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-[#d1d1d6]/70 bg-white/90 backdrop-blur-2xl safe-bottom">
        <div className="mx-auto flex h-[62px] max-w-xl items-center justify-around px-2">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
                  isActive ? "text-[#e63462]" : "text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span className="text-[10px] font-semibold tracking-tight">
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <BossStoreProvider>
      <BossShell />
    </BossStoreProvider>
  )
}

