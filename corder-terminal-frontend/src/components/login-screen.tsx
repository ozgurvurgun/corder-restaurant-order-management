import { useState } from "react"
import { Utensils, Phone } from "lucide-react"
import { useApp } from "@/lib/store"
import { useToast } from "@/components/ios-toast"

interface LoginScreenProps {
  onLogin: () => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const { login, error } = useApp()
  const { showToast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email?.trim() || !password) return
    setLoading(true)
    const success = await login(email.trim(), password)
    setLoading(false)
    if (success) onLogin()
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-between bg-gradient-to-b from-[#e63462] via-[#c62a6b] to-[#7b2d8e] px-6 py-12 safe-top safe-bottom">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm gap-10">
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-[22px] bg-white/15 backdrop-blur-xl flex items-center justify-center shadow-lg">
            <Utensils className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-[28px] font-bold text-white tracking-tight mt-3">
            Corder Terminal
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl overflow-hidden">
            <input
              type="email"
              placeholder="terminal@restoran.corder.app"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-white placeholder:text-white/50 py-4 px-4 text-[17px] focus:outline-none border-b border-white/10"
            />
            <input
              type="password"
              placeholder="Parola"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-white placeholder:text-white/50 py-4 px-4 text-[17px] focus:outline-none"
            />
          </div>

          {error && (
            <div
              className={`rounded-2xl py-3 px-4 text-center backdrop-blur-xl ${
                error.toLowerCase().includes("ödeme alınmadığı") ||
                error.toLowerCase().includes("access suspended")
                  ? "bg-red-950/80 border-2 border-red-400/80 text-white"
                  : "bg-white/10 text-white/90"
              }`}
            >
              {(error.toLowerCase().includes("ödeme alınmadığı") ||
                error.toLowerCase().includes("access suspended")) && (
                <p className="text-[14px] font-extrabold text-red-200 mb-1">
                  Ödeme Alınmadığı İçin Erişim Durduruldu
                </p>
              )}
              <p className="text-[13px] leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-[#e63462] font-semibold py-[14px] rounded-[14px] text-[17px] shadow-lg active:scale-[0.98] active:opacity-90 transition-all disabled:opacity-70"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <button
          type="button"
          onClick={() =>
            showToast("Destek için işletme yöneticiniz veya Compart Software ile iletişime geçin.", "info")
          }
          className="flex items-center gap-2 text-white/70 active:text-white transition-colors"
        >
          <Phone className="h-[18px] w-[18px]" />
          <span className="text-[15px] font-medium">Müşteri Hizmetleri</span>
        </button>
      </div>

      <div className="text-center mt-8 pb-6">
        <p className="text-white/40 text-[12px] font-medium">Powered By</p>
        <p className="text-white/70 font-bold text-[14px] tracking-wider mt-0.5">
          COMPART SOFTWARE
        </p>
      </div>
    </div>
  )
}
