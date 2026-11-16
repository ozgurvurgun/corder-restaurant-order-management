import { useState, useEffect } from "react"
import { useBossStore } from "@/lib/boss-store"
import {
  Crown,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Building2,
  ArrowRight,
  Download,
} from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function BossLogin() {
  const { login } = useBossStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosGuide, setShowIosGuide] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
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

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
    } else {
      setShowIosGuide(true)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-gradient-to-b from-[#e63462] via-[#c62a6b] to-[#7b2d8e] px-5 py-8 safe-top safe-bottom">
      {/* Top Brand */}
      <div className="mx-auto w-full max-w-md pt-4 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/95 shadow-xl">
          <Crown className="h-8 w-8 text-[#e63462]" />
        </div>
        <h1 className="text-[26px] font-bold tracking-tight text-white">
          Corder Boss
        </h1>
        <p className="mt-1 text-[13px] font-medium text-white/80">
          Çok Şubeli Restoran, Yetki & Canlı Ciro Yönetim Uygulaması
        </p>

        {/* Feature Pills */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            <Building2 className="h-3.5 w-3.5" /> Çoklu Şube
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5" /> 48 Granüler Yetki
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            <Smartphone className="h-3.5 w-3.5" /> Mobil PWA
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="mx-auto my-6 w-full max-w-md rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
        <h2 className="text-[18px] font-bold text-[#1d1d1f]">
          İşletme Sahibi (Boss) Girişi
        </h2>
        <p className="mt-0.5 text-[12px] text-[#86868b]">
          Platform yöneticiniz tarafından tanımlanan Boss hesabınızla giriş yapın.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#1d1d1f]">
              E-posta Adresi
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patron@restoran.com"
                autoComplete="email"
                className="h-12 w-full rounded-2xl border border-[#d1d1d6]/80 bg-[#f5f5f7] pl-10 pr-4 text-[14px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#1d1d1f]">
              Parola
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-12 w-full rounded-2xl border border-[#d1d1d6]/80 bg-[#f5f5f7] pl-10 pr-4 text-[14px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-[12px] font-medium text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e63462] text-[15px] font-semibold text-white shadow-lg shadow-[#e63462]/30 active:scale-[0.99] hover:bg-[#d42d56] disabled:opacity-50 transition-all"
          >
            {loading ? "Giriş Yapılıyor…" : "Boss Paneline Giriş Yap"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* PWA Install Button */}
        <div className="mt-5 border-t border-[#e5e5ea] pt-4">
          <button
            type="button"
            onClick={() => void handleInstallPwa()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f5f5f7] py-2.5 text-[12px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors"
          >
            <Download className="h-4 w-4 text-[#e63462]" />
            Telefon Ana Ekranına Uygulama Olarak İndir (PWA)
          </button>
          {showIosGuide && (
            <p className="mt-2 rounded-xl bg-[#fef3f5] p-3 text-[11px] text-[#1d1d1f] leading-relaxed">
              <strong>Kurulum:</strong> Tarayıcınızın menüsünden{" "}
              <span className="font-semibold text-[#e63462]">Paylaş / Menü</span> butonuna
              dokunun ve{" "}
              <span className="font-semibold text-[#e63462]">&ldquo;Ana Ekrana Ekle&rdquo;</span>{" "}
              seçeneğini seçin.
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center">
        <p className="text-[11px] font-medium text-white/50">CORDER ECOSYSTEM</p>
        <p className="text-[12px] font-bold tracking-wider text-white/80">
          BOSS MOBILE &amp; WEB PWA
        </p>
      </div>
    </div>
  )
}

