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

export const uploadFile = (token: string, file: File) => {
  const form = new FormData()
  form.append("file", file)
  return request<{ url: string }>("/restaurant/upload", {
    method: "POST",
    token,
    body: form,
  })
}
