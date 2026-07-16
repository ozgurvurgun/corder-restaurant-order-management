import { useState } from "react"
import { usePanelAuth } from "@/lib/panel-auth"
import { Eye, EyeOff, LogIn, Store } from "lucide-react"

export default function PanelLogin() {
  const { login } = usePanelAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError("E-posta ve parola gerekli")
      return
    }
    setLoading(true)
    setError("")
    const result = await login(email.trim(), password)
    if (!result.success) setError(result.error ?? "Giriş başarısız")
    setLoading(false)
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#f5f5f7] to-[#e8e8ed] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#e63462] rounded-2xl mb-4 shadow-lg">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-[28px] font-bold text-[#1d1d1f]">Corder Panel</h1>
          <p className="text-[15px] text-[#86868b] mt-1">Restoran hesabınızla giriş yapın</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 border border-[#e5e5ea]">
          {error && (
            <div className="mb-4 p-3 bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-xl text-[#ff3b30] text-[13px] font-medium text-center">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@restaurant.com"
              className="w-full h-[48px] px-4 text-[15px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462] focus:ring-2 focus:ring-[#e63462]/20 transition-all"
              autoComplete="username"
            />
          </div>

          <div className="mb-6">
            <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">Parola</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-[48px] px-4 pr-12 text-[15px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462] focus:ring-2 focus:ring-[#e63462]/20 transition-all"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[48px] bg-[#e63462] hover:bg-[#d42d58] disabled:bg-[#e63462]/50 text-white rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Giriş Yap
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[12px] text-[#86868b] mt-6">
          Restoran root admin e-posta ve parolanızla giriş yapın. Her e-posta yalnızca tek bir restoranla ilişkilidir.
        </p>
      </div>
    </div>
  )
}
