import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import { ArrowLeft } from "lucide-react"

export function NewRestaurantPage() {
  const navigate = useNavigate()
  const { addRestaurant, restaurants } = useAdminStore()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSlugFromName = () => {
    if (!name) return
    setSlug(
      name
        .toLowerCase()
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!name.trim()) {
      setError("Restoran adı gerekli.")
      return
    }
    if (!slug.trim()) {
      setError("Slug gerekli (URL için benzersiz).")
      return
    }
    const slugExists = restaurants.some((r) => r.slug === slug)
    if (slugExists) {
      setError("Bu slug zaten kullanılıyor.")
      return
    }
    setLoading(true)
    try {
      await addRestaurant({
        name: name.trim(),
        slug: slug.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        status,
      })
      navigate("/dashboard/restaurants")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız")
    } finally {
      setLoading(false)
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
      <h1 className="text-2xl font-semibold text-white">Yeni restoran</h1>
      <p className="mt-1 text-zinc-400">Restoran bilgilerini gir. Root admin sonra düzenleme sayfasından atanır.</p>
      <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Restoran adı *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSlugFromName}
            placeholder="Örn. Deniz Restaurant"
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-white outline-none focus:border-blue-500"
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Slug (URL) *</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="deniz-restaurant"
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-blue-500"
            required
            disabled={loading}
          />
          <p className="mt-1 text-xs text-zinc-500">Menü linki: .../?restaurant={slug}</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Adres</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Tam adres"
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-white outline-none focus:border-blue-500"
            disabled={loading}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-white outline-none focus:border-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-white outline-none focus:border-blue-500"
              disabled={loading}
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Durum</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-white outline-none focus:border-blue-500"
            disabled={loading}
          >
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Kaydediliyor…" : "Kaydet"}
          </button>
          <Link
            to="/dashboard/restaurants"
            className="rounded-lg border border-[#2a2a2a] px-6 py-2.5 text-sm font-medium text-zinc-300 hover:bg-[#2a2a2a]"
          >
            İptal
          </Link>
        </div>
      </form>
    </div>
  )
}
