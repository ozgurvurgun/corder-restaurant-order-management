import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { usePlatformAuth } from "@/lib/auth-context"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CreditCard,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  User,
} from "lucide-react"

export function LoginPage() {
  const { verifyCredentials, login, isAuthenticated } = usePlatformAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<"credentials" | "auth-code">("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [verifiedEmail, setVerifiedEmail] = useState("")
  const [verifiedName, setVerifiedName] = useState("")
  const [authCode, setAuthCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showAuthCode, setShowAuthCode] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const authCodeInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (step === "auth-code") {
      requestAnimationFrame(() => authCodeInputRef.current?.focus())
    }
  }, [step])

  if (isAuthenticated) return null

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError("")
    setLoading(true)
    try {
      const result = await verifyCredentials(email.trim(), password)
      if (result.success) {
        setVerifiedEmail(result.email || email.trim())
        setVerifiedName(result.name || "Platform Admin")
        setAuthCode("")
        setStep("auth-code")
      } else {
        setError(result.error ?? "Geçersiz yönetici kullanıcı adı veya parola")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAuthCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authCode.trim()) return
    setError("")
    setLoading(true)
    try {
      const result = await login({
        email: verifiedEmail || email.trim(),
        password,
        authCode: authCode.trim(),
      })
      if (result.success) navigate("/dashboard")
      else setError(result.error ?? "Geçersiz Platform Admin Auth Kodu")
    } finally {
      setLoading(false)
    }
  }

  const handleBackToCredentials = () => {
    setError("")
    setAuthCode("")
    setStep("credentials")
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#f5f5f7] to-[#e8e8ed] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px]">
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

        <div className="bg-white rounded-2xl shadow-xl p-7 border border-[#e5e5ea]">
          <div className="mb-5">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">
              {step === "credentials"
                ? "Platform Yöneticisi Girişi"
                : "Güvenlik Doğrulaması (Auth Kodu)"}
            </h2>
            <p className="text-[12px] text-[#86868b] mt-0.5">
              {step === "credentials"
                ? "Önce yönetici kullanıcı adı/e-postası ve parolanızı girin"
                : "Kimlik doğrulandı. Oturumu tamamlamak için Platform Admin Auth Kodunu girin"}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-xl text-[#ff3b30] text-[13px] font-medium text-center">
              {error}
            </div>
          )}

          {step === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
                  Kullanıcı Adı veya E-posta
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@corder.app"
                    autoComplete="username"
                    autoFocus
                    className="w-full h-[44px] pl-10 pr-4 text-[14px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 text-[#1d1d1f] focus:outline-none focus:border-[#e63462] focus:ring-2 focus:ring-[#e63462]/20 transition-all"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
                  Parola
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Yönetici parolanızı girin…"
                    autoComplete="current-password"
                    className={`w-full h-[44px] pl-10 pr-11 text-[14px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/60 text-[#1d1d1f] focus:outline-none focus:border-[#e63462] focus:ring-2 focus:ring-[#e63462]/20 transition-all ${
                      showPassword ? "font-mono text-[13px]" : ""
                    }`}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                    aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full h-[44px] mt-1 bg-[#e63462] hover:bg-[#d42d56] text-white font-semibold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? "Doğrulanıyor…" : "Devam Et"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuthCodeSubmit} className="space-y-4">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-emerald-800">
                    Doğrulanan Yönetici
                  </p>
                  <p className="text-[12.5px] font-bold text-emerald-950 truncate">
                    {verifiedName} ({verifiedEmail})
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleBackToCredentials}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Değiştir
                </button>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
                  Google Authenticator Kodu (6 Haneli) veya Auth Kodu
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={authCodeInputRef}
                    type={showAuthCode ? "text" : "password"}
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="6 haneli Google Auth kodu veya Auth Kodu…"
                    autoComplete="one-time-code"
                    inputMode="text"
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

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleBackToCredentials}
                  className="h-[44px] px-4 rounded-xl border border-[#d1d1d6] text-[13px] font-semibold text-[#636366] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
                >
                  Geri
                </button>
                <button
                  type="submit"
                  disabled={loading || !authCode.trim()}
                  className="flex-1 h-[44px] bg-[#e63462] hover:bg-[#d42d56] text-white font-semibold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
