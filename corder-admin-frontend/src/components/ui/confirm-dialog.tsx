import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { AlertTriangle, ShieldAlert } from "lucide-react"

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning" | "primary"
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>

const ConfirmDialogContext = createContext<ConfirmFn | null>(null)

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((result: boolean) => void) | null>(null)

  const settle = useCallback((result: boolean) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setDialog(null)
    if (resolve) resolve(result)
  }, [])

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized: ConfirmOptions =
      typeof opts === "string" ? { message: opts } : opts
    if (resolverRef.current) {
      resolverRef.current(false)
    }
    setDialog(normalized)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  useEffect(() => {
    if (!dialog) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dialog, settle])

  const variant = dialog?.variant ?? "danger"
  const isDanger = variant === "danger"
  const isWarning = variant === "warning"

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
          onClick={() => settle(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isDanger
                    ? "bg-red-50 text-red-600"
                    : isWarning
                      ? "bg-amber-50 text-amber-600"
                      : "bg-[#fef3f5] text-[#e63462]"
                }`}
              >
                {isDanger ? (
                  <ShieldAlert className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  {dialog.title ?? "İşlemi Onayla"}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#636366]">
                  {dialog.message}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="h-9 rounded-xl border border-[#d1d1d6] bg-white px-4 text-[12px] font-medium text-[#636366] hover:bg-[#f5f5f7] cursor-pointer"
              >
                {dialog.cancelLabel ?? "Vazgeç"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={`h-9 rounded-xl px-4 text-[12px] font-semibold text-white cursor-pointer ${
                  isDanger
                    ? "bg-red-600 hover:bg-red-700"
                    : isWarning
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-[#e63462] hover:bg-[#d42d56]"
                }`}
              >
                {dialog.confirmLabel ?? "Onayla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider")
  }
  return ctx
}
