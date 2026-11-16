import { useEffect, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import { bossApi } from "@/lib/api"
import type { CatalogProductDto } from "@/lib/types"
import {
  LayoutGrid,
  Package,
  AlertTriangle,
  Search,
  User,
  Check,
  X,
  Building2,
} from "lucide-react"

function formatMoney(n: number): string {
  return Number(n || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function OperationsCatalogTab() {
  const {
    tables,
    orders,
    products,
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
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState<string>("")

  useEffect(() => {
    if (!selectedTableId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTableId(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedTableId])

  const criticalMaterials = overview?.criticalMaterials ?? []

  const getTableActiveOrders = (tableId: string) =>
    orders.filter((o) => o.tableId === tableId && o.status === "active")

  const getTableTotal = (tableId: string) => {
    const tOrders = getTableActiveOrders(tableId)
    let sum = 0
    for (const o of tOrders) {
      for (const item of o.items) {
        if (item.status !== "cancelled" && item.status !== "ledger") {
          sum += Number(item.price) * item.quantity
        }
      }
    }
    return sum
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

  const filteredProducts = products.filter((p) =>
    !searchProduct.trim()
      ? true
      : p.name.toLowerCase().includes(searchProduct.toLowerCase())
  )

  return (
    <div className="space-y-4 pb-8">
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
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold transition-all ${
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
            <span className="text-[11px] font-semibold text-[#86868b]">
              {selectedBranchId === "ALL" ? "Aktif Şube:" : "Şube:"}
            </span>
            <select
              value={effectiveBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              aria-label="Aktif Şube"
              className="bg-transparent text-[12px] font-bold text-[#1d1d1f] outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 1. Live Tables View */}
      {subTab === "tables" && (
        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-[#1d1d1f]">
              {effectiveBranch?.name} — Canlı Masa Durumu ({tables.length} Masa)
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {tables.map((t) => {
              const total = getTableTotal(t.id)
              const tOrders = getTableActiveOrders(t.id)
              const occupied = total > 0 || tOrders.length > 0
              const waiter =
                t.sessionStaffName || tOrders[0]?.userDisplayName || null
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTableId(t.id)}
                  className={`rounded-2xl border p-3 text-left transition-all ${
                    t.status === "checkout"
                      ? "border-blue-400 bg-blue-50"
                      : occupied
                        ? "border-[#e63462] bg-[#e63462]/8"
                        : "border-[#e5e5ea] bg-[#f9f9fb]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#1d1d1f]">
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
                  <p className="mt-1 text-[15px] font-extrabold text-[#1d1d1f] tabular-nums">
                    {occupied ? `₺${formatMoney(total)}` : "Boş"}
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

      {/* 2. Quick Mobile Menu Price & Stock Toggle */}
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

          <div className="divide-y divide-[#f0f0f0]">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[#1d1d1f]">
                    {p.name}
                  </p>
                  {editingPriceId === p.id ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.5"
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
                      className="mt-0.5 text-[13px] font-bold text-[#e63462] hover:underline"
                    >
                      ₺{formatMoney(p.price)} (Fiyatı Değiştir)
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleToggleStock(p)}
                  className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    p.inStock
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {p.inStock ? "Stokta Açık" : "Tükendi"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Critical Stock Alert List */}
      {subTab === "stock" && (
        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
          <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-3">
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
                    <p className="text-[13px] font-bold text-[#1d1d1f]">
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
                  <span className="rounded-lg bg-red-100 px-2.5 py-1 text-[12px] font-bold text-red-700">
                    {m.currentStock} {m.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Table Live Order Detail Sheet */}
      {selectedTable && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => setSelectedTableId(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3">
              <div>
                <h3 className="text-[16px] font-bold text-[#1d1d1f]">
                  {selectedTable.name} — Canlı Adisyon Detayı
                </h3>
                <p className="text-[11px] text-[#86868b]">
                  Toplam: ₺{formatMoney(getTableTotal(selectedTable.id))}
                </p>
              </div>
              <button
                onClick={() => setSelectedTableId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7]"
              >
                <X className="h-4 w-4 text-[#86868b]" />
              </button>
            </div>

            <div className="mt-3 max-h-[55vh] overflow-y-auto space-y-3">
              {selectedTableOrders.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[#86868b]">
                  Bu masada açık adisyon bulunmuyor.
                </p>
              ) : (
                selectedTableOrders.map((ord, idx) => (
                  <div
                    key={ord.id}
                    className="rounded-2xl border border-[#e5e5ea] bg-[#f9f9fb] p-3"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#86868b] mb-2">
                      <span className="flex items-center gap-1 font-semibold text-[#1d1d1f]">
                        <User className="h-3 w-3" /> Adisyon #{idx + 1} (
                        {ord.userDisplayName || "Personel"})
                      </span>
                      <span>
                        {new Date(ord.createdAt).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="divide-y divide-[#e5e5ea]">
                      {ord.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-1.5 text-[12px]"
                        >
                          <span
                            className={
                              item.status === "cancelled"
                                ? "line-through text-red-400"
                                : "font-medium text-[#1d1d1f]"
                            }
                          >
                            {item.quantity}x {item.productName}
                          </span>
                          <span className="font-semibold text-[#1d1d1f]">
                            ₺{formatMoney(Number(item.price) * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

