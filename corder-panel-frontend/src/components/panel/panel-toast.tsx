import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"

type ToastType = "success" | "error" | "info" | "warning"

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function usePanelToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("usePanelToast must be used within PanelToastProvider")
  return ctx
}

let toastId = 0

export function PanelToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = "success", duration: number = 3000) => {
    const id = `toast-${++toastId}`
    setToasts((prev) => [...prev, { id, message, type, duration }])
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-5 w-5 text-[#34c759]" />
      case "error": return <AlertCircle className="h-5 w-5 text-[#ff3b30]" />
      case "warning": return <AlertTriangle className="h-5 w-5 text-[#ff9500]" />
      case "info": return <Info className="h-5 w-5 text-[#007aff]" />
    }
  }

  const getBgColor = (type: ToastType) => {
    switch (type) {
      case "success": return "bg-[#34c759]/10 border-[#34c759]/30"
      case "error": return "bg-[#ff3b30]/10 border-[#ff3b30]/30"
      case "warning": return "bg-[#ff9500]/10 border-[#ff9500]/30"
      case "info": return "bg-[#007aff]/10 border-[#007aff]/30"
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg 
              backdrop-blur-xl bg-white/90 min-w-[300px] max-w-[400px]
              animate-in slide-in-from-right-5 fade-in duration-200
              ${getBgColor(toast.type)}
            `}
          >
            {getIcon(toast.type)}
            <p className="flex-1 text-[14px] font-medium text-[#1d1d1f]">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-black/5 rounded-md transition-colors"
            >
              <X className="h-4 w-4 text-[#86868b]" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
