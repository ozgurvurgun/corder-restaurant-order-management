import { useState, useEffect } from "react"
import { useBossStore } from "@/lib/boss-store"
import { Eye, EyeOff, LogIn, Ban } from "lucide-react"

export function BossLogin() {
  const { login } = useBossStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const notice = sessionStorage.getItem("boss_suspended_notice")
      if (notice) {
        setError(notice)
        sessionStorage.removeItem("boss_suspended_notice")
      }
    } catch {}
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email.trim() || !password) {
      setError("Lütfen e-posta ve parolanızı girin.")
      return
    }
    setLoading(true)
    const res = await login(email.trim(), password)
    setLoading(false)
    if (!res.ok) {
      setError(res.error || "Giriş yapılamadı")
    }
  }

  const isSuspendedError =
    error.toLowerCase().includes("abonelik ödemesi") ||
    error.toLowerCase().includes("geçici olarak durdurulmuştur") ||
    error.toLowerCase().includes("ödeme alınmadığı") ||
    error.toLowerCase().includes("access suspended")

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#f5f5f7] to-[#e8e8ed] flex items-center justify-center p-4">
      <div className="w-full max-w-[430px]">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#e63462] rounded-2xl mb-3.5 shadow-lg overflow-hidden">
            <img
              src="/corder-logo.png"
              alt="Corder Boss"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-[24px] font-semibold text-[#1d1d1f]">Corder Boss</h1>
          <p className="text-[13px] text-[#86868b] mt-1">
            Çok şubeli restoran, yetki ve canlı ciro yönetim paneli
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-7 border border-[#e5e5ea]"
        >
          <div className="mb-5">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">
              İşletme Sahibi (Boss) Girişi
            </h2>
            <p className="text-[12px] text-[#86868b] mt-0.5">
              Boss hesabınızın e-posta ve parolasıyla oturum açın
            </p>
          </div>

          {error && isSuspendedError ? (
            <div className="mb-4 rounded-xl border border-[#ff3b30]/40 bg-[#ff3b30]/10 p-3.5 text-left">
              <div className="flex items-start gap-2.5">
                <div className="rounded-lg bg-[#ff3b30] p-1.5 text-white flex-shrink-0">
                  <Ban className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-[13px] font-semibold text-[#c91c12]">
                    Erişim Geçici Olarak Durduruldu
                  </h3>
                  <p className="text-[12px] leading-relaxed text-[#1d1d1f]">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="mb-4 p-3 bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-xl text-[#ff3b30] text-[13px] font-medium text-center">
              {error}
            </div>
          ) : null}

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patron@restoran.corder.app"
              autoComplete="email"
              className="w-full h-[44px] px-3.5 text-[14px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 text-[#1d1d1f] focus:outline-none focus:border-[#e63462] focus:ring-2 focus:ring-[#e63462]/20 transition-all"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
              Parola
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full h-[44px] px-3.5 pr-11 text-[14px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 text-[#1d1d1f] focus:outline-none focus:border-[#e63462] focus:ring-2 focus:ring-[#e63462]/20 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[44px] bg-[#e63462] hover:bg-[#d42d56] text-white font-semibold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  )
}
