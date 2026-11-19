import { useState } from "react"
import { ConciergeBell, Sparkles } from "lucide-react"
import {
  applyCfImageFallback,
  formatMenuPrice,
  formatTitleCase,
  resolveImageUrl,
  type MenuCampaign,
  type MenuCategory,
  type MenuProduct,
  type MenuResponse,
  type MenuTableContext,
} from "@/lib/api"
import type { ProductDisplay } from "./menu-modals"

export interface MenuTemplateProps {
  business: MenuResponse
  logoUrl?: string
  logoFailed: boolean
  onLogoError: () => void
  verifiedTable: MenuTableContext | null
  activeCampaigns: MenuCampaign[]
  roots: MenuCategory[]
  activeRoot: MenuCategory | null
  hasTreeContent: boolean
  onSelectCategory: (categoryId: string, buttonEl?: HTMLButtonElement | null) => void
  onSelectProduct: (product: ProductDisplay) => void
  onOpenSearch: () => void
  onOpenCampaigns: (initialIndex?: number) => void
  onOpenWaiterCall: () => void
}

export function flattenMenuProducts(categories: MenuCategory[]): MenuProduct[] {
  const out: MenuProduct[] = []
  const walk = (nodes: MenuCategory[]) => {
    for (const node of nodes) {
      out.push(...node.products)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(categories)
  return out
}

export function categoryHasProducts(category: MenuCategory): boolean {
  if (category.products.length > 0) return true
  return (category.children ?? []).some(categoryHasProducts)
}

export function countCategoryProducts(category: MenuCategory): number {
  let count = category.products.length
  for (const child of category.children ?? []) {
    count += countCategoryProducts(child)
  }
  return count
}

export function TableSessionPill(props: {
  tableContext: MenuTableContext | null
  onOpenWaiterCall: () => void
  variant?: "classic" | "bistro" | "noir" | "editorial" | "vibrant"
}) {
  const { tableContext, onOpenWaiterCall, variant = "classic" } = props
  if (!tableContext) return null

  const sectionLabel = tableContext.sectionName
    ? formatTitleCase(tableContext.sectionName)
    : null

  const containerStyles =
    variant === "noir"
      ? "bg-white/[0.04] hover:bg-white/[0.08] border border-amber-400/25 text-[#F5F2EB] shadow-sm shadow-black/40"
      : variant === "editorial"
        ? "bg-[#EFE9DC] hover:bg-[#E5DEC9] border border-[#1C1917]/20 text-[#1C1917]"
        : variant === "vibrant"
          ? "bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white shadow-sm"
          : variant === "bistro"
            ? "bg-stone-900/[0.04] hover:bg-stone-900/[0.08] border border-stone-200/90 text-stone-800"
            : "bg-stone-100/90 hover:bg-stone-200/70 border border-stone-200/80 text-stone-800"

  const dotSeparatorClass =
    variant === "noir"
      ? "text-amber-400/60"
      : variant === "vibrant"
        ? "text-white/60"
        : "text-stone-400"

  const actionChipClass =
    variant === "noir"
      ? "text-amber-300 border-l border-white/10 pl-2 ml-1"
      : variant === "editorial"
        ? "text-[#8C2D19] border-l border-[#1C1917]/15 pl-2 ml-1"
        : variant === "vibrant"
          ? "text-white/95 border-l border-white/25 pl-2 ml-1"
          : "text-rose-600 border-l border-stone-300/70 pl-2 ml-1"

  return (
    <button
      type="button"
      onClick={onOpenWaiterCall}
      aria-label={`Masa ${tableContext.tableName}${sectionLabel ? ` (${sectionLabel})` : ""} — Garson Çağır`}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 cursor-pointer ${containerStyles}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
      <span className="font-semibold tracking-tight">Masa {tableContext.tableName}</span>
      {sectionLabel && (
        <>
          <span className={dotSeparatorClass} aria-hidden="true">
            •
          </span>
          <span className="opacity-85">{sectionLabel}</span>
        </>
      )}
      <span className={`inline-flex items-center gap-1 font-semibold ${actionChipClass}`}>
        <ConciergeBell className="w-3.5 h-3.5" />
        <span>Servis</span>
      </span>
    </button>
  )
}

export function ActiveCampaignsShowcaseStrip(props: {
  campaigns: MenuCampaign[]
  onSelectCampaign: (index: number) => void
  variant?: "light" | "dark"
}) {
  const { campaigns, onSelectCampaign, variant = "light" } = props
  const [failedImgs, setFailedImgs] = useState<Record<string, boolean>>({})

  if (campaigns.length === 0) return null

  const isDark = variant === "dark"

  return (
    <section aria-label="Öne Çıkan Kampanyalar" className="pt-2 pb-4">
      <div className="px-5 mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-rose-500"}`} />
          <h2
            className={`text-xs font-bold uppercase tracking-wider ${
              isDark ? "text-amber-300/90" : "text-stone-600"
            }`}
          >
            Aktif Kampanyalar ({campaigns.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onSelectCampaign(0)}
          className={`text-xs font-semibold ${
            isDark ? "text-amber-300 hover:underline" : "text-rose-600 hover:underline"
          }`}
        >
          Tümünü Gör
        </button>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-5">
          {campaigns.map((camp, idx) => {
            const imgUrl = resolveImageUrl(camp.imageUrl, { width: 420 })
            const hasDiscountPrice = camp.discountedPrice != null && camp.discountedPrice >= 0
            const hasOrigPrice = camp.originalPrice != null && camp.originalPrice > 0
            return (
              <button
                type="button"
                key={camp.id}
                onClick={() => onSelectCampaign(idx)}
                className={`group flex-shrink-0 w-64 rounded-2xl overflow-hidden border text-left transition-all active:scale-[0.98] ${
                  isDark
                    ? "bg-[#15151C] border-white/10 hover:border-amber-400/40"
                    : "bg-white border-stone-200/80 shadow-xs hover:shadow-md"
                }`}
              >
                <div className="relative h-28 bg-stone-200/60 overflow-hidden">
                  {imgUrl && !failedImgs[camp.id] ? (
                    <img
                      src={imgUrl}
                      alt={camp.title}
                      loading="lazy"
                      decoding="async"
                      onError={(e) =>
                        applyCfImageFallback(e.currentTarget, () =>
                          setFailedImgs((prev) => ({ ...prev, [camp.id]: true }))
                        )
                      }
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-rose-500/60" />
                    </div>
                  )}
                  {camp.discountPercent != null && camp.discountPercent > 0 && (
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 text-white text-[11px] font-bold shadow-sm">
                      %{camp.discountPercent} İndirim
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3
                    className={`font-bold text-sm truncate ${
                      isDark ? "text-[#F5F2EB]" : "text-stone-900"
                    }`}
                  >
                    {camp.title}
                  </h3>
                  {camp.description && (
                    <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">{camp.description}</p>
                  )}
                  {(hasDiscountPrice || hasOrigPrice) && (
                    <div className="flex items-baseline gap-2 mt-2">
                      {hasDiscountPrice && (
                        <span
                          className={`text-sm font-extrabold ${
                            isDark ? "text-amber-300" : "text-rose-600"
                          }`}
                        >
                          {formatMenuPrice(camp.discountedPrice!)} TL
                        </span>
                      )}
                      {hasOrigPrice && (
                        <span
                          className={
                            hasDiscountPrice
                              ? "text-xs text-stone-400 line-through"
                              : `text-sm font-bold ${isDark ? "text-[#F5F2EB]" : "text-stone-900"}`
                          }
                        >
                          {formatMenuPrice(camp.originalPrice!)} TL
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
