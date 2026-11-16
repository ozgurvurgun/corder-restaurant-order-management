import { useEffect, useState } from "react"
import { X } from "lucide-react"

interface NewRoleModalProps {
  saving: boolean
  onClose: () => void
  onSubmit: (payload: {
    name: string
    description?: string
    color: string
  }) => Promise<void>
}

export function NewRoleModal({ saving, onClose, onSubmit }: NewRoleModalProps) {
  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")
  const [roleColor, setRoleColor] = useState("#e63462")

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
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3">
          <h3 className="text-[16px] font-bold text-[#1d1d1f]">Yeni Özel Rol Oluştur</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f5f7]"
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
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#d1d1d6] px-4 text-[13px] font-medium text-[#86868b]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-xl bg-[#e63462] px-5 text-[13px] font-bold text-white"
            >
              Oluştur
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

