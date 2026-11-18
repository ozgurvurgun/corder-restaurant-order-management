import { useState, useEffect } from "react"
import { Bell, CreditCard, CheckCircle2, X, Loader2 } from "lucide-react"
import {
  callWaiter,
  type MenuTableContext,
  type WaiterCallRequestType,
} from "@/lib/api"

const QUICK_NOTES = ["Su", "Peçete", "Menü", "Çatal / Bıçak", "Küllük / Temizlik"]
const COOLDOWN_SECONDS = 30

export function WaiterCallWidget(props: {
  slug: string
  tableContext: MenuTableContext | null | undefined
}) {
  const { slug, tableContext } = props
  const [open, setOpen] = useState(false)
  const [requestType, setRequestType] = useState<WaiterCallRequestType>("waiter")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [lastSubmittedType, setLastSubmittedType] = useState<WaiterCallRequestType | null>(null)

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
      setCooldownLeft(res.cooldownSeconds && res.cooldownSeconds > 0 ? res.cooldownSeconds : COOLDOWN_SECONDS)
      setNote("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Garson çağrısı gönderilemedi.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className={`fixed bottom-6 left-6 z-30 flex items-center gap-2.5 px-4 h-14 rounded-full shadow-xl font-semibold text-sm transition-all duration-200 ${
          cooldownLeft > 0
            ? "bg-emerald-600 text-white shadow-emerald-600/35"
            : "bg-stone-900 text-white shadow-stone-900/35 hover:bg-stone-800 active:scale-95"
        }`}
        aria-label="Garson Çağır"
      >
        {cooldownLeft > 0 ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-100 flex-shrink-0" />
            <span>Çağrıldı ({cooldownLeft}sn)</span>
          </>
        ) : (
          <>
            <Bell className="w-5 h-5 text-rose-400 animate-pulse flex-shrink-0" />
            <span>Garson Çağır</span>
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Garson Çağır"
          className="fixed inset-0 z-[150] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-rose-50/80 to-orange-50/80">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold mb-1">
                  <span>Masa: {tableContext.tableName}</span>
                  {tableContext.sectionName && <span>• {tableContext.sectionName}</span>}
                </div>
                <h2 className="text-lg font-bold text-stone-900">Masa Servisi & Garson Çağır</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center text-stone-500 hover:bg-white hover:text-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {cooldownLeft > 0 ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <p className="font-bold text-emerald-950 text-base">
                    Garsonunuz çağrıldı — {tableContext.tableName}
                  </p>
                  <p className="text-xs text-emerald-700">
                    {lastSubmittedType === "bill"
                      ? "Hesap talebiniz ekibimize iletildi."
                      : "Çağrınız ekibimizin el terminaline iletildi."}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600 pt-1">
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
                          ? "border-rose-500 bg-rose-50/70 text-rose-700 shadow-sm"
                          : "border-stone-100 bg-stone-50 text-stone-700 hover:border-stone-200"
                      }`}
                    >
                      <Bell className="w-6 h-6" />
                      <span className="font-bold text-sm">🔔 Garson Çağır</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType("bill")}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        requestType === "bill"
                          ? "border-rose-500 bg-rose-50/70 text-rose-700 shadow-sm"
                          : "border-stone-100 bg-stone-50 text-stone-700 hover:border-stone-200"
                      }`}
                    >
                      <CreditCard className="w-6 h-6" />
                      <span className="font-bold text-sm">💳 Hesap İste</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-2">
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
                                ? "bg-stone-900 text-white"
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
                      className="w-full h-11 px-3.5 rounded-xl bg-stone-100 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 h-12 rounded-xl bg-stone-100 text-stone-700 font-semibold text-sm hover:bg-stone-200 transition-colors"
                >
                  Kapat
                </button>
                {cooldownLeft === 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                    className="flex-[1.6] h-12 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-rose-500/25 hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
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
