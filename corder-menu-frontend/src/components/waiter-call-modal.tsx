import { useState, useEffect } from "react"
import { ConciergeBell, Bell, CreditCard, CheckCircle2, X, Loader2 } from "lucide-react"
import {
  callWaiter,
  type MenuTableContext,
  type WaiterCallRequestType,
} from "@/lib/api"

const QUICK_NOTES = ["Su", "Peçete", "Menü", "Çatal / Bıçak", "Küllük / Temizlik"]
const COOLDOWN_SECONDS = 30

export type MenuWidgetTheme = "light" | "dark" | "editorial"

export function WaiterCallWidget(props: {
  slug: string
  tableContext: MenuTableContext | null | undefined
  theme?: MenuWidgetTheme
  openTrigger?: number
}) {
  const { slug, tableContext, theme = "light", openTrigger = 0 } = props
  const [open, setOpen] = useState(false)
  const [requestType, setRequestType] = useState<WaiterCallRequestType>("waiter")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [lastSubmittedType, setLastSubmittedType] = useState<WaiterCallRequestType | null>(null)

  useEffect(() => {
    if (openTrigger > 0) {
      setError(null)
      setOpen(true)
    }
  }, [openTrigger])

  useEffect(() => {
    if (cooldownLeft <= 0) return
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownLeft])

  // CRITICAL SECURITY: Only render when backend cryptographically verified tableContext
  if (!tableContext || !tableContext.tableId || !tableContext.tableName || !tableContext.tableToken) {
    return null
  }

  const toggleQuickNote = (chip: string) => {
    const current = note.trim()
    if (!current) {
      setNote(chip)
      return
    }
    const parts = current
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.includes(chip)) {
      setNote(parts.filter((p) => p !== chip).join(", "))
    } else {
      const next = [...parts, chip].join(", ")
      if (next.length <= 120) setNote(next)
    }
  }

  const handleSubmit = async () => {
    if (submitting || cooldownLeft > 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await callWaiter(slug, {
        tableToken: tableContext.tableToken,
        requestType,
        note: note.trim() || undefined,
      })
      setLastSubmittedType(requestType)
      setCooldownLeft(
        res.cooldownSeconds && res.cooldownSeconds > 0 ? res.cooldownSeconds : COOLDOWN_SECONDS
      )
      setNote("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Garson çağrısı gönderilemedi.")
    } finally {
      setSubmitting(false)
    }
  }

  const idleFabClass =
    theme === "dark"
      ? "bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-stone-950 shadow-amber-500/30 border border-amber-300/40 hover:shadow-amber-500/50 hover:scale-105 active:scale-95"
      : theme === "editorial"
        ? "bg-[#1C1917] text-[#F6F1E7] shadow-stone-900/35 border border-[#D6CEBF]/35 hover:bg-stone-800 hover:scale-105 active:scale-95"
        : "bg-stone-900 text-white shadow-stone-900/35 hover:bg-stone-800 hover:scale-105 active:scale-95"

  const pulseDotClass =
    theme === "dark"
      ? "bg-stone-950 ring-2 ring-amber-300"
      : theme === "editorial"
        ? "bg-amber-400 ring-2 ring-[#1C1917]"
        : "bg-rose-500 ring-2 ring-stone-900"

  const isDarkModal = theme === "dark"

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className={`fixed bottom-6 left-6 z-30 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
          cooldownLeft > 0
            ? "bg-emerald-600 text-white shadow-emerald-600/40 hover:scale-105 active:scale-95"
            : idleFabClass
        }`}
        aria-label="Garson Çağır"
        title="Garson Çağır"
      >
        {cooldownLeft > 0 ? (
          <>
            <CheckCircle2 className="w-6 h-6 text-white flex-shrink-0" />
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-900 text-[10px] font-bold text-white border border-white shadow-sm leading-none">
              {cooldownLeft}s
            </span>
          </>
        ) : (
          <>
            <ConciergeBell className="w-6 h-6 flex-shrink-0" />
            <span
              className={`absolute top-3 right-3 w-2 h-2 rounded-full animate-pulse ${pulseDotClass}`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Garson Çağır"
          className="fixed inset-0 z-[150] bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className={`w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden ${
              isDarkModal
                ? "bg-[#15151C] text-[#F5F2EB] border border-white/10"
                : "bg-white text-stone-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`p-5 border-b flex items-center justify-between ${
                isDarkModal
                  ? "border-white/10 bg-gradient-to-r from-amber-500/10 to-yellow-500/5"
                  : "border-stone-100 bg-gradient-to-r from-rose-50/80 to-orange-50/80"
              }`}
            >
              <div>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-1.5 ${
                    isDarkModal
                      ? "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Masa {tableContext.tableName}</span>
                  {tableContext.sectionName && <span>• {tableContext.sectionName}</span>}
                </div>
                <h2 className={`text-lg font-bold ${isDarkModal ? "text-[#F5F2EB]" : "text-stone-900"}`}>
                  Masa Servisi & Garson Çağır
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isDarkModal
                    ? "bg-white/10 text-stone-300 hover:bg-white/20"
                    : "bg-white/80 text-stone-500 hover:bg-white hover:text-stone-800"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {cooldownLeft > 0 ? (
                <div
                  className={`rounded-2xl border p-4 text-center space-y-2 ${
                    isDarkModal
                      ? "bg-emerald-950/50 border-emerald-500/30"
                      : "bg-emerald-50 border-emerald-200"
                  }`}
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className={`font-bold text-base ${isDarkModal ? "text-emerald-200" : "text-emerald-950"}`}>
                    Garsonunuz çağrıldı — Masa {tableContext.tableName}
                  </p>
                  <p className={`text-xs ${isDarkModal ? "text-emerald-300/80" : "text-emerald-700"}`}>
                    {lastSubmittedType === "bill"
                      ? "Hesap talebiniz ekibimize iletildi."
                      : "Çağrınız ekibimizin el terminaline iletildi."}
                  </p>
                  <p className="text-xs font-semibold text-emerald-500 pt-1">
                    Yeni çağrı için {cooldownLeft} saniye bekleyin
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRequestType("waiter")}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        requestType === "waiter"
                          ? isDarkModal
                            ? "border-amber-400 bg-amber-400/15 text-amber-300 shadow-sm"
                            : "border-rose-500 bg-rose-50/70 text-rose-700 shadow-sm"
                          : isDarkModal
                            ? "border-white/10 bg-white/[0.04] text-stone-300 hover:border-white/20"
                            : "border-stone-100 bg-stone-50 text-stone-700 hover:border-stone-200"
                      }`}
                    >
                      <Bell className="w-6 h-6" />
                      <span className="font-bold text-sm">Garson Çağır</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType("bill")}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        requestType === "bill"
                          ? isDarkModal
                            ? "border-amber-400 bg-amber-400/15 text-amber-300 shadow-sm"
                            : "border-rose-500 bg-rose-50/70 text-rose-700 shadow-sm"
                          : isDarkModal
                            ? "border-white/10 bg-white/[0.04] text-stone-300 hover:border-white/20"
                            : "border-stone-100 bg-stone-50 text-stone-700 hover:border-stone-200"
                      }`}
                    >
                      <CreditCard className="w-6 h-6" />
                      <span className="font-bold text-sm">Hesap İste</span>
                    </button>
                  </div>

                  <div>
                    <label
                      className={`block text-xs font-semibold mb-2 ${
                        isDarkModal ? "text-stone-400" : "text-stone-600"
                      }`}
                    >
                      İsteğe Bağlı Kısa Not (Su, Peçete, Menü vb.)
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {QUICK_NOTES.map((chip) => {
                        const selected = note
                          .split(",")
                          .map((s) => s.trim())
                          .includes(chip)
                        return (
                          <button
                            type="button"
                            key={chip}
                            onClick={() => toggleQuickNote(chip)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              selected
                                ? isDarkModal
                                  ? "bg-amber-400 text-stone-950 font-semibold"
                                  : "bg-stone-900 text-white"
                                : isDarkModal
                                  ? "bg-white/10 text-stone-300 hover:bg-white/15"
                                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                            }`}
                          >
                            {chip}
                          </button>
                        )
                      })}
                    </div>
                    <input
                      type="text"
                      maxLength={120}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Su, Peçete, Menü vb."
                      className={`w-full h-11 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 ${
                        isDarkModal
                          ? "bg-white/[0.06] text-white placeholder:text-stone-500 focus:ring-amber-400/40"
                          : "bg-stone-100 text-stone-900 placeholder:text-stone-400 focus:ring-rose-500/30"
                      }`}
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2.5 text-xs font-medium text-rose-500">
                  {error}
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`flex-1 h-12 rounded-xl font-semibold text-sm transition-colors ${
                    isDarkModal
                      ? "bg-white/10 text-stone-300 hover:bg-white/15"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                >
                  Kapat
                </button>
                {cooldownLeft === 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                    className={`flex-[1.6] h-12 rounded-xl font-semibold text-sm shadow-lg hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2 transition-all ${
                      isDarkModal
                        ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-stone-950 shadow-amber-500/20"
                        : "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-rose-500/25"
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gönderiliyor...</span>
                      </>
                    ) : requestType === "bill" ? (
                      <span>Hesap İste</span>
                    ) : (
                      <span>Garson Çağır</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
