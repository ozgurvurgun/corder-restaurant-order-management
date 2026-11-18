import { useEffect, useState } from "react"
import type { RoleTemplateDefinition } from "@/lib/types"
import { getRoleDisplayName } from "@/lib/permission-labels"
import { CustomSelect } from "./ui/custom-inputs"
import { X } from "lucide-react"

interface NewRoleModalProps {
  saving: boolean
  templates: RoleTemplateDefinition[]
  onClose: () => void
  onSubmit: (payload: {
    name: string
    description?: string
    color: string
    templateKey?: string
  }) => Promise<void>
}

export function NewRoleModal({
  saving,
  templates,
  onClose,
  onSubmit,
}: NewRoleModalProps) {
  const defaultTplKey =
    templates.find((t) => t.key === "waiter")?.key ??
    templates.find((t) => t.key === "runner")?.key ??
    templates[0]?.key ??
    ""

  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")
  const [roleColor, setRoleColor] = useState("#e63462")
  const [templateKey, setTemplateKey] = useState(defaultTplKey)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, saving])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roleName.trim() || saving) return
    await onSubmit({
      name: roleName.trim(),
      description: roleDescription.trim() || undefined,
      color: roleColor,
      templateKey: templateKey || undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#e5e5ea]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Yeni Özel Rol Oluştur</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7]"
          >
            <X className="h-4 w-4 text-[#86868b]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#1d1d1f]">
              Rol Adı *
            </label>
            <input
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="Örn: Barista, Paket Şefi, Gece Müdürü"
              className="h-11 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#1d1d1f]">
              Açıklama
            </label>
            <input
              type="text"
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Rolün görev tanımı..."
              className="h-11 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
            />
          </div>
          {templates.length > 0 && (
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#1d1d1f]">
                Başlangıç Yetki Şablonu
              </label>
              <CustomSelect
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] font-semibold text-[#1d1d1f]"
              >
                {templates.map((tpl) => (
                  <option key={tpl.key} value={tpl.key}>
                    {getRoleDisplayName(tpl.key, tpl.name)} ({tpl.permissions.length} yetki)
                  </option>
                ))}
                <option value="">Boş (Yetkileri Sıfırdan Seç)</option>
              </CustomSelect>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#1d1d1f]">
              Rozet Rengi
            </label>
            <input
              type="color"
              value={roleColor}
              onChange={(e) => setRoleColor(e.target.value)}
              className="h-10 w-20 cursor-pointer rounded-lg border border-[#d1d1d6]"
            />
          </div>
          <div className="flex justify-end gap-2.5 border-t border-[#f0f0f0] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#d1d1d6] px-4 text-[13px] font-medium text-[#86868b] hover:bg-[#f5f5f7]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-xl bg-[#e63462] px-5 text-[13px] font-semibold text-white hover:bg-[#d42d56]"
            >
              Oluştur
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
