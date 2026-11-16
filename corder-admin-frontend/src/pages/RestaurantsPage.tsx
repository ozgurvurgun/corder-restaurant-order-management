import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import {
  Plus,
  Pencil,
  CheckCircle2,
  Ban,
  Clock,
  Building2,
  CreditCard,
} from "lucide-react"

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

export function RestaurantsPage() {
  const {
    restaurants,
    restaurantsLoading,
    restaurantsError,
    loadRestaurants,
    markRestaurantPaid,
    suspendRestaurantUnpaid,
  } = useAdminStore()

  useEffect(() => {
    void loadRestaurants()
  }, [loadRestaurants])

  if (restaurantsLoading && restaurants.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Restoranlar &amp; Şubeler</h1>
        <p className="mt-4 text-zinc-400">Yükleniyor…</p>
      </div>
    )
  }

  if (restaurantsError) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Restoranlar &amp; Şubeler</h1>
        <p className="mt-4 text-red-400">{restaurantsError}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Restoranlar, Şubeler &amp; Franchise Ağı
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Şube/franchise yapılarını, üst marka ve şube Boss atamalarını, aylık abonelik ücretlerini ve erişim durumlarını yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/dashboard/billing"
            className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-[#2a2a2a]"
          >
            <CreditCard className="h-4 w-4 text-[#e63462]" />
            Tahsilat &amp; Ücret Yönetimi (25-30)
          </Link>
          <Link
            to="/dashboard/restaurants/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Yeni Restoran / Şube
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
        {restaurants.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-zinc-500">Henüz restoran eklenmedi.</p>
            <Link
              to="/dashboard/restaurants/new"
              className="mt-4 inline-block text-blue-400 hover:underline"
            >
              İlk restoranı ekle
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-zinc-400 text-xs">
                  <th className="p-4 font-medium">Restoran / Şube</th>
                  <th className="p-4 font-medium">Marka / Model</th>
                  <th className="p-4 font-medium">Boss Hiyerarşisi</th>
                  <th className="p-4 font-medium">Aylık Ücret</th>
                  <th className="p-4 font-medium">Ödeme &amp; Erişim (25-30)</th>
                  <th className="p-4 text-right font-medium">Hızlı İşlem</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((r) => {
                  const isSusp = Boolean(
                    r.isAccessSuspended || r.billingStatus === "suspended"
                  )
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-[#2a2a2a] last:border-0 ${
                        isSusp ? "bg-red-950/15" : "hover:bg-[#222]"
                      }`}
                    >
                      <td className="p-4">
                        <Link
                          to={`/dashboard/restaurants/${r.id}`}
                          className="font-medium text-white hover:underline block"
                        >
                          {r.name}
                        </Link>
                        <span className="text-xs font-mono text-zinc-500">{r.slug}</span>
                      </td>
                      <td className="p-4">
                        {r.brandName ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#e63462]/15 px-2 py-0.5 text-xs font-medium text-[#e63462]">
                            <Building2 className="h-3 w-3" />
                            {r.brandName}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">Bağımsız</span>
                        )}
                        <span className="block text-[11px] text-zinc-400 mt-0.5">
                          {r.branchType === "franchise"
                            ? "Franchise Şubesi"
                            : r.branchType === "company_owned"
                              ? "Merkez Şube"
                              : "Tekil Mekan"}
                        </span>
                      </td>
                      <td className="p-4">
                        {r.bosses && r.bosses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.bosses.map((b) => (
                              <span
                                key={b.id}
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                                  b.bossTier === "brand_owner"
                                    ? "bg-purple-500/20 text-purple-300"
                                    : "bg-zinc-800 text-zinc-200"
                                }`}
                              >
                                {b.name} ({b.bossTier === "brand_owner" ? "Marka HQ" : "Şube Boss"})
                              </span>
                            ))}
                          </div>
                        ) : r.rootAdminId ? (
                          <span className="text-xs text-zinc-300">Boss Atanmış</span>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-white">
                        {formatMoney(r.monthlyFee ?? 0)}
                        <span className="text-[11px] font-normal text-zinc-500"> / ay</span>
                      </td>
                      <td className="p-4">
                        {isSusp ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400">
                            <Ban className="h-3 w-3" />
                            Erişim Durduruldu
                          </span>
                        ) : r.billingStatus === "pending" || r.billingStatus === "overdue" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
                            <Clock className="h-3 w-3" />
                            Ödeme Bekliyor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Ödendi • Aktif
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isSusp ? (
                            <button
                              type="button"
                              onClick={() => void markRestaurantPaid(r.id)}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                              title="Ödeme Alındı İşaretle ve Erişimi Aç"
                            >
                              Ödeme Alındı (Aç)
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    `${r.name} mekanının ödeme alınmadığı için erişimini durdurmak istiyor musunuz?`
                                  )
                                ) {
                                  void suspendRestaurantUnpaid(r.id)
                                }
                              }}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
                              title="Ödeme Alınmadı — Erişimi Durdur"
                            >
                              Erişimi Durdur
                            </button>
                          )}
                          <Link
                            to={`/dashboard/restaurants/${r.id}`}
                            className="inline-flex rounded-lg p-2 text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
                            aria-label="Düzenle"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </div>
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
