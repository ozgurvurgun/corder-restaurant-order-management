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

  if (restaurantsLoading && restaurants.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Özet</h1>
        <p className="mt-4 text-zinc-400">Yükleniyor…</p>
      </div>
    )
  }

  if (restaurantsError) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Özet</h1>
        <p className="mt-4 text-red-400">{restaurantsError}</p>
        <button
          type="button"
          onClick={() => {
            void loadRestaurants()
            void loadAllBosses()
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm text-zinc-200 hover:bg-[#2a2a2a]"
        >
          <RefreshCw className="h-4 w-4" />
          Tekrar Dene
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Platform Özeti</h1>
      <p className="mt-1 text-zinc-400">
        Restoran/Franchise şubeleri, Boss hiyerarşisi ve aylık abonelik tahsilat (25-30) durumu
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-600/20 p-2">
              <UtensilsCrossed className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{restaurants.length}</p>
              <p className="text-sm text-zinc-400">Toplam Şube / Restoran</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-600/20 p-2">
              <Building2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{activeCount}</p>
              <p className="text-sm text-zinc-400">
                Aktif Şube {suspendedCount > 0 ? `(${suspendedCount} Askıda)` : ""}
              </p>
            </div>
          </div>
        </div>
        <Link
          to="/dashboard/bosses"
          className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 hover:border-[#e63462]/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#e63462]/20 p-2">
              <Crown className="h-5 w-5 text-[#e63462]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{allBosses.length}</p>
              <p className="text-sm text-zinc-400">Marka &amp; Şube Bossları</p>
            </div>
          </div>
        </Link>
        <Link
          to="/dashboard/billing"
          className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 hover:border-emerald-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-600/20 p-2">
              <CreditCard className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{formatMoney(totalMrr)}</p>
              <p className="text-sm text-zinc-400">Aylık Tahsilat (25-30)</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-white">Son Şubeler &amp; Restoranlar</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/billing"
              className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-[#2a2a2a]"
            >
              Tahsilat &amp; Ücretler
            </Link>
            <Link
              to="/dashboard/bosses"
              className="rounded-lg bg-[#e63462] px-4 py-2 text-sm font-medium text-white hover:bg-[#d42d56]"
            >
              Boss &amp; Franchise Yönetimi
            </Link>
            <Link
              to="/dashboard/restaurants/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Yeni Şube / Restoran
            </Link>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
          {restaurants.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">Henüz restoran yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-zinc-400">
                    <th className="p-4 font-medium">Restoran / Şube</th>
                    <th className="p-4 font-medium">Marka / Model</th>
                    <th className="p-4 font-medium">Aylık Ücret</th>
                    <th className="p-4 font-medium">Tahsilat &amp; Erişim</th>
                    <th className="p-4 font-medium">Boss Atamaları</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.slice(0, 10).map((r) => {
                    const isSusp = Boolean(
                      r.isAccessSuspended || r.billingStatus === "suspended"
                    )
                    return (
                      <tr key={r.id} className="border-b border-[#2a2a2a] last:border-0">
                        <td className="p-4 text-white font-medium">
                          {r.name}
                          {r.status === "inactive" && (
                            <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-normal text-zinc-400">
                              Pasif
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-zinc-400 text-xs">
                          {r.brandName ? `${r.brandName} • ` : ""}
                          {r.branchType === "franchise"
                            ? "Franchise"
                            : r.branchType === "company_owned"
                              ? "Merkez Şube"
                              : "Bağımsız"}
                        </td>
                        <td className="p-4 text-white font-medium">
                          {formatMoney(r.monthlyFee ?? 0)}
                        </td>
                        <td className="p-4">
                          {isSusp ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                              <Ban className="h-3.5 w-3.5" /> Erişim Durduruldu
                            </span>
                          ) : r.billingStatus === "pending" ||
                            r.billingStatus === "overdue" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                              <Clock className="h-3.5 w-3.5" /> Ödeme Bekliyor
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Ödendi • Aktif
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-zinc-400 text-xs">
                          {r.bosses && r.bosses.length > 0
                            ? r.bosses.map((b) => b.name).join(", ")
                            : r.rootAdminId
                              ? "Boss Atanmış"
                              : "—"}
                        </td>
                        <td className="p-4">
                          <Link
                            to={`/dashboard/restaurants/${r.id}`}
                            className="text-blue-400 hover:underline"
                          >
                            Düzenle
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
    </div>
  )
}
