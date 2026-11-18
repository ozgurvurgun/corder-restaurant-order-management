import { X } from "lucide-react"
import type { StockMaterial, Supplier } from "@/lib/panel-types"
import { CustomSelect } from "@/components/ui/custom-inputs"

export function AddMaterialForm(props: {
  matName: string
  setMatName: (v: string) => void
  matUnit: StockMaterial["unit"]
  setMatUnit: (v: StockMaterial["unit"]) => void
  matCost: string
  setMatCost: (v: string) => void
  matCategory: string
  setMatCategory: (v: string) => void
  matStock: string
  setMatStock: (v: string) => void
  matMin: string
  setMatMin: (v: string) => void
  matSupplier?: string
  setMatSupplier?: (v: string) => void
  suppliers?: Supplier[]
  onClose: () => void
  onSubmit: () => void
}) {
  const {
    matName,
    setMatName,
    matUnit,
    setMatUnit,
    matCost,
    setMatCost,
    matCategory,
    setMatCategory,
    matStock,
    setMatStock,
    matMin,
    setMatMin,
    matSupplier = "",
    setMatSupplier,
    suppliers = [],
    onClose,
    onSubmit,
  } = props

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-[#1d1d1f]">
          Yeni Malzeme
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
        >
          <X className="w-3 h-3 text-[#86868b]" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <input
          type="text"
          value={matName}
          onChange={(e) => setMatName(e.target.value)}
          placeholder="Malzeme adı"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
        <CustomSelect
          value={matUnit}
          onChange={(e) => setMatUnit(e.target.value as StockMaterial["unit"])}
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60"
        >
          {(["kg", "lt", "adet", "gr", "ml", "paket", "koli"] as const).map(
            (u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ),
          )}
        </CustomSelect>
        <input
          type="number"
          min={0}
          step="0.01"
          value={matCost}
          onChange={(e) => setMatCost(e.target.value)}
          placeholder="Birim maliyet"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
        <input
          type="text"
          value={matCategory}
          onChange={(e) => setMatCategory(e.target.value)}
          placeholder="Kategori"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={matStock}
          onChange={(e) => setMatStock(e.target.value)}
          placeholder="Mevcut Stok"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={matMin}
          onChange={(e) => setMatMin(e.target.value)}
          placeholder="Min. Stok"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
        {setMatSupplier && (
          <CustomSelect
            value={matSupplier}
            onChange={(e) => setMatSupplier(e.target.value)}
            className="col-span-2 h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60"
          >
            <option value="">Tedarikçi seçin (opsiyonel)</option>
            {suppliers
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </CustomSelect>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onClose}
          className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]"
        >
          Kaydet
        </button>
      </div>
    </div>
  )
}

export function AddMovementForm(props: {
  stockMaterials: StockMaterial[]
  mvMatId: string
  setMvMatId: (v: string) => void
  mvType: "in" | "out" | "waste"
  setMvType: (v: "in" | "out" | "waste") => void
  mvQty: string
  setMvQty: (v: string) => void
  mvCost: string
  setMvCost: (v: string) => void
  mvReason: string
  setMvReason: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const {
    stockMaterials,
    mvMatId,
    setMvMatId,
    mvType,
    setMvType,
    mvQty,
    setMvQty,
    mvCost,
    setMvCost,
    mvReason,
    setMvReason,
    onClose,
    onSubmit,
  } = props

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-[#1d1d1f]">
          Stok Hareketi
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
        >
          <X className="w-3 h-3 text-[#86868b]" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <CustomSelect
          value={mvMatId}
          onChange={(e) => setMvMatId(e.target.value)}
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60"
        >
          <option value="">Malzeme seçin</option>
          {stockMaterials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.currentStock} {m.unit})
            </option>
          ))}
        </CustomSelect>
        <div className="flex gap-2">
          {(["in", "out", "waste"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMvType(t)}
              className={`flex-1 h-[36px] rounded-lg border text-[12px] font-medium ${
                mvType === t
                  ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]"
                  : "border-[#d1d1d6]/60 text-[#86868b]"
              }`}
            >
              {t === "in" ? "Giriş" : t === "out" ? "Çıkış" : "Fire"}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={mvQty}
          onChange={(e) => setMvQty(e.target.value)}
          placeholder="Miktar"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <input
          type="number"
          min={0}
          step="0.01"
          value={mvCost}
          onChange={(e) => setMvCost(e.target.value)}
          placeholder="Birim maliyet (opsiyonel)"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
        <input
          type="text"
          value={mvReason}
          onChange={(e) => setMvReason(e.target.value)}
          placeholder="Sebep (opsiyonel)"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onClose}
          className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]"
        >
          Kaydet
        </button>
      </div>
    </div>
  )
}

export function AddSupplierForm(props: {
  supName: string
  setSupName: (v: string) => void
  supContact: string
  setSupContact: (v: string) => void
  supPhone: string
  setSupPhone: (v: string) => void
  savingSupplier: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const {
    supName,
    setSupName,
    supContact,
    setSupContact,
    supPhone,
    setSupPhone,
    savingSupplier,
    onClose,
    onSubmit,
  } = props

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
      <div className="grid grid-cols-3 gap-3">
        <input
          type="text"
          value={supName}
          onChange={(e) => setSupName(e.target.value)}
          placeholder="Firma adı"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
        <input
          type="text"
          value={supContact}
          onChange={(e) => setSupContact(e.target.value)}
          placeholder="Yetkili kişi"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
        <input
          type="tel"
          value={supPhone}
          onChange={(e) => setSupPhone(e.target.value)}
          placeholder="Telefon"
          className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          disabled={savingSupplier}
          onClick={onClose}
          className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 disabled:opacity-50"
        >
          İptal
        </button>
        <button
          type="button"
          disabled={savingSupplier || !supName.trim()}
          onClick={onSubmit}
          className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56] disabled:opacity-50"
        >
          {savingSupplier ? "Kaydediliyor..." : "Ekle"}
        </button>
      </div>
    </div>
  )
}
