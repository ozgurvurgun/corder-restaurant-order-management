import { useEffect, useState, type ReactNode } from "react"

export function BrowserRouter({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams) => void] {
  const [params, setParams] = useState(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  )

  useEffect(() => {
    const onPopState = () => {
      setParams(new URLSearchParams(window.location.search))
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const update = (next: URLSearchParams) => {
    if (typeof window !== "undefined") {
      const qs = next.toString()
      const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      window.history.pushState({}, "", nextUrl)
      setParams(new URLSearchParams(next.toString()))
    }
  }

  return [params, update]
}

