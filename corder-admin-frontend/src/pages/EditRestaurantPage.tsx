import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Trash2 } from "lucide-react"
import { useAdminStore } from "@/lib/store"
import { RootAdminsSection } from "@/components/RootAdminsSection"
import {
  PrintAgentTokenSection,
  PrintAgentCategoriesSection,
} from "@/components/PrintAgentTokenSection"

export function EditRestaurantPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    restaurants,
    restaurantsLoading,
    restaurantsError,
    loadRestaurants,
    updateRestaurant,
    deleteRestaurant,
    rootAdminsForRestaurant,
    rootAdminsLoading,
    rootAdminsError,
    loadRootAdmins,
    addRootAdmin,
    deleteRootAdmin,
  } = useAdminStore()

  const restaurant = id ? restaurants.find((r) => r.id === id) : undefined

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  const [error, setError] = useState("")
  const [saveLoading, setSaveLoading] = useState(false)

  useEffect(() => {
    void loadRestaurants()
  }, [loadRestaurants])

  useEffect(() => {
    if (id) void loadRootAdmins(id)
  }, [id, loadRootAdmins])

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name)
      setSlug(restaurant.slug)
      setAddress(restaurant.address ?? "")
      setPhone(restaurant.phone ?? "")
      setEmail(restaurant.email ?? "")
      setStatus(restaurant.status)
    }
  }, [restaurant])

  if (restaurantsLoading && restaurants.length === 0) {
    return (
      <div>
        <p className="text-zinc-400">Yükleniyor…</p>
      </div>
    )
  }

  if (restaurantsError) {
    return (
      <div>
        <p className="text-red-400">{restaurantsError}</p>
        <Link
          to="/dashboard/restaurants"
          className="mt-4 inline-block text-blue-400 hover:underline"
        >
          Listeye dön
        </Link>
      </div>
    )
  }

  if (!id || !restaurant) {
    return (
      <div>
        <p className="text-zinc-400">Restoran bulunamadı.</p>
        <Link
          to="/dashboard/restaurants"
          className="mt-4 inline-block text-blue-400 hover:underline"
        >
          Listeye dön
        </Link>
      </div>
    )
  }

  const handleSaveRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const slugExists = restaurants.filter((r) => r.id !== id).some((r) => r.slug === slug)
    if (slugExists) {
      setError("Bu slug başka bir restoranda kullanılıyor.")
      return
    }
    setSaveLoading(true)
    try {
      await updateRestaurant(id, {
        name: name.trim(),
        slug: slug.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        status,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız")
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDeleteRestaurant = async () => {
    if (!confirm("Bu restoranı ve ilişkili root admin kaydını silmek istediğinize emin misiniz?")) {
      return
    }
    try {
      await deleteRestaurant(id)
      navigate("/dashboard/restaurants")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi")
    }
  }

  return (
    <div>
      <Link
        to="/dashboard/restaurants"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Restoranlara dön
      </Link>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white">{restaurant.name}</h1>
        <button
          type="button"
          onClick={handleDeleteRestaurant}
          className="flex items-center gap-2 rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
          Restoranı sil
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <PrintAgentTokenSection
          restaurantId={id}
          initialTerminalEmail={restaurant.terminalEmail}
          initialPrintAgentToken={restaurant.printAgentToken}
          onSaveTerminalConfig={async (config) => {
            await updateRestaurant(id, config)
          }}
        />

        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <h2 className="text-lg font-medium text-white">Restoran bilgileri</h2>
          <form onSubmit={handleSaveRestaurant} className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Restoran adı</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                required
                disabled={saveLoading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-blue-500"
                required
                disabled={saveLoading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Adres</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                disabled={saveLoading}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Telefon</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  disabled={saveLoading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">E-posta</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  disabled={saveLoading}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                disabled={saveLoading}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={saveLoading}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saveLoading ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </form>
        </div>

        <RootAdminsSection
          restaurantId={id}
          rootAdmins={rootAdminsForRestaurant}
          loading={rootAdminsLoading}
          error={rootAdminsError}
          onAddRootAdmin={addRootAdmin}
          onDeleteRootAdmin={deleteRootAdmin}
        />
      </div>

      <PrintAgentCategoriesSection restaurantId={id} />
    </div>
  )
}
