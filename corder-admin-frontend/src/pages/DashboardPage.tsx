import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import { formatMoney, sumMoneyMajor } from "@/lib/money"
import {
  UtensilsCrossed,
  Crown,
  Building2,
  CreditCard,
  Ban,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plus,
  Pencil,
} from "lucide-react"

export function DashboardPage() {
  const {
    restaurants,
    restaurantsLoading,
    restaurantsError,
    loadRestaurants,
    allBosses,
    loadAllBosses,
  } = useAdminStore()

  useEffect(() => {
    void loadRestaurants()
    void loadAllBosses()
  }, [loadRestaurants, loadAllBosses])

  const billableRestaurants = restaurants.filter((r) => r.status !== "inactive")
  const activeCount = restaurants.filter(
    (r) => r.status === "active" && !r.isAccessSuspended && r.billingStatus !== "suspended"
  ).length
  const totalMrr = sumMoneyMajor(billableRestaurants.map((r) => r.monthlyFee ?? 0))
  const suspendedCount = restaurants.filter(
    (r) => r.isAccessSuspended || r.billingStatus === "suspended"
  ).length

  if (restaurantsError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
        <p className="font-medium">{restaurantsError}</p>
        <button
          type="button"
          onClick={() => {
            void loadRestaurants()
            void loadAllBosses()
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-red-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tekrar Dene
        </button>
      </div>
    )
  }

  const kpiCards = [
    {
      label: "Toplam Şube / Restoran",
      value: String(restaurants.length),
      sub: `${billableRestaurants.length} faturalandırılan mekan`,
      icon: UtensilsCrossed,
      color: "#007aff",
      to: "/dashboard/restaurants",
    },
    {
      label: "Aktif & Erişimi Açık Şube",
      value: String(activeCount),
      sub: suspendedCount > 0 ? `${suspendedCount} mekan askıda` : "Tüm şubeler açık",
      icon: Building2,
      color: "#34c759",
      to: "/dashboard/restaurants",
    },
    {
      label: "Marka & Şube Bossları",
      value: String(allBosses.length),
      sub: "Kayıtlı yönetici hesabı",
      icon: Crown,
      color: "#e63462",
      to: "/dashboard/bosses",
    },
    {
      label: "Aylık Tahsilat Hedefi",
      value: formatMoney(totalMrr),
      sub: "Aylık abonelik toplamı",
      icon: CreditCard,
      color: "#ff9500",
      to: "/dashboard/billing",
    },
  ]

  return (
    <div className="space-y-5">
      {/* Top 4 KPI Cards matching Merchant & Boss Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.label}
              to={stat.to}
              className="bg-white rounded-2xl p-4 border border-[#e5e5ea] hover:border-[#d1d1d6] transition-all block"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <Icon
                    className="w-[18px] h-[18px]"
                    style={{ color: stat.color }}
                  />
                </div>
                <span className="text-[11px] font-medium text-[#86868b]">
                  {stat.sub}
                </span>
              </div>
              <p className="text-[22px] font-bold text-[#1d1d1f] leading-tight tabular-nums">
                {stat.value}
              </p>
              <p className="text-[12px] text-[#86868b] mt-0.5">
                {stat.label}
              </p>
            </Link>
          )
        })}
      </div>

      {/* Recent Restaurants & Quick Actions */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white overflow-hidden">
        <div className="p-4 border-b border-[#f0f0f0] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
              Son Şubeler &amp; Restoranlar
            </h2>
            <p className="text-[12px] text-[#86868b]">
              Restoran/Franchise şubeleri, Boss atamaları ve aylık abonelik tahsilat durumu
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/dashboard/billing"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[12px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed]"
            >
              <CreditCard className="h-3.5 w-3.5 text-[#e63462]" />
              Tahsilat &amp; Ücretler
            </Link>
            <Link
              to="/dashboard/bosses"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e63462]/30 bg-[#fef3f5] px-3.5 text-[12px] font-semibold text-[#e63462] hover:bg-[#e63462]/15"
            >
              <Crown className="h-3.5 w-3.5" />
              Boss Yönetimi
            </Link>
            <Link
              to="/dashboard/restaurants/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#e63462] px-3.5 text-[12px] font-semibold text-white hover:bg-[#d42d56]"
            >
              <Plus className="h-3.5 w-3.5" />
              Yeni Şube / Restoran
            </Link>
          </div>
        </div>

        {restaurantsLoading && restaurants.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#86868b]">Yükleniyor…</div>
        ) : restaurants.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#86868b]">Henüz restoran yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  <th className="px-4 py-3">Restoran / Şube</th>
                  <th className="px-4 py-3">Marka / Model</th>
                  <th className="px-4 py-3">Aylık Ücret</th>
                  <th className="px-4 py-3">Tahsilat &amp; Erişim</th>
                  <th className="px-4 py-3">Boss Atamaları</th>
                  <th className="px-4 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {restaurants.slice(0, 12).map((r) => {
                  const isSusp = Boolean(
                    r.isAccessSuspended || r.billingStatus === "suspended"
                  )
                  return (
                    <tr key={r.id} className="hover:bg-[#f9f9fb] transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#1d1d1f]">
                        <Link to={`/dashboard/restaurants/${r.id}`} className="hover:text-[#e63462]">
                          {r.name}
                        </Link>
                        {r.status === "inactive" && (
                          <span className="ml-2 rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-medium text-[#86868b]">
                            Pasif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#86868b]">
                        {r.brandName ? `${r.brandName} • ` : ""}
                        {r.branchType === "franchise"
                          ? "Franchise"
                          : r.branchType === "company_owned"
                            ? "Merkez Şube"
                            : "Bağımsız"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1d1d1f] tabular-nums">
                        {formatMoney(r.monthlyFee ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        {isSusp ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                            <Ban className="h-3 w-3" /> Erişim Durduruldu
                          </span>
                        ) : r.billingStatus === "overdue" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            <Clock className="h-3 w-3" /> Ödeme Gecikti
                          </span>
                        ) : r.billingStatus === "pending" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            <Clock className="h-3 w-3" /> Bu Ay Bekliyor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Ödendi • Aktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#636366]">
                        {r.bosses && r.bosses.length > 0
                          ? r.bosses.map((b) => b.name).join(", ")
                          : r.rootAdminId
                            ? "Boss Atanmış"
                            : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/dashboard/restaurants/${r.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed]"
                        >
                          <Pencil className="h-3 w-3" /> Düzenle
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
