import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { usePlatformAuth } from "@/lib/auth-context"
import { Lock, Mail } from "lucide-react"

export function LoginPage() {
  const { login, isAuthenticated } = usePlatformAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true })
  }, [isAuthenticated, navigate])

  if (isAuthenticated) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.success) navigate("/dashboard")
      else setError(result.error ?? "Giriş başarısız")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#0f0f0f] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-white">Platform Admin</h1>
          <p className="mt-1 text-sm text-zinc-500">Restoran ve erişim yönetimi</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">E-posta</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-blue-500"
                required
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Parola</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-blue-500"
                required
                disabled={loading}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {loading ? "Giriş yapılıyor…" : "Giriş yap"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Backend .env içindeki PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD ile giriş yapın
        </p>
      </div>
    </div>
  )
}
