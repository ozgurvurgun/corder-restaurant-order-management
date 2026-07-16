import { useState, useEffect, type ReactNode } from "react"

export function ClientOnlyShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="min-h-dvh bg-[#0f0f0f] flex items-center justify-center" suppressHydrationWarning>
        <span className="text-zinc-500 text-sm">Yükleniyor…</span>
      </div>
    )
  }

  return <>{children}</>
}
