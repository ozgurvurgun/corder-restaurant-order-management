export interface CloudflareImageOptions {
  width?: number
  height?: number
  quality?: number
  fit?: "cover" | "contain" | "scale-down"
}

/**
 * Formats an R2 / CDN image URL to use Cloudflare Image Transformations
 * (`/cdn-cgi/image/...`). Use alongside an `onError` fallback to `rawUrl`
 * so images load seamlessly even in local dev or zones without transformations.
 */
export function formatCloudflareImageUrl(
  rawUrl?: string | null,
  options: CloudflareImageOptions = {}
): string | null {
  if (!rawUrl) return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.includes("/cdn-cgi/image/")
  ) {
    return trimmed
  }

  const width = options.width ?? 160
  const height = options.height ?? 160
  const quality = options.quality ?? 82
  const fit = options.fit ?? "cover"
  const params = `width=${width},height=${height},fit=${fit},quality=${quality},format=auto`

  try {
    const parsed = new URL(trimmed)
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.protocol !== "https:"
    ) {
      return trimmed
    }
    return `${parsed.origin}/cdn-cgi/image/${params}${parsed.pathname}${parsed.search}`
  } catch {
    if (trimmed.startsWith("/")) {
      return `/cdn-cgi/image/${params}${trimmed}`
    }
    return trimmed
  }
}
