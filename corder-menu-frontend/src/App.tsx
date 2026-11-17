import { Suspense } from "react"
import { useSearchParams } from "react-router-dom"
import { ClientOnlyShell } from "@/components/ClientOnlyShell"
import { MenuContent } from "@/components/menu-content"

function resolveSlugFromLocation(searchParams: URLSearchParams): string {
  const fromRestaurant = searchParams.get("restaurant")?.trim()
  if (fromRestaurant) return fromRestaurant
  const fromSlug = searchParams.get("slug")?.trim()
  if (fromSlug) return fromSlug

  if (typeof window !== "undefined") {
    const segments = window.location.pathname
      .split("/")
      .map((s) => decodeURIComponent(s.trim()))
      .filter((s) => Boolean(s) && s !== "index.html")
    if (segments.length >= 2 && (segments[0] === "menu" || segments[0] === "m" || segments[0] === "r" || segments[0] === "business")) {
      return segments[1]
    }
    if (segments.length === 1 && segments[0] !== "menu") {
      return segments[0]
    }
  }
  return ""
}

function MenuWithQuery() {
  const [searchParams] = useSearchParams()
  const restaurant = resolveSlugFromLocation(searchParams)
  return <MenuContent slug={restaurant} />
}

export default function App() {
  return (
    <ClientOnlyShell>
      <Suspense
        fallback={
          <div className="min-h-dvh bg-stone-50 flex items-center justify-center">
            <div className="animate-pulse text-stone-400">Yükleniyor...</div>
          </div>
        }
      >
        <MenuWithQuery />
      </Suspense>
    </ClientOnlyShell>
  )
}
