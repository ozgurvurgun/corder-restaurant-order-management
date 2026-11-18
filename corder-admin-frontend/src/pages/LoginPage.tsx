import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { usePlatformAuth } from "@/lib/auth-context"
import { Eye, EyeOff, LogIn, KeyRound, Building2, CreditCard, Crown } from "lucide-react"

export function LoginPage() {
  const { login, isAuthenticated } = usePlatformAuth()
  const navigate = useNavigate()
  const [authCode, setAuthCode] = useState("")
  const [showAuthCode, setShowAuthCode] = useState(false)
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
      const result = await login(authCode)
      if (result.success) navigate("/dashboard")
      else setError(result.error ?? "Giriş başarısız")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#f5f5f7] to-[#e8e8ed] flex items-center justify-center p-4">
      <div className="w-full max-w-[430px]">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3.5 shadow-lg overflow-hidden bg-[#e63462]">
            <img
              src="/corder-logo.png"
              alt="Corder Admin"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-[24px] font-semibold text-[#1d1d1f]">Corder Admin</h1>
          <p className="text-[13px] text-[#86868b] mt-1">
            Restoran, franchise, Boss hiyerarşisi, 360° canlı destek ve abonelik tahsilat yönetimi
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 border border-[#d1d1d6]/60 px-2.5 py-1 text-[11px] font-medium text-[#636366]">
              <Building2 className="h-3 w-3 text-[#e63462]" /> Şube &amp; Franchise
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 border border-[#d1d1d6]/60 px-2.5 py-1 text-[11px] font-medium text-[#636366]">
              <Crown className="h-3 w-3 text-[#e63462]" /> Boss Hiyerarşisi
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 border border-[#d1d1d6]/60 px-2.5 py-1 text-[11px] font-medium text-[#636366]">
              <CreditCard className="h-3 w-3 text-[#e63462]" /> 25-30 Tahsilat
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-7 border border-[#e5e5ea]"
        >
          <div className="mb-5">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">
              Platform Yöneticisi Girişi
            </h2>
            <p className="text-[12px] text-[#86868b] mt-0.5">
              Sunucu yapılandırmasındaki Platform Admin Auth Kodu ile oturum açın
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-xl text-[#ff3b30] text-[13px] font-medium text-center">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
              Platform Admin Auth Kodu
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showAuthCode ? "text" : "password"}
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Platform Admin Auth Kodunu girin…"
                autoComplete="current-password"
                className={`w-full h-[44px] pl-10 pr-11 text-[14px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 text-[#1d1d1f] focus:outline-none focus:border-[#e63462] focus:ring-2 focus:ring-[#e63462]/20 transition-all ${
                  showAuthCode ? "font-mono text-[13px]" : ""
                }`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowAuthCode(!showAuthCode)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                aria-label={showAuthCode ? "Kodu gizle" : "Kodu göster"}
              >
                {showAuthCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[44px] bg-[#e63462] hover:bg-[#d42d56] text-white font-semibold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  )
}
