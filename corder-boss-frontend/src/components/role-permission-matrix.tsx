import type { PermissionCatalogResponse } from "@/lib/types"
import {
  getCategoryLabel,
  getOrderedCatalogCategories,
  getPermissionLabel,
} from "@/lib/permission-labels"
import { AlertCircle, Check, Search } from "lucide-react"

interface RolePermissionMatrixProps {
  catalog: PermissionCatalogResponse | null
  draftPermissions: string[]
  searchQuery: string
  onSearchChange: (q: string) => void
  onTogglePermission: (key: string) => void
  onToggleCategoryAll: (cat: string) => void
}

export function RolePermissionMatrix({
  catalog,
  draftPermissions,
  searchQuery,
  onSearchChange,
  onTogglePermission,
  onToggleCategoryAll,
}: RolePermissionMatrixProps) {
  const orderedCategories = getOrderedCatalogCategories(catalog)

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Yetki ara (örn: masa taşıma, iskonto, iptal, vardiya, fiyat)..."
          className="h-11 w-full rounded-2xl border border-[#d1d1d6]/70 bg-white pl-10 pr-4 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
        />
      </div>

      {catalog &&
        orderedCategories.map((catKey) => {
          const catMeta = getCategoryLabel(catKey, catalog.categories?.[catKey])
          const items = catalog.permissions.filter((p) => {
            if (p.category !== catKey) return false
            if (!searchQuery.trim()) return true
            const q = searchQuery.toLowerCase()
            const localized = getPermissionLabel(p.key, p)
            return (
              localized.title.toLowerCase().includes(q) ||
              localized.description.toLowerCase().includes(q) ||
              p.title.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q) ||
              p.key.toLowerCase().includes(q)
            )
          })
          if (items.length === 0) return null
          const enabledCount = items.filter((i) =>
            draftPermissions.includes(i.key)
          ).length

          return (
            <div
              key={catKey}
              className="rounded-2xl border border-[#d1d1d6]/60 bg-white overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[#f0f0f0] bg-[#f9f9fb] px-4 py-3">
                <div>
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f]">
                    {catMeta.title}
                  </h4>
                  <p className="text-[11px] text-[#86868b]">
                    {catMeta.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleCategoryAll(catKey)}
                  className="flex-shrink-0 rounded-xl border border-[#d1d1d6] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                >
                  {enabledCount === items.length ? "Tümünü Kaldır" : "Tümünü Seç"} (
                  {enabledCount}/{items.length})
                </button>
              </div>

              <div className="divide-y divide-[#f0f0f0]">
                {items.map((perm) => {
                  const checked = draftPermissions.includes(perm.key)
                  const localized = getPermissionLabel(perm.key, perm)
                  return (
                    <div
                      key={perm.key}
                      onClick={() => onTogglePermission(perm.key)}
                      className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors ${
                        checked ? "bg-[#e63462]/[0.03]" : "hover:bg-[#f9f9fb]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-[#1d1d1f]">
                            {localized.title}
                          </span>
                          {perm.isCritical && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              <AlertCircle className="h-2.5 w-2.5" /> Kritik
                            </span>
                          )}
                          <span className="rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-medium text-[#86868b]">
                            {perm.scope === "both"
                              ? "Terminal + Panel"
                              : perm.scope === "terminal"
                                ? "Terminal"
                                : "Panel"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#86868b] leading-snug">
                          {localized.description}
                        </p>
                      </div>

                      <div
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border transition-colors ${
                          checked
                            ? "border-[#e63462] bg-[#e63462] text-white"
                            : "border-[#d1d1d6] bg-white"
                        }`}
                      >
                        {checked && <Check className="h-4 w-4" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
    </>
  )
}
