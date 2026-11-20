import { useState } from "react"
import {
  formatMenuPrice,
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

const TURKISH_CHAR_FOLD_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
}

export function normalizeSearchText(input: string | null | undefined): string {
  if (!input) return ""
  return input
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0307/g, "")
    .replace(/[çğıiöşüâîû]/g, (ch) => TURKISH_CHAR_FOLD_MAP[ch] ?? ch)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    const aCode = a.charCodeAt(i - 1)
    for (let j = 1; j <= n; j++) {
      const cost = aCode === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      )
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[n]
}

function maxAllowedDistance(tokenLength: number): number {
  if (tokenLength <= 2) return 0
  if (tokenLength <= 4) return 1
  if (tokenLength <= 7) return 2
  return 3
}

function scoreQueryTokenAgainstWords(qToken: string, words: string[], weight: number): number {
  if (!qToken || words.length === 0) return 0
  const maxDist = maxAllowedDistance(qToken.length)
  let best = 0

  for (const word of words) {
    if (!word) continue
    if (word === qToken) {
      best = Math.max(best, 100 * weight)
      break
    }
    if (word.startsWith(qToken)) {
      best = Math.max(best, 88 * weight)
      continue
    }
    if (word.includes(qToken)) {
      best = Math.max(best, 76 * weight)
      continue
    }
    if (maxDist === 0) continue

    const fullDist = levenshteinDistance(qToken, word)
    if (fullDist <= maxDist) {
      const sim = Math.max(10, 70 - fullDist * 18)
      best = Math.max(best, sim * weight)
    }

    if (word.length > qToken.length && qToken.length >= 3) {
      const prefix = word.slice(0, qToken.length)
      const prefixDist = levenshteinDistance(qToken, prefix)
      if (prefixDist <= Math.min(1, maxDist)) {
        const sim = Math.max(12, 66 - prefixDist * 18)
        best = Math.max(best, sim * weight)
      }
    }
  }
  return best
}

export function searchProductsWithLevenshtein(
  products: ProductDisplay[],
  rawQuery: string
): ProductDisplay[] {
  const normQuery = normalizeSearchText(rawQuery)
  if (!normQuery) return []
  const qTokens = normQuery.split(" ").filter(Boolean)
  if (qTokens.length === 0) return []
  const compactQuery = qTokens.join("")

  const scored: Array<{ product: ProductDisplay; score: number }> = []

  for (const product of products) {
    const normName = normalizeSearchText(product.name)
    const normDesc = normalizeSearchText(product.description)
    const nameWords = normName.split(" ").filter(Boolean)
    const descWords = normDesc.split(" ").filter(Boolean)
    const compactName = nameWords.join("")

    let totalScore = 0

    if (normName === normQuery || compactName === compactQuery) {
      totalScore += 300
    } else if (normName.startsWith(normQuery) || compactName.startsWith(compactQuery)) {
      totalScore += 220
    } else if (normName.includes(normQuery) || compactName.includes(compactQuery)) {
      totalScore += 170
    } else if (normDesc.includes(normQuery)) {
      totalScore += 110
    } else if (compactQuery.length >= 4 && compactName.length >= 3) {
      const compactDist = levenshteinDistance(
        compactQuery,
        compactName.slice(0, Math.max(compactQuery.length, Math.min(compactName.length, compactQuery.length + 2)))
      )
      if (compactDist <= maxAllowedDistance(compactQuery.length)) {
        totalScore += Math.max(40, 140 - compactDist * 30)
      }
    }

    let allTokensMatched = true
    let tokenScoreSum = 0
    for (const qToken of qTokens) {
      const nameTokenScore = scoreQueryTokenAgainstWords(qToken, nameWords, 1.0)
      const descTokenScore = scoreQueryTokenAgainstWords(qToken, descWords, 0.55)
      const bestTokenScore = Math.max(nameTokenScore, descTokenScore)
      if (bestTokenScore <= 0) {
        allTokensMatched = false
        break
      }
      tokenScoreSum += bestTokenScore
    }

    if (allTokensMatched) {
      totalScore += tokenScoreSum
    }

    if (totalScore > 0) {
      scored.push({ product, score: totalScore })
    }
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.product.name.localeCompare(b.product.name, "tr")
    })
    .map((entry) => entry.product)
}

export function ProductMetaTags(props: {
  product: Pick<MenuProduct, "calories" | "allergens">
  variant?: "classic" | "bistro" | "vibrant" | "editorial" | "noir"
  className?: string
}) {
  const { product, variant = "classic", className = "mt-2" } = props
  const hasCalories = typeof product.calories === "number" && product.calories > 0
  const allergens =
    Array.isArray(product.allergens) && product.allergens.length > 0
      ? product.allergens
      : null

  if (!hasCalories && !allergens) return null

  const calorieBadgeClass =
    variant === "noir"
      ? "bg-amber-400/10 text-amber-300 border-amber-400/25"
      : variant === "editorial"
        ? "bg-[#EAE2D3] text-[#8C2D19] border-[#8C2D19]/20 font-sans"
        : "bg-orange-50 text-orange-700 border-orange-200/80"

  const allergenBadgeClass =
    variant === "noir"
      ? "bg-white/[0.05] text-stone-300 border-white/10"
      : variant === "editorial"
        ? "bg-[#EFE9DC] text-[#57534E] border-[#1C1917]/15 font-sans"
        : "bg-amber-50/90 text-amber-800 border-amber-200/80"

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {hasCalories && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold leading-tight ${calorieBadgeClass}`}
        >
          {product.calories} kcal
        </span>
      )}
      {allergens?.map((allergen) => (
        <span
          key={allergen}
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium leading-tight ${allergenBadgeClass}`}
        >
          {allergen}
        </span>
      ))}
    </div>
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
        <div className="flex items-center">
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
            const imgUrl = resolveImageUrl(camp.imageUrl)
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
                      onError={() =>
                        setFailedImgs((prev) => ({ ...prev, [camp.id]: true }))
                      }
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center" />
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
