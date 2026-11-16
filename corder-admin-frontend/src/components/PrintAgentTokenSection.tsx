import { useState, useEffect, useCallback } from "react"
import { Monitor, Printer, Copy, RefreshCw } from "lucide-react"
import { platform } from "@/lib/api"

interface PanelCategoryItem {
  id: string
  name: string
  slug: string
  order: number
  showInTerminal: boolean
  showInMenu: boolean
  createdAt: string
}

interface PrintAgentTokenSectionProps {
  restaurantId: string
  initialTerminalEmail?: string | null
  initialPrintAgentUsername?: string | null
  onSaveTerminalConfig: (config: {
    terminalEmail?: string | null
    terminalPassword?: string
    printAgentUsername?: string | null
    printAgentPassword?: string
  }) => Promise<void>
}

export function PrintAgentTokenSection({
  initialTerminalEmail,
  initialPrintAgentUsername,
  onSaveTerminalConfig,
}: PrintAgentTokenSectionProps) {
  const [terminalEmail, setTerminalEmail] = useState(initialTerminalEmail ?? "")
  const [terminalPassword, setTerminalPassword] = useState("")
  const [terminalError, setTerminalError] = useState("")
  const [terminalSuccess, setTerminalSuccess] = useState("")
  const [terminalSaveLoading, setTerminalSaveLoading] = useState(false)

  const [printAgentUsername, setPrintAgentUsername] = useState(initialPrintAgentUsername ?? "")
  const [printAgentPassword, setPrintAgentPassword] = useState("")
  const [printAgentError, setPrintAgentError] = useState("")
  const [printAgentSuccess, setPrintAgentSuccess] = useState("")
  const [printAgentSaveLoading, setPrintAgentSaveLoading] = useState(false)

  useEffect(() => {
    setTerminalEmail(initialTerminalEmail ?? "")
    setPrintAgentUsername(initialPrintAgentUsername ?? "")
  }, [initialTerminalEmail, initialPrintAgentUsername])

  const handleSaveTerminal = async (e: React.FormEvent) => {
    e.preventDefault()
    setTerminalError("")
    setTerminalSuccess("")
    if (!terminalEmail.trim()) {
      setTerminalError("Terminal e-posta gerekli.")
      return
    }
    setTerminalSaveLoading(true)
    try {
      await onSaveTerminalConfig({
        terminalEmail: terminalEmail.trim(),
        ...(terminalPassword ? { terminalPassword } : {}),
      })
      setTerminalPassword("")
      setTerminalSuccess("Terminal giriş bilgileri kaydedildi.")
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : "Kayıt başarısız")
    } finally {
      setTerminalSaveLoading(false)
    }
  }

  const handleSavePrintAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    setPrintAgentError("")
    setPrintAgentSuccess("")
    const cleanUser = printAgentUsername.trim().toLowerCase()
    if (!cleanUser || cleanUser.length < 3) {
      setPrintAgentError("Kullanıcı adı en az 3 karakter olmalıdır.")
      return
    }
    if (!initialPrintAgentUsername && printAgentPassword.length < 6) {
      setPrintAgentError("Yeni Print Agent kullanıcısı için en az 6 karakterli parola belirleyin.")
      return
    }
    setPrintAgentSaveLoading(true)
    try {
      await onSaveTerminalConfig({
        printAgentUsername: cleanUser,
        ...(printAgentPassword ? { printAgentPassword } : {}),
      })
      setPrintAgentPassword("")
      setPrintAgentSuccess("Print Agent kullanıcı bilgileri kaydedildi.")
    } catch (err) {
      setPrintAgentError(err instanceof Error ? err.message : "Kayıt başarısız")
    } finally {
      setPrintAgentSaveLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h2 className="text-lg font-medium text-white">
          Print Agent (Masaüstü Yazıcı Uygulaması) Kullanıcısı
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Mekandaki bilgisayara kurulan Corder Yazıcı &amp; Mutfak Merkezi masaüstü uygulamasına
          giriş yapmak için kullanılacak kullanıcı adı ve parola.
        </p>
        <form onSubmit={handleSavePrintAgent} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-zinc-300">Kullanıcı Adı</label>
            <input
              type="text"
              value={printAgentUsername}
              onChange={(e) => setPrintAgentUsername(e.target.value)}
              placeholder="Örn: merkez-yazici"
              minLength={3}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-blue-500"
              disabled={printAgentSaveLoading}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-zinc-300">
              Parola {initialPrintAgentUsername ? "(değiştirmek için doldurun; boş bırakılırsa mevcut parola korunur)" : "(en az 6 karakter) *"}
            </label>
            <input
              type="password"
              value={printAgentPassword}
              onChange={(e) => setPrintAgentPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
              disabled={printAgentSaveLoading}
              required={!initialPrintAgentUsername}
            />
          </div>
          {printAgentError && <p className="text-sm text-red-400">{printAgentError}</p>}
          {printAgentSuccess && <p className="text-sm text-emerald-400">{printAgentSuccess}</p>}
          <button
            type="submit"
            disabled={printAgentSaveLoading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            {printAgentSaveLoading ? "Kaydediliyor…" : "Print Agent kullanıcısını kaydet"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h2 className="text-lg font-medium text-white">Terminal giriş bilgileri</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Terminal uygulamasında (kasa/garson ekranı) giriş yapmak için kullanılacak e-posta ve
          parola. Root admin ile ilişkisi yoktur.
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
            <label className="mb-1.5 block text-sm text-zinc-300">
              Terminal parola (değiştirmek için doldur; boş bırakırsan mevcut parola kalır)
            </label>
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
          {terminalError && <p className="text-sm text-red-400">{terminalError}</p>}
          {terminalSuccess && <p className="text-sm text-emerald-400">{terminalSuccess}</p>}
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
    </div>
  )
}

export function PrintAgentCategoriesSection({ restaurantId }: { restaurantId: string }) {
  const [panelCategories, setPanelCategories] = useState<PanelCategoryItem[]>([])
  const [panelCategoriesLoading, setPanelCategoriesLoading] = useState(false)
  const [panelCategoriesError, setPanelCategoriesError] = useState<string | null>(null)

  const loadPanelCategories = useCallback(async () => {
    setPanelCategoriesLoading(true)
    setPanelCategoriesError(null)
    try {
      const list = await platform.restaurants.categories(restaurantId)
      setPanelCategories(list)
    } catch (err) {
      setPanelCategoriesError(err instanceof Error ? err.message : "Kategoriler yüklenemedi")
    } finally {
      setPanelCategoriesLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    void loadPanelCategories()
  }, [loadPanelCategories])

  return (
    <div className="mt-8 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">Ürün kategorileri</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Bu restoranın panelinde tanımlanan kategoriler. Masaüstü Print Agent uygulaması giriş
            yapıldığında bu kategorileri otomatik olarak çeker.
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
                panelCategories.map((category) => (
                  <tr key={category.id} className="border-b border-[#2a2a2a] last:border-0">
                    <td className="p-3 font-medium text-white">{category.name}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <code className="break-all font-mono text-xs text-zinc-300" title={category.id}>
                          {category.id}
                        </code>
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard?.writeText(category.id)}
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
  )
}
