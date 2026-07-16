import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import { UtensilsCrossed, UserCheck, Building2 } from "lucide-react"

export function DashboardPage() {
  const { restaurants, restaurantsLoading, restaurantsError, loadRestaurants } = useAdminStore()

  useEffect(() => {
    loadRestaurants()
  }, [loadRestaurants])

  const activeCount = restaurants.filter((r) => r.status === "active").length
  const withAdmin = restaurants.filter((r) => r.rootAdminId).length

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
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Özet</h1>
      <p className="mt-1 text-zinc-400">Platform ve restoran durumu</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-600/20 p-2">
              <UtensilsCrossed className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{restaurants.length}</p>
              <p className="text-sm text-zinc-400">Toplam restoran</p>
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
              <p className="text-sm text-zinc-400">Aktif restoran</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-600/20 p-2">
              <UserCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{withAdmin}</p>
              <p className="text-sm text-zinc-400">Root admin atanmış</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Son restoranlar</h2>
          <Link
            to="/dashboard/restaurants/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Yeni restoran
          </Link>
        </div>
        <div className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
          {restaurants.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">Henüz restoran yok.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-zinc-400">
                  <th className="p-4 font-medium">Restoran</th>
                  <th className="p-4 font-medium">Slug</th>
                  <th className="p-4 font-medium">Durum</th>
                  <th className="p-4 font-medium">Root admin</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {restaurants.slice(0, 5).map((r) => (
                  <tr key={r.id} className="border-b border-[#2a2a2a] last:border-0">
                    <td className="p-4 text-white">{r.name}</td>
                    <td className="p-4 text-zinc-400">{r.slug}</td>
                    <td className="p-4">
                      <span className={r.status === "active" ? "text-emerald-400" : "text-zinc-500"}>
                        {r.status === "active" ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400">{r.rootAdminId ? "Atanmış" : "—"}</td>
                    <td className="p-4">
                      <Link to={`/dashboard/restaurants/${r.id}`} className="text-blue-400 hover:underline">
                        Düzenle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
