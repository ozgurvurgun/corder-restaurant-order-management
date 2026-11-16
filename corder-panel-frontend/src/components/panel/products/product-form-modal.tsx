import { AlertTriangle, X } from "lucide-react"
import type { PanelProduct } from "@/lib/panel-types"
import ImageUpload from "../image-upload"

export function AddProductInlineForm(props: {
  productName: string
  setProductName: (v: string) => void
  productPrice: string
  setProductPrice: (v: string) => void
  productDesc: string
  setProductDesc: (v: string) => void
  productImage: string
  setProductImage: (v: string) => void
  onUpload?: (file: File) => Promise<string>
  onClose: () => void
  onSubmit: () => void
}) {
  const {
    productName,
    setProductName,
    productPrice,
    setProductPrice,
    productDesc,
    setProductDesc,
    productImage,
    setProductImage,
    onUpload,
    onClose,
    onSubmit,
  } = props

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-[#1d1d1f]">Yeni Urun</h4>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
        >
          <X className="w-3 h-3 text-[#86868b]" />
        </button>
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Urun adi"
          className="flex-1 h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
        <input
          type="number"
          value={productPrice}
          onChange={(e) => setProductPrice(e.target.value)}
          placeholder="Fiyat"
          className="w-[120px] h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
        />
      </div>
      <input
        type="text"
        value={productDesc}
        onChange={(e) => setProductDesc(e.target.value)}
        placeholder="Aciklama (opsiyonel)"
        className="w-full mt-2 h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
      />
      <div className="mt-3">
        <ImageUpload
          value={productImage}
          onChange={setProductImage}
          label="Urun Fotografi (opsiyonel)"
          onUpload={onUpload}
        />
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onClose}
          className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
        >
          Iptal
        </button>
        <button
          onClick={onSubmit}
          className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]"
        >
          Kaydet
        </button>
      </div>
    </div>
  )
}

export function EditProductModal(props: {
  editName: string
  setEditName: (v: string) => void
  editPrice: string
  setEditPrice: (v: string) => void
  editDesc: string
  setEditDesc: (v: string) => void
  editImage: string
  setEditImage: (v: string) => void
  onUpload?: (file: File) => Promise<string>
  onClose: () => void
  onSave: () => void
}) {
  const {
    editName,
    setEditName,
    editPrice,
    setEditPrice,
    editDesc,
    setEditDesc,
    editImage,
    setEditImage,
    onUpload,
    onClose,
    onSave,
  } = props

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e8ed]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
            Urun Duzenle
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
          >
            <X className="w-4 h-4 text-[#86868b]" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">
              Urun Adi
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-[40px] px-3 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">
              Fiyat (TL)
            </label>
            <input
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              className="w-full h-[40px] px-3 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">
              Aciklama (opsiyonel)
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">
              Fotograf
            </label>
            <ImageUpload
              value={editImage}
              onChange={setEditImage}
              onUpload={onUpload}
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[#e8e8ed] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-[38px] px-5 text-[13px] font-medium text-[#86868b] rounded-xl border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
          >
            Iptal
          </button>
          <button
            onClick={onSave}
            className="h-[38px] px-5 text-[13px] font-medium text-white bg-[#e63462] rounded-xl hover:bg-[#d42d56]"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteProductConfirmModal(props: {
  product: PanelProduct
  onCancel: () => void
  onConfirm: () => void
}) {
  const { product, onCancel, onConfirm } = props
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px]">
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
              Urunu sil
            </h3>
            <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed">
              <span className="font-medium text-[#1d1d1f]">{product.name}</span>{" "}
              urununu silmek istediginize emin misiniz? Bu islem geri alinamaz.
            </p>
          </div>
        </div>
        <div className="px-5 py-4 flex justify-end gap-2 border-t border-[#e8e8ed] mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-[38px] px-4 text-[13px] font-medium text-[#86868b] rounded-xl border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
          >
            Iptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-[38px] px-4 text-[13px] font-medium text-white bg-red-500 rounded-xl hover:bg-red-600"
          >
            Evet, sil
          </button>
        </div>
      </div>
    </div>
  )
}
