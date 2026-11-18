import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react"

export interface LocationState {
  pathname: string
  search: string
  hash: string
}

interface RouterContextValue {
  pathname: string
  search: string
  hash: string
  navigate: (to: string, opts?: { replace?: boolean }) => void
  params: Record<string, string | undefined>
  outlet: ReactNode
}

function normalizePathname(raw: string): string {
  if (!raw) return "/"
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`
  if (withLeading.length > 1 && withLeading.endsWith("/")) {
    return withLeading.replace(/\/+$/, "") || "/"
  }
  return withLeading
}

function parseUrlTarget(to: string): LocationState {
  let pathPart = to || "/"
  let hash = ""
  const hashIdx = pathPart.indexOf("#")
  if (hashIdx >= 0) {
    hash = pathPart.slice(hashIdx)
    pathPart = pathPart.slice(0, hashIdx)
  }
  let search = ""
  const searchIdx = pathPart.indexOf("?")
  if (searchIdx >= 0) {
    search = pathPart.slice(searchIdx)
    pathPart = pathPart.slice(0, searchIdx)
  }
  return {
    pathname: normalizePathname(pathPart || "/"),
    search,
    hash,
  }
}

function readWindowLocation(): LocationState {
  if (typeof window === "undefined") {
    return { pathname: "/", search: "", hash: "" }
  }
  return {
    pathname: normalizePathname(window.location.pathname || "/"),
    search: window.location.search || "",
    hash: window.location.hash || "",
  }
}

const RouterContext = createContext<RouterContextValue>({
  pathname: "/",
  search: "",
  hash: "",
  navigate: () => {},
  params: {},
  outlet: null,
})

export function BrowserRouter({ children }: { children?: ReactNode }) {
  const [loc, setLoc] = useState<LocationState>(readWindowLocation)

  useEffect(() => {
    const onPopState = () => setLoc(readWindowLocation())
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (typeof window === "undefined") return
    const parsed = parseUrlTarget(to)
    const fullUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`
    if (opts?.replace) {
      window.history.replaceState({}, "", fullUrl)
    } else {
      window.history.pushState({}, "", fullUrl)
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior })
    }
    setLoc(parsed)
  }, [])

  const value = useMemo<RouterContextValue>(
    () => ({
      pathname: loc.pathname,
      search: loc.search,
      hash: loc.hash,
      navigate,
      params: {},
      outlet: null,
    }),
    [loc, navigate]
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useNavigate() {
  return useContext(RouterContext).navigate
}

export function useLocation(): LocationState {
  const { pathname, search, hash } = useContext(RouterContext)
  return useMemo(() => ({ pathname, search, hash }), [pathname, search, hash])
}

export function useParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): T {
  return useContext(RouterContext).params as T
}

export function Outlet() {
  return <>{useContext(RouterContext).outlet}</>
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to, { replace })
  }, [navigate, to, replace])
  return null
}

export interface RouteProps {
  path?: string
  index?: boolean
  element?: ReactNode
  children?: ReactNode
}

export function Route(_props: RouteProps): ReactElement | null {
  return null
}

function normalizeSegments(p: string): string[] {
  return p.split("/").filter(Boolean)
}

function matchPath(
  pattern: string,
  targetPath: string,
  exact: boolean
): {
  matched: boolean
  score: number
  params: Record<string, string>
  restPath: string
} {
  if (pattern === "*") {
    return { matched: true, score: 1, params: {}, restPath: "" }
  }
  const patSegs = normalizeSegments(pattern)
  const urlSegs = normalizeSegments(targetPath)
  if (exact && patSegs.length !== urlSegs.length) {
    return { matched: false, score: 0, params: {}, restPath: "" }
  }
  if (!exact && urlSegs.length < patSegs.length) {
    return { matched: false, score: 0, params: {}, restPath: "" }
  }
  const params: Record<string, string> = {}
  let score = patSegs.length === 0 ? 10 : 0
  for (let i = 0; i < patSegs.length; i++) {
    const p = patSegs[i]
    const u = urlSegs[i]
    if (p.startsWith(":")) {
      try {
        params[p.slice(1)] = decodeURIComponent(u)
      } catch {
        params[p.slice(1)] = u
      }
      score += 20
    } else if (p === u) {
      score += 100
    } else {
      return { matched: false, score: 0, params: {}, restPath: "" }
    }
  }
  const restSegs = urlSegs.slice(patSegs.length)
  return {
    matched: true,
    score,
    params,
    restPath: "/" + restSegs.join("/"),
  }
}

function resolveRouteList(
  routeElements: Array<ReactElement<RouteProps>>,
  targetPath: string,
  parentCtx: RouterContextValue
): { element: ReactNode; score: number } | null {
  let bestMatch: { element: ReactNode; score: number } | null = null

  for (const routeEl of routeElements) {
    const { path = "/", index, element, children: nestedChildren } = routeEl.props
    const nestedRoutes = Children.toArray(nestedChildren).filter(
      isValidElement
    ) as Array<ReactElement<RouteProps>>
    const hasNested = nestedRoutes.length > 0

    if (index) {
      if (targetPath === "/" || targetPath === "") {
        const candidateScore = 150
        if (!bestMatch || candidateScore > bestMatch.score) {
          bestMatch = { element, score: candidateScore }
        }
      }
      continue
    }

    if (!hasNested) {
      const m = matchPath(path, targetPath, true)
      if (m.matched && (!bestMatch || m.score > bestMatch.score)) {
        bestMatch = {
          score: m.score,
          element: (
            <RouterContext.Provider
              value={{ ...parentCtx, params: { ...parentCtx.params, ...m.params } }}
            >
              {element}
            </RouterContext.Provider>
          ),
        }
      }
    } else {
      const parentMatch = matchPath(path, targetPath, false)
      if (parentMatch.matched) {
        const nextCtx: RouterContextValue = {
          ...parentCtx,
          params: { ...parentCtx.params, ...parentMatch.params },
        }
        const childResolved = resolveRouteList(
          nestedRoutes,
          parentMatch.restPath,
          nextCtx
        )
        if (childResolved) {
          const totalScore = parentMatch.score + childResolved.score
          if (!bestMatch || totalScore > bestMatch.score) {
            bestMatch = {
              score: totalScore,
              element: (
                <RouterContext.Provider
                  value={{
                    ...nextCtx,
                    outlet: childResolved.element,
                  }}
                >
                  {element}
                </RouterContext.Provider>
              ),
            }
          }
        }
      }
    }
  }

  return bestMatch
}

export function Routes({ children }: { children?: ReactNode }) {
  const ctx = useContext(RouterContext)
  const routeElements = Children.toArray(children).filter(
    isValidElement
  ) as Array<ReactElement<RouteProps>>

  const resolved = resolveRouteList(routeElements, ctx.pathname, ctx)
  return resolved ? <>{resolved.element}</> : null
}

function isModifiedClick(
  e: MouseEvent<HTMLAnchorElement>,
  target?: string
): boolean {
  return (
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey ||
    e.button !== 0 ||
    (Boolean(target) && target !== "_self")
  )
}

export function Link({
  to,
  children,
  onClick,
  target,
  ...rest
}: { to: string; children?: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  const navigate = useNavigate()
  return (
    <a
      href={to}
      target={target}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented && !isModifiedClick(e, target)) {
          e.preventDefault()
          navigate(to)
        }
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

export function NavLink({
  to,
  end,
  className,
  children,
}: {
  to: string
  end?: boolean
  className?: string | ((props: { isActive: boolean }) => string)
  children?: ReactNode | ((props: { isActive: boolean }) => ReactNode)
}) {
  const { pathname, navigate } = useContext(RouterContext)
  const targetPathname = parseUrlTarget(to).pathname
  const isActive = end
    ? pathname === targetPathname
    : pathname === targetPathname || pathname.startsWith(targetPathname + "/")
  const resolvedClass =
    typeof className === "function" ? className({ isActive }) : className
  const resolvedChildren =
    typeof children === "function" ? children({ isActive }) : children

  return (
    <a
      href={to}
      aria-current={isActive ? "page" : undefined}
      onClick={(e) => {
        if (!isModifiedClick(e)) {
          e.preventDefault()
          navigate(to)
        }
      }}
      className={resolvedClass}
    >
      {resolvedChildren}
    </a>
  )
}
