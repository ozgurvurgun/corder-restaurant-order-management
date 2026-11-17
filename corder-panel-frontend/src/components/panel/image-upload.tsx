import { useState, useRef, useCallback } from "react"
import { Upload, Loader2 } from "lucide-react"
import { resolveAssetUrl } from "@/lib/format"

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  onUpload?: (file: File) => Promise<string>
}

export default function ImageUpload({ value, onChange, label, placeholder, required, onUpload }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Sadece resim dosyaları yüklenebilir")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Dosya boyutu 5MB'dan küçük olmalı")
      return
    }
    setIsLoading(true)
    setError(null)
    if (onUpload) {
      onUpload(file)
        .then((url) => {
          onChange(url)
          setIsLoading(false)
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Yükleme başarısız")
          setIsLoading(false)
        })
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      onChange((e.target?.result as string) ?? "")
      setIsLoading(false)
    }
    reader.onerror = () => {
      setError("Dosya okunamadı")
      setIsLoading(false)
    }
    reader.readAsDataURL(file)
  }, [onChange, onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
  }

  return (
    <div>
      {label && (
        <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">
          {label} {required && "*"}
        </label>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-stone-100 border border-[#d1d1d6]/60 flex-shrink-0">
            <img src={resolveAssetUrl(value)} alt="Preview" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClick}
              className="px-3 py-1.5 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-lg text-[12px] font-medium text-[#1d1d1f] transition-colors"
            >
              Değiştir
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1.5 bg-[#ff3b30]/10 hover:bg-[#ff3b30]/20 rounded-lg text-[12px] font-medium text-[#ff3b30] transition-colors"
            >
              Kaldır
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative h-16 rounded-lg border-2 border-dashed transition-all cursor-pointer flex items-center justify-center gap-3 px-4 ${
            isDragging
              ? "border-[#e63462] bg-[#e63462]/5"
              : "border-[#d1d1d6] bg-[#f5f5f7] hover:border-[#e63462]/50 hover:bg-[#e63462]/5"
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-[#e63462] animate-spin" />
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-[#e63462]/10 flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-[#e63462]" />
              </div>
              <div className="text-left">
                <p className="text-[12px] font-medium text-[#1d1d1f]">
                  {isDragging ? "Bırakın" : "Fotoğraf Yükle"}
                </p>
                <p className="text-[10px] text-[#86868b]">
                  {placeholder || "PNG, JPG - Maks 5MB"}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[11px] text-[#ff3b30]">{error}</p>
      )}
    </div>
  )
}
