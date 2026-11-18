import { useEffect } from "react"
import {
  AlertTriangle,
  Menu,
  Monitor,
  ToggleLeft,
  ToggleRight,
  X,
  Zap,
} from "lucide-react"
import type { PanelCategory } from "@/lib/panel-types"
import { orderedCategoryList } from "@/lib/panel-api-sync"
import { CustomSelect } from "@/components/ui/custom-inputs"

export function categoryDepth(cats: PanelCategory[], id: string): number {
  let d = 0
  let cur = cats.find((c) => c.id === id)
  while (cur?.parentId) {
    d++
    cur = cats.find((c) => c.id === cur!.parentId)
  }
  return d
}

export function descendantIdSet(
  cats: PanelCategory[],
  rootId: string,
): Set<string> {
  const out = new Set<string>()
  const walk = (pid: string) => {
    for (const c of cats.filter((x) => x.parentId === pid)) {
      out.add(c.id)
      walk(c.id)
    }
  }
  walk(rootId)
  return out
}

export function AddCategoryInlineForm(props: {
  categories: PanelCategory[]
  newCategoryParentId: string
  setNewCategoryParentId: (v: string) => void
  catName: string
  setCatName: (v: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  const {
    categories,
    newCategoryParentId,
    setNewCategoryParentId,
    catName,
    setCatName,
    onCancel,
    onSubmit,
  } = props

  return (
    <div className="px-3 py-2 border-t border-[#d1d1d6]/40">
      <label className="block text-[10px] font-medium text-[#86868b] mb-0.5">
        Üst kategori
      </label>
      <CustomSelect
        value={newCategoryParentId}
        onChange={(e) => setNewCategoryParentId(e.target.value)}
        className="w-full h-[28px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 mb-1.5"
      >
        <option value="">Ana kategori</option>
        {orderedCategoryList(categories).map((c) => (
          <option key={c.id} value={c.id}>
            {"\u00A0".repeat(categoryDepth(categories, c.id) * 2)}
            {c.name}
          </option>
        ))}
      </CustomSelect>
      <input
        type="text"
        value={catName}
        onChange={(e) => setCatName(e.target.value)}
        placeholder="Kategori adı"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit()
          if (e.key === "Escape") onCancel()
        }}
        className="w-full h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 mb-1.5"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-[28px] text-[11px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="flex-1 h-[28px] text-[11px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]"
        >
          Ekle
        </button>
      </div>
    </div>
  )
}

export function DeleteCategoryConfirmModal(props: {
  categoryDeleteStep: { id: string; name: string; step: 1 | 2 }
  onCancel: () => void
  onNextStep: () => void
  onConfirmDelete: () => void
}) {
  const { categoryDeleteStep, onCancel, onNextStep, onConfirmDelete } = props

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px]">
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
              {categoryDeleteStep.step === 1 ? "Kategoriyi Sil" : "Son Onay"}
            </h3>
            {categoryDeleteStep.step === 1 ? (
              <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed">
                <span className="font-medium text-[#1d1d1f]">
                  {categoryDeleteStep.name}
                </span>{" "}
                kategorisini silmek istediğinize emin misiniz?
              </p>
            ) : (
              <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed">
                Alt kategoriler ve bu kategorideki kalemler de silinebilir. Son
                kez onaylıyor musunuz?
              </p>
            )}
          </div>
        </div>
        <div className="px-5 py-4 flex justify-end gap-2 border-t border-[#e8e8ed] mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-[38px] px-4 text-[13px] font-medium text-[#86868b] rounded-xl border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
          >
            İptal
          </button>
          {categoryDeleteStep.step === 1 ? (
            <button
              type="button"
              onClick={onNextStep}
              className="h-[38px] px-4 text-[13px] font-medium text-white bg-[#e63462] rounded-xl hover:bg-[#d42d56]"
            >
              Evet, devam et
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirmDelete}
              className="h-[38px] px-4 text-[13px] font-medium text-white bg-red-500 rounded-xl hover:bg-red-600"
            >
              Kategoriyi Sil
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function CategorySettingsModal(props: {
  categories: PanelCategory[]
  editingCatSettings: PanelCategory
  setEditingCatSettings: (v: PanelCategory | null) => void
  updateCategory: (id: string, data: Partial<PanelCategory>) => void
}) {
  const {
    categories,
    editingCatSettings,
    setEditingCatSettings,
    updateCategory,
  } = props

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingCatSettings(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [setEditingCatSettings])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[360px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e8ed]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
            Kategori Ayarları
          </h3>
          <button
            type="button"
            onClick={() => setEditingCatSettings(null)}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
          >
            <X className="w-4 h-4 text-[#86868b]" />
          </button>
        </div>
        <div className="p-5">
          <div className="text-[14px] font-medium text-[#1d1d1f] mb-4">
            {editingCatSettings.name}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[#1d1d1f]">
                    Terminalde Göster
                  </div>
                  <div className="text-[11px] text-[#86868b]">
                    Personel sipariş ekranında görünür
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !editingCatSettings.showInTerminal
                  updateCategory(editingCatSettings.id, {
                    showInTerminal: nextVal,
                  })
                  setEditingCatSettings({
                    ...editingCatSettings,
                    showInTerminal: nextVal,
                  })
                }}
              >
                {editingCatSettings.showInTerminal ? (
                  <ToggleRight className="w-8 h-8 text-blue-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-[#d1d1d6]" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <Menu className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[#1d1d1f]">
                    Menüde Göster
                  </div>
                  <div className="text-[11px] text-[#86868b]">
                    QR menü ve web menüde görünür
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !editingCatSettings.showInMenu
                  updateCategory(editingCatSettings.id, { showInMenu: nextVal })
                  setEditingCatSettings({
                    ...editingCatSettings,
                    showInMenu: nextVal,
                  })
                }}
              >
                {editingCatSettings.showInMenu ? (
                  <ToggleRight className="w-8 h-8 text-green-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-[#d1d1d6]" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[#1d1d1f]">
                    Hızlı Satışta Göster
                  </div>
                  <div className="text-[11px] text-[#86868b]">
                    Hızlı satış ekranında görünür
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !editingCatSettings.showInQuickSale
                  updateCategory(editingCatSettings.id, {
                    showInQuickSale: nextVal,
                  })
                  setEditingCatSettings({
                    ...editingCatSettings,
                    showInQuickSale: nextVal,
                  })
                }}
              >
                {editingCatSettings.showInQuickSale ? (
                  <ToggleRight className="w-8 h-8 text-orange-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-[#d1d1d6]" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">
              Üst kategori
            </label>
            <CustomSelect
              className="w-full h-[38px] px-3 text-[13px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none"
              value={editingCatSettings.parentId ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim()
                const parentId = v ? v : null
                updateCategory(editingCatSettings.id, { parentId })
                setEditingCatSettings({
                  ...editingCatSettings,
                  parentId: parentId ?? undefined,
                })
              }}
            >
              <option value="">Ana kategori</option>
              {orderedCategoryList(categories)
                .filter(
                  (c) =>
                    c.id !== editingCatSettings.id &&
                    !descendantIdSet(categories, editingCatSettings.id).has(
                      c.id,
                    ),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {"\u00A0".repeat(categoryDepth(categories, c.id) * 2)}
                    {c.name}
                  </option>
                ))}
            </CustomSelect>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[#e8e8ed]">
          <button
            type="button"
            onClick={() => setEditingCatSettings(null)}
            className="w-full h-[38px] text-[13px] font-medium text-white bg-[#e63462] rounded-xl hover:bg-[#d42d56]"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  )
}
