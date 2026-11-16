import { useEffect, useState } from "react"
import { usePanelAuth } from "@/lib/panel-auth"
import { Eye, EyeOff, LogIn, Store, Ban, Copy, Check } from "lucide-react"

export default function PanelLogin() {
  const { login } = usePanelAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [copiedIban, setCopiedIban] = useState(false)

  useEffect(() => {
    try {
      const notice = sessionStorage.getItem("panel_suspended_notice")
      if (notice) {
        setError(notice)
        sessionStorage.removeItem("panel_suspended_notice")
      }
    } catch {}
  }, [])

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

  const isPaymentSuspendedError =
    error.toLowerCase().includes("ödeme alınmadığı") ||
    error.includes("ÖDEME ALINMADIĞI İÇİN") ||
    error.toLowerCase().includes("access suspended") ||
    error.toLowerCase().includes("unpaid subscription")

  const ibanMatch = error.match(/TR[0-9 ]{20,34}/i)
  const extractedIban = ibanMatch ? ibanMatch[0].trim() : null

  const handleCopyIban = async () => {
    if (!extractedIban) return
    try {
      await navigator.clipboard.writeText(extractedIban)
      setCopiedIban(true)
      window.setTimeout(() => setCopiedIban(false), 2500)
    } catch {}
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#f5f5f7] to-[#e8e8ed] flex items-center justify-center p-4">
      <div className="w-full max-w-[430px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#e63462] rounded-2xl mb-4 shadow-lg">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-[28px] font-bold text-[#1d1d1f]">Corder Panel</h1>
          <p className="text-[15px] text-[#86868b] mt-1">
            İşletme Sahibi (Boss) veya Şube Yöneticisi hesabınızla giriş yapın
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 border border-[#e5e5ea]"
        >
          {error && isPaymentSuspendedError ? (
            <div className="mb-5 rounded-2xl border-2 border-[#ff3b30]/40 bg-[#ff3b30]/10 p-4 text-left">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[#ff3b30] p-2 text-white flex-shrink-0">
                  <Ban className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-[14px] font-extrabold text-[#c91c12]">
                    Ödeme Alınmadığı İçin Erişim Durduruldu
                  </h3>
                  <p className="text-[12px] leading-relaxed text-[#1d1d1f] font-medium">
                    {error}
                  </p>
                  {extractedIban && (
                    <button
                      type="button"
                      onClick={() => void handleCopyIban()}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-black/80"
                    >
                      {copiedIban ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> IBAN Kopyalandı
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> IBAN Kopyala ({extractedIban})
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="mb-4 p-3 bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-xl text-[#ff3b30] text-[13px] font-medium text-center">
              {error}
            </div>
          ) : null}

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
              E-posta
            </label>
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
            <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
              Parola
            </label>
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
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
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
          Marka Sahibi (HQ), Şube / Franchise Boss veya yetkili Şube Yöneticisi hesabınızla giriş yapabilirsiniz.
        </p>
      </div>
    </div>
  )
}
