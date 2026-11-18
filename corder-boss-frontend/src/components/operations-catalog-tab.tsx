import { useEffect, useMemo, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import { bossApi } from "@/lib/api"
import type { CatalogProductDto, LiveTableDto } from "@/lib/types"
import {
  computeTableTotals,
  formatMoney,
  getWaiterDisplayName,
} from "@/lib/format"
import { formatCloudflareImageUrl } from "@/lib/image"
import { LiveTableDetailSheet } from "./live-table-detail-sheet"
import { CustomSelect } from "./ui/custom-inputs"
import { PaginationBar } from "./ui/pagination-bar"
import {
  LayoutGrid,
  Package,
  AlertTriangle,
  Search,
  Check,
  X,
  Building2,
  Utensils,
} from "lucide-react"

export function OperationsCatalogTab() {
  const {
    tables,
    orders,
    products,
    categories,
    overview,
    branches,
    selectedBranchId,
    effectiveBranchId,
    effectiveBranch,
    setSelectedBranchId,
    refreshBranchDetails,
    showToast,
  } = useBossStore()

  const [subTab, setSubTab] = useState<"tables" | "catalog" | "stock">("tables")
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [searchProduct, setSearchProduct] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL")
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState<string>("")
  const [catalogPage, setCatalogPage] = useState(1)
  const catalogPageSize = 12

  useEffect(() => {
    setCatalogPage(1)
  }, [searchProduct, selectedCategoryId, effectiveBranchId])

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  )

  const criticalMaterials = overview?.criticalMaterials ?? []

  const getTableActiveOrders = (tableId: string) =>
    orders.filter((o) => o.tableId === tableId && o.status === "active")

  const getTableNetTotal = (table: LiveTableDto) => {
    const tOrders = getTableActiveOrders(table.id)
    return computeTableTotals(tOrders, table.discount).netTotal
  }

  const handleToggleStock = async (prod: CatalogProductDto) => {
    if (!effectiveBranchId) return
    try {
      await bossApi.operations.updateProduct(effectiveBranchId, prod.id, {
        inStock: !prod.inStock,
      })
      await refreshBranchDetails(effectiveBranchId)
      showToast(
        `${prod.name} ${!prod.inStock ? "satışa açıldı" : "tükendi olarak işaretlendi"}`
      )
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Güncellenemedi", "error")
    }
  }

  const handleSavePrice = async (prod: CatalogProductDto) => {
    if (!effectiveBranchId) return
    const nextPrice = Number(priceDraft)
    if (!Number.isFinite(nextPrice) || nextPrice < 0) return
    try {
      await bossApi.operations.updateProduct(effectiveBranchId, prod.id, {
        price: nextPrice,
      })
      setEditingPriceId(null)
      await refreshBranchDetails(effectiveBranchId)
      showToast(`${prod.name} fiyatı ₺${formatMoney(nextPrice)} olarak güncellendi`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Fiyat güncellenemedi", "error")
    }
  }

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null
  const selectedTableOrders = selectedTable
    ? getTableActiveOrders(selectedTable.id)
    : []

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        if (selectedCategoryId !== "ALL" && p.categoryId !== selectedCategoryId) {
          return false
        }
        if (!searchProduct.trim()) return true
        return p.name.toLowerCase().includes(searchProduct.toLowerCase())
      }),
    [products, selectedCategoryId, searchProduct]
  )

  const pagedProducts = useMemo(() => {
    const start = (catalogPage - 1) * catalogPageSize
    return filteredProducts.slice(start, start + catalogPageSize)
  }, [filteredProducts, catalogPage])

  return (
    <div className="space-y-4">
      {/* Sub-navigation & Branch Selector */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {[
            { id: "tables" as const, label: "Canlı Masalar", icon: LayoutGrid },
            { id: "catalog" as const, label: "Fiyat & Menü", icon: Package },
            {
              id: "stock" as const,
              label: `Kritik Stok (${criticalMaterials.length})`,
              icon: AlertTriangle,
            },
          ].map((item) => {
            const Icon = item.icon
            const active = subTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSubTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all ${
                  active
                    ? "bg-[#e63462] text-white"
                    : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ebebf0]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </div>

        {branches.length > 1 && (
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#e63462]/30 bg-[#fef3f5] px-2.5 py-1.5">
            <Building2 className="h-3.5 w-3.5 text-[#e63462]" />
            <span className="text-[11px] font-medium text-[#86868b]">
              {selectedBranchId === "ALL" ? "Aktif Şube:" : "Şube:"}
            </span>
            <CustomSelect
              value={effectiveBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              aria-label="Aktif Şube"
              className="bg-transparent text-[12px] font-semibold text-[#1d1d1f]"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </CustomSelect>
          </div>
        )}
      </div>

      {/* 1. Live Tables View */}
      {subTab === "tables" && (
        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              {effectiveBranch?.name} — Canlı Masa Durumu ({tables.length} Masa)
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {tables.map((t) => {
              const tOrders = getTableActiveOrders(t.id)
              const totals = computeTableTotals(tOrders, t.discount)
              const hasActiveBill = totals.subtotal > 0 || tOrders.length > 0
              const occupied =
                hasActiveBill || t.status === "occupied" || t.status === "checkout"
              const waiter =
                t.sessionStaffName ||
                (tOrders[0] ? getWaiterDisplayName(tOrders[0]) : null)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTableId(t.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    t.status === "checkout"
                      ? "border-blue-400 bg-blue-50"
                      : occupied
                        ? "border-[#e63462] bg-[#e63462]/8"
                        : "border-[#e5e5ea] bg-[#f9f9fb]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">
                      {t.name}
                    </span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        t.status === "checkout"
                          ? "bg-blue-500"
                          : occupied
                            ? "bg-[#e63462]"
                            : "bg-zinc-300"
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-[15px] font-bold text-[#1d1d1f] tabular-nums">
                    {occupied ? `₺${formatMoney(getTableNetTotal(t))}` : "Boş"}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-[#86868b]">
                    {waiter ? `Garson: ${waiter}` : t.section}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. Quick Mobile Menu Price & Stock Toggle with Cloudflare Image Transformations & Pagination */}
      {subTab === "catalog" && (
        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" />
            <input
              type="text"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              placeholder="Ürün adı ile ara (hızlı fiyat ve stok durumu değiştir)..."
              className="h-10 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] pl-10 pr-4 text-[13px] outline-none focus:border-[#e63462]"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("ALL")}
                className={`flex-shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  selectedCategoryId === "ALL"
                    ? "bg-[#e63462] text-white"
                    : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                Tüm Kategoriler ({products.length})
              </button>
              {categories.map((cat) => {
                const active = selectedCategoryId === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`flex-shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-[#e63462] text-white"
                        : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
                    }`}
                  >
                    {cat.name}
                  </button>
                )
              })}
            </div>
          )}

          <div className="divide-y divide-[#f0f0f0]">
            {pagedProducts.map((p) => {
              const catName = categoryNameById.get(p.categoryId)
              const transformedImageUrl = formatCloudflareImageUrl(p.imageUrl, {
                width: 96,
                height: 96,
                fit: "cover",
                quality: 82,
              })
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {transformedImageUrl && p.imageUrl ? (
                      <img
                        src={transformedImageUrl}
                        alt={p.name}
                        loading="lazy"
                        onError={(e) => {
                          if (p.imageUrl && e.currentTarget.src !== p.imageUrl) {
                            e.currentTarget.src = p.imageUrl
                          }
                        }}
                        className="h-11 w-11 flex-shrink-0 rounded-xl object-cover border border-[#e5e5ea] bg-[#f5f5f7]"
                      />
                    ) : (
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] text-[#86868b]">
                        <Utensils className="h-4 w-4" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13px] font-semibold text-[#1d1d1f]">
                          {p.name}
                        </p>
                        {catName && (
                          <span className="rounded bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-medium text-[#86868b]">
                            {catName}
                          </span>
                        )}
                      </div>
                      {editingPriceId === p.id ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            value={priceDraft}
                            onChange={(e) => setPriceDraft(e.target.value)}
                            className="h-8 w-24 rounded-lg border border-[#e63462] px-2 text-[13px] font-bold"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => void handleSavePrice(p)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#34c759] text-white"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPriceId(null)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#86868b]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPriceId(p.id)
                            setPriceDraft(String(p.price))
                          }}
                          className="mt-0.5 text-[13px] font-semibold text-[#e63462] hover:underline"
                        >
                          ₺{formatMoney(p.price)} (Fiyatı Değiştir)
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleToggleStock(p)}
                    className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      p.inStock
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {p.inStock ? "Stokta Açık" : "Tükendi"}
                  </button>
                </div>
              )
            })}
          </div>

          <PaginationBar
            currentPage={catalogPage}
            totalItems={filteredProducts.length}
            pageSize={catalogPageSize}
            onPageChange={setCatalogPage}
            itemLabel="ürün"
          />
        </div>
      )}

      {/* 3. Critical Stock Alert List */}
      {subTab === "stock" && (
        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] mb-3">
            Kritik Seviyedeki Hammaddeler ({criticalMaterials.length})
          </h3>
          {criticalMaterials.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#86868b]">
              Kritik stok seviyesinin altında hammadde bulunmuyor.
            </p>
          ) : (
            <div className="space-y-2">
              {criticalMaterials.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50/70 px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">
                      {m.name}{" "}
                      {m.branchName && (
                        <span className="text-[11px] font-normal text-[#86868b]">
                          ({m.branchName})
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#86868b]">
                      Kategori: {m.category} • Min: {m.minStock} {m.unit}
                    </p>
                  </div>
                  <span className="rounded-lg bg-red-100 px-2.5 py-1 text-[12px] font-semibold text-red-700">
                    {m.currentStock} {m.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTable && (
        <LiveTableDetailSheet
          table={selectedTable}
          orders={selectedTableOrders}
          onClose={() => setSelectedTableId(null)}
        />
      )}
    </div>
  )
}
