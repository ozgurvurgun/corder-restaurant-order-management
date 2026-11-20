import { useState, useEffect } from "react"
import { Check, Monitor, Printer, Receipt } from "lucide-react"
import { CorderEmailInput } from "@/components/CorderEmailInput"
import { PasswordInputWithGenerator } from "@/components/ui/password-input"
import { formatCanonicalCorderEmail } from "@/lib/corder-email"

interface PrintAgentTokenSectionProps {
  restaurantId: string
  restaurantSlug?: string
  initialTerminalEmail?: string | null
  initialPrintAgentUsername?: string | null
  initialReceiptFooterEnabled?: boolean
  initialReceiptFooterTitle?: string | null
  initialReceiptFooterUrl?: string | null
  onSaveTerminalConfig: (config: {
    terminalEmail?: string | null
    terminalPassword?: string
    printAgentUsername?: string | null
    printAgentPassword?: string
    receiptFooterEnabled?: boolean
    receiptFooterTitle?: string | null
    receiptFooterUrl?: string | null
  }) => Promise<void>
}

export function PrintAgentTokenSection({
  restaurantSlug,
  initialTerminalEmail,
  initialPrintAgentUsername,
  initialReceiptFooterEnabled = true,
  initialReceiptFooterTitle = "Compart Software",
  initialReceiptFooterUrl = "compartsoftware.com",
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

  const [receiptFooterEnabled, setReceiptFooterEnabled] = useState(
    initialReceiptFooterEnabled !== false
  )
  const [receiptFooterTitle, setReceiptFooterTitle] = useState(
    initialReceiptFooterTitle ?? "Compart Software"
  )
  const [receiptFooterUrl, setReceiptFooterUrl] = useState(
    initialReceiptFooterUrl ?? "compartsoftware.com"
  )
  const [footerError, setFooterError] = useState("")
  const [footerSuccess, setFooterSuccess] = useState("")
  const [footerSaveLoading, setFooterSaveLoading] = useState(false)

  useEffect(() => {
    setTerminalEmail(initialTerminalEmail ?? "")
    setPrintAgentUsername(initialPrintAgentUsername ?? "")
    setReceiptFooterEnabled(initialReceiptFooterEnabled !== false)
    setReceiptFooterTitle(initialReceiptFooterTitle ?? "Compart Software")
    setReceiptFooterUrl(initialReceiptFooterUrl ?? "compartsoftware.com")
  }, [
    initialTerminalEmail,
    initialPrintAgentUsername,
    initialReceiptFooterEnabled,
    initialReceiptFooterTitle,
    initialReceiptFooterUrl,
  ])

  const handleSaveReceiptFooter = async (e: React.FormEvent) => {
    e.preventDefault()
    setFooterError("")
    setFooterSuccess("")
    setFooterSaveLoading(true)
    try {
      await onSaveTerminalConfig({
        receiptFooterEnabled,
        receiptFooterTitle: receiptFooterTitle.trim(),
        receiptFooterUrl: receiptFooterUrl.trim(),
      })
      setFooterSuccess(
        "Termal fiş altı marka ve web adresi ayarları kaydedildi ve Print Agent'a anlık iletildi."
      )
    } catch (err) {
      setFooterError(err instanceof Error ? err.message : "Kayıt başarısız")
    } finally {
      setFooterSaveLoading(false)
    }
  }

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
    const cleanEmail = formatCanonicalCorderEmail(printAgentUsername, restaurantSlug)
    if (!cleanEmail) {
      setPrintAgentError("Print Agent kullanıcı adı (@ öncesi) gerekli.")
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
        printAgentUsername: cleanEmail,
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
          Print Agent (Masaüstü Yazıcı Uygulaması) Giriş Bilgileri
        </h2>
        <p className="mt-1 text-[12px] text-[#86868b]">
          Mekandaki bilgisayara kurulan Corder Yazıcı &amp; Mutfak Merkezi masaüstü uygulamasına
          giriş yapmak için kullanılacak e-posta ve parola.
        </p>
        <form onSubmit={handleSavePrintAgent} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">Print Agent E-posta</label>
            <CorderEmailInput
              value={printAgentUsername}
              onChange={setPrintAgentUsername}
              tenantSlugOrName={restaurantSlug}
              placeholder="yazici"
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
              : "Print Agent Bilgilerini Kaydet"}
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

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
              Termal Fiş Altı Çatı Firma &amp; Web Adresi
            </h2>
            <p className="mt-1 text-[12px] text-[#86868b]">
              Yazıcıdan çıkan tüm adisyon, mutfak ve rapor fişlerinin en altında yer alacak
              çatı firma adı ve web adresi. İşletme talebine göre gizleyebilir veya
              özelleştirebilirsiniz.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReceiptFooterEnabled((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer select-none flex-shrink-0 ${
              receiptFooterEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-[#d1d1d6] bg-[#f5f5f7] text-[#636366]"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                receiptFooterEnabled
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-white border-[#d1d1d6]"
              }`}
            >
              {receiptFooterEnabled && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </span>
            <span>{receiptFooterEnabled ? "Fişlerde Görünür" : "Gizli"}</span>
          </button>
        </div>

        <form onSubmit={handleSaveReceiptFooter} className="mt-4 space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Çatı Firma / Marka Adı (1. Satır)
              </label>
              <input
                type="text"
                value={receiptFooterTitle}
                onChange={(e) => setReceiptFooterTitle(e.target.value)}
                placeholder="Compart Software"
                maxLength={120}
                className={inputCls}
                disabled={footerSaveLoading}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Web Adresi / Alt Metin (2. Satır)
              </label>
              <input
                type="text"
                value={receiptFooterUrl}
                onChange={(e) => setReceiptFooterUrl(e.target.value)}
                placeholder="compartsoftware.com"
                maxLength={160}
                className={inputCls}
                disabled={footerSaveLoading}
              />
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-[#d1d1d6] bg-[#f9f9fb] p-3 text-center font-mono text-[11.5px] text-[#1d1d1f]">
            <div className="text-[10px] font-sans font-semibold uppercase tracking-wide text-[#86868b] mb-1">
              Termal Fiş En Alt Satır Önizlemesi
            </div>
            {receiptFooterEnabled && (receiptFooterTitle.trim() || receiptFooterUrl.trim()) ? (
              <div className="space-y-0.5">
                <div className="text-[#86868b]">--------------------------------</div>
                {receiptFooterTitle.trim() && (
                  <div className="font-bold">{receiptFooterTitle.trim()}</div>
                )}
                {receiptFooterUrl.trim() && <div>{receiptFooterUrl.trim()}</div>}
              </div>
            ) : (
              <div className="text-[#86868b] font-sans">
                Bu işletmede fiş altı çatı firma bilgisi basılmayacak.
              </div>
            )}
          </div>

          {footerError && <p className="text-[12px] font-medium text-red-600">{footerError}</p>}
          {footerSuccess && (
            <p className="text-[12px] font-medium text-emerald-700">{footerSuccess}</p>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="submit"
              disabled={footerSaveLoading}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#e63462] px-4 text-[13px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
            >
              <Receipt className="h-4 w-4" />
              {footerSaveLoading ? "Kaydediliyor…" : "Fiş Altı Ayarlarını Kaydet"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReceiptFooterEnabled(true)
                setReceiptFooterTitle("Compart Software")
                setReceiptFooterUrl("compartsoftware.com")
              }}
              className="text-[12px] font-medium text-[#636366] hover:text-[#1d1d1f] underline"
            >
              Varsayılana Sıfırla (Compart Software)
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
