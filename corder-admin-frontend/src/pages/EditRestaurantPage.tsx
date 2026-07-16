import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import { platform } from "@/lib/api"
import { ArrowLeft, UserPlus, Trash2, Monitor, Copy, RefreshCw } from "lucide-react"

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
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [adminError, setAdminError] = useState("")
  const [saveLoading, setSaveLoading] = useState(false)
  const [adminSubmitLoading, setAdminSubmitLoading] = useState(false)
  const [terminalEmail, setTerminalEmail] = useState("")
  const [terminalPassword, setTerminalPassword] = useState("")
  const [printAgentToken, setPrintAgentToken] = useState("")
  const [terminalError, setTerminalError] = useState("")
  const [terminalSaveLoading, setTerminalSaveLoading] = useState(false)

  const [panelCategories, setPanelCategories] = useState<
    Array<{ id: string; name: string; slug: string; order: number; showInTerminal: boolean; showInMenu: boolean; createdAt: string }>
  >([])
  const [panelCategoriesLoading, setPanelCategoriesLoading] = useState(false)
  const [panelCategoriesError, setPanelCategoriesError] = useState<string | null>(null)

  const loadPanelCategories = useCallback(async () => {
    if (!id) return
    setPanelCategoriesLoading(true)
    setPanelCategoriesError(null)
    try {
      const list = await platform.restaurants.categories(id)
      setPanelCategories(list)
    } catch (e) {
      setPanelCategoriesError(e instanceof Error ? e.message : "Kategoriler yüklenemedi")
    } finally {
      setPanelCategoriesLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadRestaurants()
  }, [loadRestaurants])

  useEffect(() => {
    if (id) loadRootAdmins(id)
  }, [id, loadRootAdmins])

  useEffect(() => {
    void loadPanelCategories()
  }, [loadPanelCategories])

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name)
      setSlug(restaurant.slug)
      setAddress(restaurant.address ?? "")
      setPhone(restaurant.phone ?? "")
      setEmail(restaurant.email ?? "")
      setStatus(restaurant.status)
      setTerminalEmail(restaurant.terminalEmail ?? "")
      setPrintAgentToken(restaurant.printAgentToken ?? "")
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
        <Link to="/dashboard/restaurants" className="mt-4 inline-block text-blue-400 hover:underline">
          Listeye dön
        </Link>
      </div>
    )
  }

  if (!id || !restaurant) {
    return (
      <div>
        <p className="text-zinc-400">Restoran bulunamadı.</p>
        <Link to="/dashboard/restaurants" className="mt-4 inline-block text-blue-400 hover:underline">
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

  const handleAddRootAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError("")
    if (!adminName.trim() || !adminEmail.trim()) {
      setAdminError("Ad ve e-posta gerekli.")
      return
    }
    if (adminPassword.length < 8) {
      setAdminError("Parola en az 8 karakter olmalı.")
      return
    }
    setAdminSubmitLoading(true)
    try {
      await addRootAdmin(id, {
        name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
      })
      setShowAdminForm(false)
      setAdminName("")
      setAdminEmail("")
      setAdminPassword("")
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Root admin oluşturulamadı")
    } finally {
      setAdminSubmitLoading(false)
    }
  }

  const handleDeleteRestaurant = async () => {
    if (!confirm("Bu restoranı ve ilişkili root admin kaydını silmek istediğinize emin misiniz?")) return
    try {
      await deleteRestaurant(id)
      navigate("/dashboard/restaurants")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi")
    }
  }

  const handleSaveTerminal = async (e: React.FormEvent) => {
    e.preventDefault()
    setTerminalError("")
    if (!terminalEmail.trim()) {
      setTerminalError("Terminal e-posta gerekli.")
      return
    }
    setTerminalSaveLoading(true)
    try {
      await updateRestaurant(id, {
        terminalEmail: terminalEmail.trim(),
        ...(terminalPassword ? { terminalPassword } : {}),
        printAgentToken: printAgentToken.trim() || undefined,
      })
      setTerminalPassword("")
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : "Kayıt başarısız")
    } finally {
      setTerminalSaveLoading(false)
    }
  }

  const generatePrintAgentToken = () => {
    const randomPart = Math.random().toString(36).slice(2, 12)
    const timePart = Date.now().toString(36)
    setPrintAgentToken(`pa_${timePart}_${randomPart}`)
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
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <h2 className="text-lg font-medium text-white">Terminal giriş bilgileri</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Terminal uygulamasında (kasa/garson ekranı) giriş yapmak için kullanılacak e-posta ve parola. Root admin ile ilişkisi yoktur.
          </p>
          <form onSubmit={handleSaveTerminal} className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Terminal e-posta</label>
              <input
                type="email"
                value={terminalEmail}
                onChange={(e) => setTerminalEmail(e.target.value)}
                placeholder="terminal@restoran.com"
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                disabled={terminalSaveLoading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Terminal parola (değiştirmek için doldur; boş bırakırsan mevcut parola kalır)</label>
              <input
                type="password"
                value={terminalPassword}
                onChange={(e) => setTerminalPassword(e.target.value)}
                placeholder="••••••••"
                minLength={4}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                disabled={terminalSaveLoading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">Print Agent Token (Windows print-agent .env AGENT_TOKEN)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={printAgentToken}
                  onChange={(e) => setPrintAgentToken(e.target.value)}
                  placeholder="pa_xxxxxxxxxxxxxxxxx"
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-blue-500"
                  disabled={terminalSaveLoading}
                />
                <button
                  type="button"
                  onClick={generatePrintAgentToken}
                  disabled={terminalSaveLoading}
                  className="rounded-lg border border-[#2a2a2a] px-3 py-2.5 text-sm text-zinc-300 hover:bg-[#2a2a2a]"
                >
                  Üret
                </button>
              </div>
            </div>
            {terminalError && <p className="text-sm text-red-400">{terminalError}</p>}
            <button
              type="submit"
              disabled={terminalSaveLoading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Monitor className="h-4 w-4" />
              {terminalSaveLoading ? "Kaydediliyor…" : "Terminal bilgilerini kaydet"}
            </button>
          </form>
        </div>

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

        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <h2 className="text-lg font-medium text-white">Root admin</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Bu restoranın panelinde e-posta ve parola ile giriş yapacak yöneticiler. Her e-posta yalnızca bir restorana atanır. Parolalar backend&apos;de güvenli saklanır.
          </p>
          {rootAdminsError && <p className="mt-2 text-sm text-red-400">{rootAdminsError}</p>}
          {rootAdminsLoading ? (
            <p className="mt-4 text-sm text-zinc-500">Yükleniyor…</p>
          ) : (
            <>
              <ul className="mt-4 space-y-3">
                {rootAdminsForRestaurant.map((a) => (
                  <li key={a.id} className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4">
                    <p className="font-medium text-white">{a.name}</p>
                    <p className="text-sm text-zinc-400">{a.email}</p>
                    <button
                      type="button"
                      onClick={() => deleteRootAdmin(id, a.id)}
                      className="mt-3 text-sm text-red-400 hover:underline"
                    >
                      Kaldır
                    </button>
                  </li>
                ))}
              </ul>
              {showAdminForm ? (
            <form onSubmit={handleAddRootAdmin} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Ad soyad</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Yönetici adı"
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  required
                  disabled={adminSubmitLoading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">E-posta (giriş için)</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@restaurant.com"
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  required
                  disabled={adminSubmitLoading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Parola (en az 8 karakter) *</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  required
                  disabled={adminSubmitLoading}
                />
              </div>
              {adminError && <p className="text-sm text-red-400">{adminError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adminSubmitLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {adminSubmitLoading ? "Oluşturuluyor…" : "Root admin oluştur"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminForm(false)}
                  className="rounded-lg border border-[#2a2a2a] px-4 py-2.5 text-sm text-zinc-300 hover:bg-[#2a2a2a]"
                >
                  İptal
                </button>
              </div>
            </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminForm(true)
                    setAdminName("")
                    setAdminEmail("")
                    setAdminPassword("")
                    setAdminError("")
                  }}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-[#2a2a2a] px-4 py-3 text-sm text-zinc-400 hover:border-blue-500/50 hover:text-blue-400"
                >
                  <UserPlus className="h-4 w-4" />
                  {rootAdminsForRestaurant.length > 0 ? "Yeni root admin ekle" : "Root admin oluştur"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">Ürün kategorileri</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Bu restoranın panelinde tanımlanan kategoriler. Print agent veya{" "}
              <code className="rounded bg-[#0f0f0f] px-1.5 py-0.5 font-mono text-xs text-zinc-300">PRINT_CATEGORY_ROUTES</code> için
              kategori ID&apos;sini kopyalayabilirsiniz.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPanelCategories()}
            disabled={panelCategoriesLoading}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#2a2a2a] px-3 py-2 text-sm text-zinc-300 hover:bg-[#2a2a2a] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${panelCategoriesLoading ? "animate-spin" : ""}`} />
            Yenile
          </button>
        </div>
        {panelCategoriesError && <p className="mt-3 text-sm text-red-400">{panelCategoriesError}</p>}
        {panelCategoriesLoading && !panelCategoriesError ? (
          <p className="mt-4 text-sm text-zinc-500">Kategoriler yükleniyor…</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-[#2a2a2a]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-zinc-400">
                  <th className="p-3 font-medium">Kategori adı</th>
                  <th className="p-3 font-medium">Kategori ID</th>
                </tr>
              </thead>
              <tbody>
                {panelCategories.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-6 text-center text-zinc-500">
                      Henüz kategori yok. Restoran panelinden ürün kategorisi ekleyin.
                    </td>
                  </tr>
                ) : (
                  panelCategories.map((c) => (
                    <tr key={c.id} className="border-b border-[#2a2a2a] last:border-0">
                      <td className="p-3 font-medium text-white">{c.name}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <code className="break-all font-mono text-xs text-zinc-300" title={c.id}>
                            {c.id}
                          </code>
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard?.writeText(c.id)}
                            className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
                            title="ID kopyala"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
