import { useState } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { resolveImageUrl, type MenuCampaign } from "@/lib/api"

export function CampaignsModal(props: {
  campaigns: MenuCampaign[]
  activeIndex: number
  formatCurrency: (n: number) => string
  onChangeIndex: (index: number) => void
  onClose: () => void
}) {
  const { campaigns, activeIndex, formatCurrency, onChangeIndex, onClose } = props
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})
  const currentCampaign = campaigns[activeIndex] ?? campaigns[0]
  if (!currentCampaign) return null
  const currentImgUrl = resolveImageUrl(currentCampaign.imageUrl)
  const hasOriginalPrice = currentCampaign.originalPrice != null && currentCampaign.originalPrice > 0
  const hasDiscountedPrice = currentCampaign.discountedPrice != null && currentCampaign.discountedPrice >= 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kampanyalar"
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {campaigns.map((campaign, index) => {
          const offset = index - activeIndex
          const isVisible = offset >= 0 && offset <= 2
          if (!isVisible || index === activeIndex) return null
          const imgUrl = resolveImageUrl(campaign.imageUrl)
          return (
            <div
              key={campaign.id}
              aria-hidden="true"
              className="absolute inset-0 bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300"
              style={{
                transform: `translateY(${offset * 12}px) scale(${1 - offset * 0.05}) rotate(${offset * 2}deg)`,
                opacity: 1 - offset * 0.3,
                zIndex: 10 - offset,
              }}
            >
              <div className="aspect-[4/3] bg-stone-100">
                {imgUrl && !failedImages[campaign.id] && (
                  <img
                    key={campaign.id}
                    src={imgUrl}
                    alt={campaign.title}
                    loading="lazy"
                    decoding="async"
                    onError={() => {
                      setFailedImages((prev) => ({ ...prev, [campaign.id]: true }))
                    }}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          )
        })}
        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden z-20">
          <button
            type="button"
            onClick={onClose}
            aria-label="Kampanyaları kapat"
            className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative aspect-[4/3] bg-stone-100">
            {currentImgUrl && !failedImages[currentCampaign.id] && (
              <img
                key={currentCampaign.id}
                src={currentImgUrl}
                alt={currentCampaign.title}
                decoding="async"
                onError={() => {
                  setFailedImages((prev) => ({ ...prev, [currentCampaign.id]: true }))
                }}
                className="w-full h-full object-cover"
              />
            )}
            {currentCampaign.discountPercent != null && currentCampaign.discountPercent > 0 && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-sm font-bold rounded-full shadow-lg">
                %{currentCampaign.discountPercent} İndirim
              </div>
            )}
          </div>
          <div className="p-5">
            <h2 className="text-xl font-bold text-stone-900 mb-2">{currentCampaign.title}</h2>
            {currentCampaign.description && (
              <p className="text-stone-500 text-sm mb-4">{currentCampaign.description}</p>
            )}
            {(hasOriginalPrice || hasDiscountedPrice) && (
              <div className="flex items-center gap-3 mb-4">
                {hasDiscountedPrice && (
                  <span className="text-2xl font-bold text-rose-500">
                    {formatCurrency(currentCampaign.discountedPrice!)} TL
                  </span>
                )}
                {hasOriginalPrice && (
                  <span className={hasDiscountedPrice ? "text-lg text-stone-400 line-through" : "text-2xl font-bold text-stone-900"}>
                    {formatCurrency(currentCampaign.originalPrice!)} TL
                  </span>
                )}
              </div>
            )}
            {currentCampaign.validUntil && (
              <p className="text-xs text-stone-400 mb-4">
                Geçerlilik: {new Date(currentCampaign.validUntil).toLocaleDateString("tr-TR")}
              </p>
            )}
            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
              <div className="flex items-center gap-2">
                {campaigns.map((c, idx) => (
                  <button
                    type="button"
                    key={c.id}
                    aria-label={`${idx + 1}. kampanya`}
                    onClick={() => onChangeIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === activeIndex ? "w-6 bg-rose-500" : "bg-stone-300 hover:bg-stone-400"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {activeIndex > 0 && (
                  <button
                    type="button"
                    aria-label="Önceki kampanya"
                    onClick={() => onChangeIndex(activeIndex - 1)}
                    className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    activeIndex < campaigns.length - 1 ? onChangeIndex(activeIndex + 1) : onClose()
                  }
                  className="h-10 px-5 rounded-full bg-stone-900 text-white font-medium text-sm hover:bg-stone-800 transition-colors flex items-center gap-2"
                >
                  {activeIndex < campaigns.length - 1 ? (
                    <>
                      Sonraki
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    "Menüye Git"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        {campaigns.length > 1 && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium">
            {activeIndex + 1} / {campaigns.length}
          </div>
        )}
      </div>
    </div>
  )
}
