import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "primary"
}

type ConfirmFn = (input: string | ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

interface ActiveDialog extends Required<ConfirmOptions> {
  resolve: (confirmed: boolean) => void
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null)
  const activeRef = useRef<ActiveDialog | null>(null)

  const closeWith = useCallback((result: boolean) => {
    const current = activeRef.current
    activeRef.current = null
    setDialog(null)
    current?.resolve(result)
  }, [])

  const confirm = useCallback<ConfirmFn>((input) => {
    if (activeRef.current) {
      activeRef.current.resolve(false)
      activeRef.current = null
    }
    const opts: ConfirmOptions =
      typeof input === "string" ? { message: input } : input

    return new Promise<boolean>((resolve) => {
      const next: ActiveDialog = {
        title: opts.title ?? "İşlemi Onaylayın",
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? "Onayla",
        cancelLabel: opts.cancelLabel ?? "Vazgeç",
        variant: opts.variant ?? "danger",
        resolve,
      }
      activeRef.current = next
      setDialog(next)
    })
  }, [])

  useEffect(() => {
    if (!dialog) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        closeWith(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [dialog, closeWith])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="corder-confirm-title"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
          onClick={() => closeWith(false)}
        >
          <div
            className="rounded-2xl bg-white p-5 shadow-2xl border border-[#e5e5ea] max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                  dialog.variant === "danger"
                    ? "bg-[#e63462]/10 text-[#e63462]"
                    : "bg-[#1d1d1f]/10 text-[#1d1d1f]"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="corder-confirm-title"
                  className="text-[15px] font-semibold text-[#1d1d1f] leading-snug"
                >
                  {dialog.title}
                </h3>
                <p className="mt-1.5 text-[13px] text-[#86868b] leading-relaxed">
                  {dialog.message}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeWith(false)}
                className="h-9 rounded-xl border border-[#d1d1d6] bg-white px-4 text-[12px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
              >
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => closeWith(true)}
                className={`h-9 rounded-xl px-4 text-[12px] font-semibold text-white shadow-sm transition-colors ${
                  dialog.variant === "danger"
                    ? "bg-[#e63462] hover:bg-[#d42d56]"
                    : "bg-[#1d1d1f] hover:bg-black/85"
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider")
  }
  return ctx
}
