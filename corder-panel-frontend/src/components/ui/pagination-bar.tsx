import { ChevronLeft, ChevronRight } from "lucide-react"

export interface PaginationBarProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  itemLabel?: string
  className?: string
}

function buildPageNumbers(
  current: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages: Array<number | "ellipsis"> = [1]
  if (current > 3) {
    pages.push("ellipsis")
  }
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  for (let p = start; p <= end; p++) {
    pages.push(p)
  }
  if (current < totalPages - 2) {
    pages.push("ellipsis")
  }
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
  const startIdx = (safePage - 1) * pageSize + 1
  const endIdx = Math.min(totalItems, safePage * pageSize)
  const pageNumbers = buildPageNumbers(safePage, totalPages)

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2.5 border-t border-[#f0f0f0] pt-3 mt-3 ${className}`}
    >
      <p className="text-[11px] text-[#86868b] tabular-nums">
        Toplam{" "}
        <span className="font-semibold text-[#1d1d1f]">{totalItems}</span>{" "}
        {itemLabel}
        {totalItems > pageSize && (
          <>
            {" "}
            •{" "}
            <span className="font-medium text-[#1d1d1f]">
              {startIdx}–{endIdx}
            </span>{" "}
            arası gösteriliyor
          </>
        )}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#e5e5ea] bg-white px-2 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            aria-label="Önceki Sayfa"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Önceki</span>
          </button>

          {pageNumbers.map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1 text-[11px] text-[#86868b] select-none"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1.5 text-[11px] font-semibold tabular-nums transition-colors ${
                  item === safePage
                    ? "bg-[#e63462] text-white shadow-2xs"
                    : "border border-[#e5e5ea] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
                }`}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#e5e5ea] bg-white px-2 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            aria-label="Sonraki Sayfa"
          >
            <span className="hidden sm:inline">Sonraki</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
