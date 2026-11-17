import type { ReactNode } from "react"

export function ClientOnlyShell({ children }: { children: ReactNode }) {
  return <>{children}</>
}
