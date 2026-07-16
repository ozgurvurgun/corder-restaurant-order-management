import { createContext, useContext, useState, useCallback, useRef } from "react"
import { Check, X as XIcon, Info } from "lucide-react"

type ToastType = "success" | "error" | "info"

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function IOSToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-[9999] pointer-events-none flex flex-col items-center gap-2 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-ios-toast pointer-events-auto"
          >
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg backdrop-blur-2xl text-[14px] font-medium ${
                t.type === "success"
                  ? "bg-foreground/85 text-background"
                  : t.type === "error"
                    ? "bg-red-600/90 text-white"
                    : "bg-foreground/85 text-background"
              }`}
            >
              {t.type === "success" && <Check className="h-4 w-4 flex-shrink-0" strokeWidth={3} />}
              {t.type === "error" && <XIcon className="h-4 w-4 flex-shrink-0" strokeWidth={3} />}
              {t.type === "info" && <Info className="h-4 w-4 flex-shrink-0" strokeWidth={3} />}
              <span className="truncate max-w-[260px]">{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
