const getBase = () => (import.meta.env.VITE_API_URL ?? "")

export interface MenuProduct {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  inStock: boolean
}

export interface MenuCategory {
  id: string
  name: string
  slug: string
  products: MenuProduct[]
  children?: MenuCategory[]
}

export interface MenuCampaign {
  id: string
  title: string
  description?: string
  imageUrl: string
  discountPercent?: number
  originalPrice?: number
  discountedPrice?: number
  validUntil?: string
  isActive: boolean
}

export interface MenuResponse {
  id: string
  name: string
  slug: string
  address?: string
  phone?: string
  email?: string
  workingHours?: string
  logo?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  website?: string
  categories: MenuCategory[]
  campaigns: MenuCampaign[]
}

export function resolveImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  const base = getBase()
  if (!base) return url
  const path = url.startsWith("/") ? url : `/${url}`
  return `${base.replace(/\/$/, "")}${path}`
}

export async function fetchMenu(restaurant: string): Promise<MenuResponse> {
  const base = getBase()
  if (!base) throw new Error("VITE_API_URL is not set")
  const q = encodeURIComponent(restaurant.trim())
  const res = await fetch(`${base}/menu?restaurant=${q}`)
  if (!res.ok) {
    const text = await res.text()
    let message = text
    try {
      const j = JSON.parse(text)
      message = j.message ?? text
    } catch {
      // ignore
    }
    throw new Error(message || "Menu yüklenemedi")
  }
  return res.json()
}
