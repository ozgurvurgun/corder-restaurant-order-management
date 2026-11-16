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
  type ReactElement,
  type ReactNode,
} from "react"

interface RouterContextValue {
  pathname: string
  navigate: (to: string, opts?: { replace?: boolean }) => void
  params: Record<string, string | undefined>
  outlet: ReactNode
}

const RouterContext = createContext<RouterContextValue>({
  pathname: "/",
  navigate: () => {},
  params: {},
  outlet: null,
})

export function BrowserRouter({ children }: { children?: ReactNode }) {
  const [pathname, setPathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname || "/" : "/"
  )

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname || "/")
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (typeof window === "undefined") return
    if (opts?.replace) {
      window.history.replaceState({}, "", to)
    } else {
      window.history.pushState({}, "", to)
    }
    setPathname(to)
  }, [])

  const value = useMemo(
    () => ({ pathname, navigate, params: {}, outlet: null }),
    [pathname, navigate]
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useNavigate() {
  return useContext(RouterContext).navigate
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
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
): { matched: boolean; params: Record<string, string>; restPath: string } {
  if (pattern === "*") {
    return { matched: true, params: {}, restPath: "" }
  }
  const patSegs = normalizeSegments(pattern)
  const urlSegs = normalizeSegments(targetPath)
  if (exact && patSegs.length !== urlSegs.length) {
    return { matched: false, params: {}, restPath: "" }
  }
  if (!exact && urlSegs.length < patSegs.length) {
    return { matched: false, params: {}, restPath: "" }
  }
  const params: Record<string, string> = {}
  for (let i = 0; i < patSegs.length; i++) {
    const p = patSegs[i]
    const u = urlSegs[i]
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(u)
    } else if (p !== u) {
      return { matched: false, params: {}, restPath: "" }
    }
  }
  const restSegs = urlSegs.slice(patSegs.length)
  return {
    matched: true,
    params,
    restPath: "/" + restSegs.join("/"),
  }
}

export function Routes({ children }: { children?: ReactNode }) {
  const ctx = useContext(RouterContext)
  const routeElements = Children.toArray(children).filter(
    isValidElement
  ) as Array<ReactElement<RouteProps>>

  for (const routeEl of routeElements) {
    const { path = "/", element, children: nestedChildren } = routeEl.props
    const hasNested = Children.count(nestedChildren) > 0

    if (!hasNested) {
      const m = matchPath(path, ctx.pathname, true)
      if (m.matched) {
        return (
          <RouterContext.Provider
            value={{ ...ctx, params: { ...ctx.params, ...m.params } }}
          >
            {element}
          </RouterContext.Provider>
        )
      }
    } else {
      const parentMatch = matchPath(path, ctx.pathname, false)
      if (parentMatch.matched) {
        const nestedRoutes = Children.toArray(nestedChildren).filter(
          isValidElement
        ) as Array<ReactElement<RouteProps>>

        let matchedOutlet: ReactNode = null
        let nestedParams: Record<string, string> = {}

        for (const childRoute of nestedRoutes) {
          if (childRoute.props.index) {
            if (parentMatch.restPath === "/" || parentMatch.restPath === "") {
              matchedOutlet = childRoute.props.element
              break
            }
          } else if (childRoute.props.path) {
            const cm = matchPath(
              childRoute.props.path,
              parentMatch.restPath,
              true
            )
            if (cm.matched) {
              matchedOutlet = childRoute.props.element
              nestedParams = cm.params
              break
            }
          }
        }

        if (matchedOutlet !== null) {
          return (
            <RouterContext.Provider
              value={{
                ...ctx,
                params: { ...ctx.params, ...parentMatch.params, ...nestedParams },
                outlet: matchedOutlet,
              }}
            >
              {element}
            </RouterContext.Provider>
          )
        }
      }
    }
  }

  return null
}

export function Link({
  to,
  children,
  onClick,
  ...rest
}: { to: string; children?: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const navigate = useNavigate()
  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) {
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
  children?: ReactNode
}) {
  const { pathname, navigate } = useContext(RouterContext)
  const isActive = end
    ? pathname === to
    : pathname === to || pathname.startsWith(to + "/")
  const resolvedClass =
    typeof className === "function" ? className({ isActive }) : className

  return (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault()
        navigate(to)
      }}
      className={resolvedClass}
    >
      {children}
    </a>
  )
}

