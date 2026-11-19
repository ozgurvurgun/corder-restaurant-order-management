import { useState } from "react"
import { BossStoreProvider, useBossStore } from "@/lib/boss-store"
import type { BossTabId } from "@/lib/types"
import { BossLogin } from "@/components/boss-login"
import { BranchSwitcherHeader } from "@/components/branch-switcher-header"
import { DashboardView } from "@/components/dashboard-view"
import { RolesPermissionsTab } from "@/components/roles-permissions-tab"
import { StaffUsersTab } from "@/components/staff-users-tab"
import { AnalyticsAuditTab } from "@/components/analytics-audit-tab"
import { OperationsCatalogTab } from "@/components/operations-catalog-tab"
import { SecurityFraudTab } from "@/components/security-fraud-tab"
import { CustomSelect } from "@/components/ui/custom-inputs"
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog"
import {
  AlertTriangle,
  Home,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Users,
  BarChart3,
  Utensils,
  Building2,
  LogOut,
} from "lucide-react"

const NAV_GROUPS: Array<{
  label: string
  items: Array<{
    id: BossTabId
    label: string
    mobileLabel: string
    icon: typeof Home
  }>
}> = [
  {
    label: "Genel",
    items: [
      { id: "dashboard", label: "Ana Sayfa", mobileLabel: "Özet", icon: Home },
    ],
  },
  {
    label: "Yönetim & Yetki",
    items: [
      { id: "permissions", label: "Rol & Yetkiler", mobileLabel: "Yetkiler", icon: ShieldCheck },
      { id: "staff", label: "Kullanıcılar", mobileLabel: "Ekip", icon: Users },
    ],
  },
  {
    label: "Operasyon & Güvenlik",
    items: [
      { id: "operations", label: "Canlı Operasyon", mobileLabel: "Operasyon", icon: Utensils },
      { id: "security", label: "Güvenlik & Kaçak Tespiti", mobileLabel: "Güvenlik", icon: ShieldAlert },
      { id: "analytics", label: "Raporlar & Denetim", mobileLabel: "Analiz", icon: BarChart3 },
    ],
  },
]

const FLAT_TABS = NAV_GROUPS.flatMap((g) => g.items)

function BossShell() {
  const {
    isAuthenticated,
    user,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    effectiveBranch,
    openCriticalHighAlertCount,
    toast,
    error,
    loading,
    refreshAll,
    logout,
  } = useBossStore()
  const [activeTab, setActiveTab] = useState<BossTabId>("dashboard")

  if (!isAuthenticated) {
    return <BossLogin />
  }

  return (
    <div className="h-dvh flex overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      {/* Desktop Left Sidebar matching Merchant Panel */}
      <aside className="hidden md:flex w-[240px] h-full flex-col border-r border-[#d1d1d6]/60 bg-[#f5f5f7]/80 backdrop-blur-2xl flex-shrink-0 select-none">
        <div className="px-5 pt-5 pb-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <img
              src="/corder-logo.png"
              alt="Corder Boss"
              className="w-8 h-8 rounded-lg object-cover shadow-sm flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-[13px] font-semibold text-[#1d1d1f] leading-tight truncate">
                {selectedBranchId === "ALL"
                  ? "Tüm Şubeler"
                  : effectiveBranch?.name || "Corder Boss"}
              </h1>
              <p className="text-[11px] text-[#86868b] leading-tight">
                Boss Yönetim Paneli
              </p>
            </div>
          </div>

          {branches.length > 1 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#d1d1d6]/80 bg-white px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#e63462] flex-shrink-0" />
              <CustomSelect
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-transparent text-[11px] font-semibold text-[#1d1d1f]"
              >
                <option value="ALL">Tüm Şubeler ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Şube: {b.name}
                  </option>
                ))}
              </CustomSelect>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-1 flex flex-col gap-3 overflow-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id
                  const Icon = item.icon
                  const showBadge =
                    item.id === "security" && openCriticalHighAlertCount > 0
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors w-full text-left ${
                        isActive
                          ? "bg-[#e63462]/10 text-[#e63462]"
                          : "text-[#1d1d1f] hover:bg-black/[0.04]"
                      }`}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] flex-shrink-0 ${
                          isActive ? "text-[#e63462]" : "text-[#86868b]"
                        }`}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {showBadge && (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white tabular-nums">
                          {openCriticalHighAlertCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-[#d1d1d6]/40 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1.5 border border-[#d1d1d6]/50">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#e63462]">
              <ShieldCheck className="w-3 h-3" />
              İşletme Sahibi (Boss)
            </span>
            <span className="text-[10px] text-[#86868b]">Tam Yetki</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#e63462]/15 flex items-center justify-center">
              <span className="text-[11px] font-semibold text-[#e63462]">
                {user?.name?.trim()?.charAt(0)?.toUpperCase() ?? "B"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#1d1d1f] leading-tight truncate">
                {user?.name || "Boss"}
              </p>
              <p className="text-[10px] text-[#86868b] leading-tight truncate">
                {user?.email || ""}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
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
        <BranchSwitcherHeader activeTab={activeTab} />

        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-14 left-1/2 z-50 -translate-x-1/2 px-4 w-full max-w-sm">
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl px-4 py-2.5 text-center text-[13px] font-medium text-white shadow-lg ${
                toast.type === "error" ? "bg-red-600" : "bg-[#1d1d1f]"
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto w-full p-3 sm:p-4">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                <span className="font-medium leading-snug">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={loading}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                Tekrar Dene
              </button>
            </div>
          )}

          {activeTab === "dashboard" && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === "permissions" && <RolesPermissionsTab />}
          {activeTab === "staff" && <StaffUsersTab />}
          {activeTab === "analytics" && <AnalyticsAuditTab />}
          {activeTab === "operations" && <OperationsCatalogTab />}
          {activeTab === "security" && <SecurityFraudTab />}
        </main>

        {/* Mobile Bottom Tab Navigation Bar */}
        <nav
          aria-label="Alt Gezinme Menüsü"
          className="md:hidden flex-shrink-0 border-t border-[#d1d1d6]/70 bg-white/95 backdrop-blur-2xl safe-bottom"
        >
          <div className="mx-auto flex h-[58px] max-w-xl items-center justify-around px-1">
            {FLAT_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const showBadge =
                tab.id === "security" && openCriticalHighAlertCount > 0
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
                    isActive ? "text-[#e63462]" : "text-[#86868b] hover:text-[#1d1d1f]"
                  }`}
                >
                  <div className="relative">
                    <Icon className="h-4 w-4" strokeWidth={isActive ? 2.2 : 1.8} />
                    {showBadge && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white tabular-nums">
                        {openCriticalHighAlertCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium tracking-tight">
                    {tab.mobileLabel}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ConfirmDialogProvider>
      <BossStoreProvider>
        <BossShell />
      </BossStoreProvider>
    </ConfirmDialogProvider>
  )
}
