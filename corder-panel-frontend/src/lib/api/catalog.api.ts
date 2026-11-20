import { request } from "./http-client"
import type {
  CampaignDto,
  CategoryDto,
  CreateProductBody,
  ProductDto,
  UpdateProductBody,
} from "./api-types"

export const categoriesApi = {
  list: (token: string) =>
    request<CategoryDto[]>("/restaurant/categories", { token }),
  create: (
    token: string,
    body: {
      name: string
      showInTerminal?: boolean
      showInMenu?: boolean
      showInQuickSale?: boolean
      parentId?: string | null
    },
  ) =>
    request<CategoryDto>("/restaurant/categories", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  update: (
    token: string,
    id: string,
    body: {
      name?: string
      showInTerminal?: boolean
      showInMenu?: boolean
      showInQuickSale?: boolean
      parentId?: string | null
    },
  ) =>
    request<CategoryDto>(`/restaurant/categories/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    }),
  delete: (token: string, id: string) =>
    request<void>(`/restaurant/categories/${id}`, { method: "DELETE", token }),
  reorder: (token: string, body: { ids: string[]; parentId?: string | null }) =>
    request<CategoryDto[]>("/restaurant/categories/reorder", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
}

export const productsApi = {
  list: (token: string) =>
    request<ProductDto[]>("/restaurant/products", { token }),
  create: (token: string, body: CreateProductBody) =>
    request<ProductDto>("/restaurant/products", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  update: (token: string, id: string, body: UpdateProductBody) =>
    request<ProductDto>(`/restaurant/products/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    }),
  delete: (token: string, id: string) =>
    request<void>(`/restaurant/products/${id}`, { method: "DELETE", token }),
  reorder: (token: string, ids: string[]) =>
    request<ProductDto[]>("/restaurant/products/reorder", {
      method: "POST",
      token,
      body: JSON.stringify({ ids }),
    }),
}

export const campaignsApi = {
  list: (token: string) =>
    request<CampaignDto[]>("/restaurant/campaigns", { token }),
  create: (
    token: string,
    body: {
      title: string
      description?: string
      imageUrl: string
      discountPercent?: number
      originalPrice?: number
      discountedPrice?: number
      validUntil?: string
      isActive?: boolean
    },
  ) =>
    request<CampaignDto>("/restaurant/campaigns", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  update: (
    token: string,
    id: string,
    body: {
      title?: string
      description?: string
      imageUrl?: string
      discountPercent?: number
      originalPrice?: number
      discountedPrice?: number
      validUntil?: string
      isActive?: boolean
    },
  ) =>
    request<CampaignDto>(`/restaurant/campaigns/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    }),
  delete: (token: string, id: string) =>
    request<void>(`/restaurant/campaigns/${id}`, {
      method: "DELETE",
      token,
    }),
  reorder: (token: string, ids: string[]) =>
    request<CampaignDto[]>("/restaurant/campaigns/reorder", {
      method: "POST",
      token,
      body: JSON.stringify({ ids }),
    }),
}

export interface ImageOptimizeOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

export async function optimizeImageForUpload(
  file: File,
  options?: ImageOptimizeOptions,
): Promise<File> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !file.type.startsWith("image/") ||
    file.type === "image/gif"
  ) {
    return file
  }

  const maxWidth = options?.maxWidth ?? 1200
  const maxHeight = options?.maxHeight ?? 1200
  const quality = options?.quality ?? 0.82

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let targetW = img.naturalWidth || img.width
      let targetH = img.naturalHeight || img.height
      if (!targetW || !targetH) {
        resolve(file)
        return
      }

      const needsResize = targetW > maxWidth || targetH > maxHeight
      if (needsResize) {
        const ratio = Math.min(maxWidth / targetW, maxHeight / targetH)
        targetW = Math.max(1, Math.round(targetW * ratio))
        targetH = Math.max(1, Math.round(targetH * ratio))
      }

      const canvas = document.createElement("canvas")
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, targetW, targetH)

      const baseName = file.name.replace(/\.[^.]+$/, "") || "image"
      canvas.toBlob(
        (blob) => {
          if (!blob || (blob.type !== "image/webp" && blob.type !== "image/jpeg")) {
            resolve(file)
            return
          }
          if (!needsResize && blob.size >= file.size) {
            resolve(file)
            return
          }
          const ext = blob.type === "image/webp" ? ".webp" : ".jpg"
          resolve(
            new File([blob], `${baseName}${ext}`, {
              type: blob.type,
              lastModified: Date.now(),
            }),
          )
        },
        "image/webp",
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}

export const uploadFile = async (token: string, file: File) => {
  const optimized = await optimizeImageForUpload(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.82,
  })
  const form = new FormData()
  form.append("file", optimized)
  return request<{ url: string }>("/restaurant/upload", {
    method: "POST",
    token,
    body: form,
  })
}
