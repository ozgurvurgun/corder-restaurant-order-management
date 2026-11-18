import { ChevronLeft, ChevronRight } from "lucide-react"

export interface PaginationBarProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  itemLabel?: string
  className?: string
}

function buildPageNumbers(current: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages: Array<number | "ellipsis"> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)

  if (start > 2) pages.push("ellipsis")
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < totalPages - 1) pages.push("ellipsis")

  pages.push(totalPages)
  return pages
}

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = "kayıt",
  className = "",
}: PaginationBarProps) {
  if (totalItems <= 0) return null

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const rangeStart = (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(totalItems, safePage * pageSize)
  const pages = buildPageNumbers(safePage, totalPages)

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#f0f0f0] bg-[#fafafa]/80 text-[12px] text-[#636366] ${className}`}
    >
      <div className="font-medium tabular-nums">
        Toplam <span className="font-semibold text-[#1d1d1f]">{totalItems}</span> {itemLabel} içinden{" "}
        <span className="font-semibold text-[#1d1d1f]">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        arası gösteriliyor
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#e5e5ea] bg-white px-2.5 text-[12px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          aria-label="Önceki Sayfa"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Önceki</span>
        </button>

        <div className="flex items-center gap-1">
          {pages.map((p, idx) =>
            p === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-[12px] text-[#86868b] select-none"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-[12px] font-semibold tabular-nums transition-colors cursor-pointer ${
                  p === safePage
                    ? "bg-[#e63462] text-white shadow-xs"
                    : "border border-[#e5e5ea] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#e5e5ea] bg-white px-2.5 text-[12px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          aria-label="Sonraki Sayfa"
        >
          <span className="hidden sm:inline">Sonraki</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
