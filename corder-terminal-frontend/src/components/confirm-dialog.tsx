import { useEffect } from "react"

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Evet",
  cancelText = "Vazgeç",
  onConfirm,
  onCancel,
  loading = false,
  destructive = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-[2px]">
      <div className="w-full max-w-md px-2 pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),16px)]">
        {/* iOS Action Sheet style */}
        <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-200 flex flex-col gap-2">
          {/* Content card */}
          <div className="bg-card/95 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 pt-5 pb-4 text-center">
              <h3 className="text-[16px] font-semibold text-card-foreground">{title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-1.5">{message}</p>
            </div>
            <div className="border-t border-border">
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`w-full py-[12px] text-[17px] font-semibold transition-colors active:bg-muted/50 disabled:opacity-50 ${
                  destructive ? "text-destructive" : "text-[#e63462]"
                }`}
              >
                {loading ? "İşleniyor..." : confirmText}
              </button>
            </div>
          </div>

          {/* Cancel button - separate card iOS style */}
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full bg-card/95 backdrop-blur-xl rounded-2xl py-[12px] text-[17px] font-semibold text-[#e63462] shadow-xl active:bg-card/80 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  )
}
