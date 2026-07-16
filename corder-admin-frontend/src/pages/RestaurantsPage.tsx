import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import { Plus, Pencil } from "lucide-react"

export function RestaurantsPage() {
  const { restaurants, restaurantsLoading, restaurantsError, loadRestaurants } = useAdminStore()

  useEffect(() => {
    loadRestaurants()
  }, [loadRestaurants])

  if (restaurantsLoading && restaurants.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Restoranlar</h1>
        <p className="mt-4 text-zinc-400">Yükleniyor…</p>
      </div>
    )
  }

  if (restaurantsError) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Restoranlar</h1>
        <p className="mt-4 text-red-400">{restaurantsError}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Restoranlar</h1>
          <p className="mt-1 text-zinc-400">Restoran tanımla ve root admin ata</p>
        </div>
        <Link
          to="/dashboard/restaurants/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Yeni restoran
        </Link>
      </div>
      <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
        {restaurants.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-zinc-500">Henüz restoran eklenmedi.</p>
            <Link to="/dashboard/restaurants/new" className="mt-4 inline-block text-blue-400 hover:underline">
              İlk restoranı ekle
            </Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a] text-zinc-400">
                <th className="p-4 font-medium">Restoran</th>
                <th className="p-4 font-medium">Slug</th>
                <th className="p-4 font-medium">İletişim</th>
                <th className="p-4 font-medium">Durum</th>
                <th className="p-4 font-medium">Root admin</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <tr key={r.id} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#222]">
                  <td className="p-4">
                    <Link to={`/dashboard/restaurants/${r.id}`} className="font-medium text-white hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="p-4 text-zinc-400 font-mono text-xs">{r.slug}</td>
                  <td className="p-4 text-zinc-400">{r.phone || r.email || "—"}</td>
                  <td className="p-4">
                    <span className={r.status === "active" ? "text-emerald-400" : "text-zinc-500"}>
                      {r.status === "active" ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-400">{r.rootAdminId ? "Atanmış" : "—"}</td>
                  <td className="p-4">
                    <Link
                      to={`/dashboard/restaurants/${r.id}`}
                      className="inline-flex rounded-lg p-2 text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
                      aria-label="Düzenle"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
