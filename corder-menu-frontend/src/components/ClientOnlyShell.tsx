import { useState, useEffect, type ReactNode } from "react"

export function ClientOnlyShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white">
        <span className="text-gray-500 text-sm">Yükleniyor…</span>
      </div>
    )
  }

  return <>{children}</>
}
