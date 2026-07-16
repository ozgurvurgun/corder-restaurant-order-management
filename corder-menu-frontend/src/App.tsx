import { Suspense } from "react"
import { useSearchParams } from "react-router-dom"
import { ClientOnlyShell } from "@/components/ClientOnlyShell"
import { MenuContent } from "@/components/menu-content"

function MenuWithQuery() {
  const [searchParams] = useSearchParams()
  const restaurant = searchParams.get("restaurant") ?? ""
  return <MenuContent slug={restaurant} />
}

export default function App() {
  return (
    <ClientOnlyShell>
      <Suspense
        fallback={
          <div className="min-h-dvh bg-stone-50 flex items-center justify-center">
            <div className="animate-pulse text-stone-400">Yukleniyor...</div>
          </div>
        }
      >
        <MenuWithQuery />
      </Suspense>
    </ClientOnlyShell>
  )
}
