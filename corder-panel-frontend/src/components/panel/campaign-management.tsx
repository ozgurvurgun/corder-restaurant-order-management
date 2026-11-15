import { useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelI18n } from "@/lib/panel-i18n"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"
import { usePanelToast } from "./panel-toast"
import { Plus, Pencil, Trash2, X, Megaphone, Eye, EyeOff } from "lucide-react"
import ImageUpload from "./image-upload"
import type { Campaign } from "@/lib/panel-types"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 })
}

export default function CampaignManagement() {
  const { token } = usePanelAuth()
  const { campaigns, addCampaign, updateCampaign, deleteCampaign } = usePanelStore()
  const { locale } = usePanelI18n()
  const { showToast } = usePanelToast()
  
  const [showForm, setShowForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState("")
  const [originalPrice, setOriginalPrice] = useState("")
  const [discountedPrice, setDiscountedPrice] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [isActive, setIsActive] = useState(true)

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setImage("")
    setOriginalPrice("")
    setDiscountedPrice("")
    setValidUntil("")
    setIsActive(true)
    setEditingCampaign(null)
    setShowForm(false)
  }

  const openEditForm = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setTitle(campaign.title)
    setDescription(campaign.description || "")
    setImage(campaign.image)
    setOriginalPrice(campaign.originalPrice?.toString() || "")
    setDiscountedPrice(campaign.discountedPrice?.toString() || "")
    setValidUntil(campaign.validUntil ? campaign.validUntil.toISOString().split("T")[0] : "")
    setIsActive(campaign.isActive)
    setShowForm(true)
  }

  const handleSave = () => {
    if (!title.trim() || !image.trim()) {
      showToast("Baslik ve fotograf zorunludur", "error")
      return
    }

    const orig = originalPrice ? parseFloat(originalPrice) : undefined
    const disc = discountedPrice ? parseFloat(discountedPrice) : undefined
    const percent = orig && disc ? Math.round(((orig - disc) / orig) * 100) : undefined

    if (editingCampaign) {
      updateCampaign(editingCampaign.id, {
        title,
        description: description || undefined,
        image,
        originalPrice: orig,
        discountedPrice: disc,
        discountPercent: percent,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        isActive,
      })
      showToast("Kampanya guncellendi", "success")
    } else {
      addCampaign({
        title,
        description: description || undefined,
        image,
        originalPrice: orig,
        discountedPrice: disc,
        discountPercent: percent,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        isActive,
      })
      showToast("Kampanya eklendi", "success")
    }
    resetForm()
  }

  const handleDelete = (id: string) => {
    deleteCampaign(id)
    showToast("Kampanya silindi", "warning")
    setDeleteConfirm(null)
  }

  const toggleActive = (campaign: Campaign) => {
    updateCampaign(campaign.id, { isActive: !campaign.isActive })
    showToast(campaign.isActive ? "Kampanya pasif yapildi" : "Kampanya aktif yapildi", "info")
  }

  const sortedCampaigns = [...campaigns].sort((a, b) => a.order - b.order)

  return (
    <div className="h-full flex flex-col bg-[#f5f5f7]">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-[#d1d1d6]/60 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-[#1d1d1f]">
              {locale === "tr" ? "Kampanya Yonetimi" : "Campaign Management"}
            </h1>
            <p className="text-[13px] text-[#86868b] mt-0.5">
              {locale === "tr" ? "Menu acilisinda gosterilecek kampanyalar" : "Campaigns shown on menu open"}
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-2 h-9 px-4 bg-[#e63462] hover:bg-[#d42d58] text-white rounded-lg text-[13px] font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            {locale === "tr" ? "Kampanya Ekle" : "Add Campaign"}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {sortedCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[#e63462]/10 flex items-center justify-center mb-4">
              <Megaphone className="w-8 h-8 text-[#e63462]" />
            </div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f] mb-1">
              {locale === "tr" ? "Henuz kampanya yok" : "No campaigns yet"}
            </h2>
            <p className="text-[13px] text-[#86868b] max-w-sm">
              {locale === "tr" 
                ? "Kampanya ekleyerek musterilerinize ozel firsatlar sunun." 
                : "Add campaigns to offer special deals to your customers."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`bg-white rounded-2xl overflow-hidden border transition-all ${
                  campaign.isActive 
                    ? "border-[#d1d1d6]/60 shadow-sm" 
                    : "border-dashed border-[#d1d1d6] opacity-60"
                }`}
              >
                {/* Image */}
                <div className="relative aspect-[3/2] bg-stone-100">
                  <img
                    src={campaign.image}
                    alt={campaign.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Discount badge */}
                  {campaign.discountPercent && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#e63462] text-white text-xs font-bold rounded-full">
                      %{campaign.discountPercent} {locale === "tr" ? "Indirim" : "Off"}
                    </div>
                  )}
                  {/* Status badge */}
                  <div className={`absolute top-3 right-3 px-2 py-1 text-[10px] font-semibold rounded-full ${
                    campaign.isActive 
                      ? "bg-[#34c759]/20 text-[#34c759]" 
                      : "bg-[#86868b]/20 text-[#86868b]"
                  }`}>
                    {campaign.isActive ? (locale === "tr" ? "Aktif" : "Active") : (locale === "tr" ? "Pasif" : "Inactive")}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-[#1d1d1f] mb-1">{campaign.title}</h3>
                  {campaign.description && (
                    <p className="text-[13px] text-[#86868b] line-clamp-2 mb-3">{campaign.description}</p>
                  )}
                  
                  {/* Pricing */}
                  {(campaign.originalPrice || campaign.discountedPrice) && (
                    <div className="flex items-center gap-2 mb-3">
                      {campaign.discountedPrice && (
                        <span className="text-lg font-bold text-[#e63462]">
                          {formatCurrency(campaign.discountedPrice)} TL
                        </span>
                      )}
                      {campaign.originalPrice && campaign.discountedPrice && (
                        <span className="text-sm text-[#86868b] line-through">
                          {formatCurrency(campaign.originalPrice)} TL
                        </span>
                      )}
                    </div>
                  )}

                  {/* Valid until */}
                  {campaign.validUntil && (
                    <p className="text-[11px] text-[#86868b] mb-3">
                      {locale === "tr" ? "Gecerlilik: " : "Valid until: "}
                      {new Date(campaign.validUntil).toLocaleDateString("tr-TR")}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-[#d1d1d6]/40">
                    <button
                      onClick={() => toggleActive(campaign)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                        campaign.isActive
                          ? "bg-[#86868b]/10 text-[#86868b] hover:bg-[#86868b]/20"
                          : "bg-[#34c759]/10 text-[#34c759] hover:bg-[#34c759]/20"
                      }`}
                    >
                      {campaign.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {campaign.isActive ? (locale === "tr" ? "Gizle" : "Hide") : (locale === "tr" ? "Goster" : "Show")}
                    </button>
                    <button
                      onClick={() => openEditForm(campaign)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#007aff]/10 text-[#007aff] hover:bg-[#007aff]/20 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {locale === "tr" ? "Duzenle" : "Edit"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(campaign.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {locale === "tr" ? "Sil" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#d1d1d6]/60">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
                {editingCampaign 
                  ? (locale === "tr" ? "Kampanya Duzenle" : "Edit Campaign")
                  : (locale === "tr" ? "Yeni Kampanya" : "New Campaign")}
              </h2>
              <button onClick={resetForm} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5f5f7] transition-colors">
                <X className="w-5 h-5 text-[#86868b]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">
                  {locale === "tr" ? "Baslik *" : "Title *"}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={locale === "tr" ? "Kampanya basligi" : "Campaign title"}
                  className="w-full h-11 px-4 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">
                  {locale === "tr" ? "Aciklama" : "Description"}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={locale === "tr" ? "Kampanya detaylari" : "Campaign details"}
                  rows={3}
                  className="w-full px-4 py-3 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Image Upload */}
              <ImageUpload 
                value={image} 
                onChange={setImage} 
                label={locale === "tr" ? "Kampanya Fotografı" : "Campaign Image"}
                required
                onUpload={token ? (file => api.upload(token, file).then(r => r.url)) : undefined}
              />

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">
                    {locale === "tr" ? "Normal Fiyat" : "Original Price"}
                  </label>
                  <input
                    type="number"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="0"
                    className="w-full h-11 px-4 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">
                    {locale === "tr" ? "Indirimli Fiyat" : "Discounted Price"}
                  </label>
                  <input
                    type="number"
                    value={discountedPrice}
                    onChange={(e) => setDiscountedPrice(e.target.value)}
                    placeholder="0"
                    className="w-full h-11 px-4 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Valid Until */}
              <div>
                <label className="block text-[12px] font-medium text-[#86868b] mb-1.5">
                  {locale === "tr" ? "Gecerlilik Tarihi" : "Valid Until"}
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full h-11 px-4 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none transition-colors"
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                <span className="text-[14px] font-medium text-[#1d1d1f]">
                  {locale === "tr" ? "Aktif olarak yayinla" : "Publish as active"}
                </span>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-7 rounded-full transition-colors ${isActive ? "bg-[#34c759]" : "bg-[#d1d1d6]"}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-[#d1d1d6]/60">
              <button
                onClick={resetForm}
                className="flex-1 h-11 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] rounded-xl text-[14px] font-semibold transition-colors"
              >
                {locale === "tr" ? "Iptal" : "Cancel"}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 h-11 bg-[#e63462] hover:bg-[#d42d58] text-white rounded-xl text-[14px] font-semibold transition-colors"
              >
                {editingCampaign 
                  ? (locale === "tr" ? "Guncelle" : "Update")
                  : (locale === "tr" ? "Kaydet" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-[#ff3b30]" />
            </div>
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-2">
              {locale === "tr" ? "Kampanyayi Sil" : "Delete Campaign"}
            </h3>
            <p className="text-[13px] text-[#86868b] mb-6">
              {locale === "tr" 
                ? "Bu kampanya kalici olarak silinecek. Emin misiniz?" 
                : "This campaign will be permanently deleted. Are you sure?"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-11 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] rounded-xl text-[14px] font-semibold transition-colors"
              >
                {locale === "tr" ? "Iptal" : "Cancel"}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 h-11 bg-[#ff3b30] hover:bg-[#e8342b] text-white rounded-xl text-[14px] font-semibold transition-colors"
              >
                {locale === "tr" ? "Sil" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
