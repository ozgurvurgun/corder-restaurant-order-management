import { useSearchParams } from "react-router-dom"
import { MenuContent } from "@/components/menu-content"
import { resolveSlugFromLocation } from "@/lib/api"

export default function App() {
  const [searchParams] = useSearchParams()
  const restaurant = resolveSlugFromLocation(searchParams)
  const tableToken = searchParams.get("t")?.trim() || ""
  const templateOverride = searchParams.get("template")?.trim() || undefined
  return (
    <MenuContent
      slug={restaurant}
      tableToken={tableToken}
      templateOverride={templateOverride}
    />
  )
}
