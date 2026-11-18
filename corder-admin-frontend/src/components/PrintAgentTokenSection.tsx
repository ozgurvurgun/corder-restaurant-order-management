import { useState, useEffect } from "react"
import { Monitor, Printer } from "lucide-react"
import { CorderEmailInput } from "@/components/CorderEmailInput"
import { PasswordInputWithGenerator } from "@/components/ui/password-input"
import { formatCanonicalCorderEmail } from "@/lib/corder-email"

interface PrintAgentTokenSectionProps {
  restaurantId: string
  restaurantSlug?: string
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
  restaurantSlug,
  initialTerminalEmail,
  initialPrintAgentUsername,
  onSaveTerminalConfig,
}: PrintAgentTokenSectionProps) {
  const [terminalEmail, setTerminalEmail] = useState(initialTerminalEmail ?? "")
  const [terminalPassword, setTerminalPassword] = useState("")
  const [terminalError, setTerminalError] = useState("")
  const [terminalSuccess, setTerminalSuccess] = useState("")
  const [terminalSaveLoading, setTerminalSaveLoading] = useState(false)

  const [printAgentUsername, setPrintAgentUsername] = useState(
    initialPrintAgentUsername ?? ""
  )
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
    const cleanEmail = formatCanonicalCorderEmail(terminalEmail, restaurantSlug)
    if (!cleanEmail) {
      setTerminalError("Terminal kullanıcı adı (@ öncesi) gerekli.")
      return
    }
    if (!initialTerminalEmail && terminalPassword.length < 4) {
      setTerminalError(
        "Yeni terminal hesabı için en az 4 karakterli bir parola belirleyin."
      )
      return
    }
    if (terminalPassword.length > 0 && terminalPassword.length < 4) {
      setTerminalError("Terminal parolası en az 4 karakter olmalıdır.")
      return
    }
    setTerminalSaveLoading(true)
    try {
      await onSaveTerminalConfig({
        terminalEmail: cleanEmail,
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
      setPrintAgentError(
        "Yeni Print Agent kullanıcısı için en az 6 karakterli parola belirleyin."
      )
      return
    }
    if (printAgentPassword.length > 0 && printAgentPassword.length < 6) {
      setPrintAgentError("Print Agent parolası en az 6 karakter olmalıdır.")
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

  const inputCls =
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
          Print Agent (Masaüstü Yazıcı Uygulaması) Kullanıcısı
        </h2>
        <p className="mt-1 text-[12px] text-[#86868b]">
          Mekandaki bilgisayara kurulan Corder Yazıcı &amp; Mutfak Merkezi masaüstü uygulamasına
          giriş yapmak için kullanılacak kullanıcı adı ve parola.
        </p>
        <form onSubmit={handleSavePrintAgent} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Kullanıcı Adı</label>
            <input
              type="text"
              value={printAgentUsername}
              onChange={(e) => setPrintAgentUsername(e.target.value)}
              placeholder="Örn: merkez-yazici"
              minLength={3}
              autoComplete="off"
              className={`${inputCls} font-mono`}
              disabled={printAgentSaveLoading}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Parola{" "}
              {initialPrintAgentUsername
                ? "(değiştirmek için doldurun; boş bırakılırsa mevcut parola korunur)"
                : "(en az 6 karakter) *"}
            </label>
            <PasswordInputWithGenerator
              value={printAgentPassword}
              onChange={(e) => setPrintAgentPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              autoComplete="new-password"
              className={inputCls}
              disabled={printAgentSaveLoading}
              required={!initialPrintAgentUsername}
            />
          </div>
          {printAgentError && <p className="text-[12px] font-medium text-red-600">{printAgentError}</p>}
          {printAgentSuccess && (
            <p className="text-[12px] font-medium text-emerald-700">{printAgentSuccess}</p>
          )}
          <button
            type="submit"
            disabled={printAgentSaveLoading}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#e63462] px-4 text-[13px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            {printAgentSaveLoading
              ? "Kaydediliyor…"
              : "Print Agent Kullanıcısını Kaydet"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Terminal Giriş Bilgileri</h2>
        <p className="mt-1 text-[12px] text-[#86868b]">
          Terminal uygulamasında (kasa/garson ekranı) giriş yapmak için kullanılacak e-posta ve
          parola.
        </p>
        <form onSubmit={handleSaveTerminal} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Terminal E-posta</label>
            <CorderEmailInput
              value={terminalEmail}
              onChange={setTerminalEmail}
              tenantSlugOrName={restaurantSlug}
              placeholder="terminal"
              disabled={terminalSaveLoading}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Terminal Parola{" "}
              {initialTerminalEmail
                ? "(değiştirmek için doldurun; boş bırakılırsa mevcut parola korunur)"
                : "(en az 4 karakter) *"}
            </label>
            <PasswordInputWithGenerator
              value={terminalPassword}
              onChange={(e) => setTerminalPassword(e.target.value)}
              placeholder="••••••••"
              minLength={4}
              autoComplete="new-password"
              className={inputCls}
              disabled={terminalSaveLoading}
              required={!initialTerminalEmail}
            />
          </div>
          {terminalError && <p className="text-[12px] font-medium text-red-600">{terminalError}</p>}
          {terminalSuccess && <p className="text-[12px] font-medium text-emerald-700">{terminalSuccess}</p>}
          <button
            type="submit"
            disabled={terminalSaveLoading}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#e63462] px-4 text-[13px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
          >
            <Monitor className="h-4 w-4" />
            {terminalSaveLoading ? "Kaydediliyor…" : "Terminal Bilgilerini Kaydet"}
          </button>
        </form>
      </div>
    </div>
  )
}
