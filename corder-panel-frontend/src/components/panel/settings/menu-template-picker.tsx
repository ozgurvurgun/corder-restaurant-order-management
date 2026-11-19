import { Check, ExternalLink, Palette, Sparkles } from "lucide-react"
import type { MenuTemplateId } from "@/lib/panel-types"

export interface MenuTemplateOption {
  id: MenuTemplateId
  title: string
  tag: string
  description: string
  accentColor: string
}

export const MENU_TEMPLATE_OPTIONS: MenuTemplateOption[] = [
  {
    id: "classic",
    title: "Nordic Minimal (Klasik Liste)",
    tag: "Kafe & Restoran Klasik",
    description: "Ferah taş beyazı zemin, sağda net ürün görselleri ve hızlı yatay kategori geçişleriyle her konsepte uyumlu modern liste görünümü.",
    accentColor: "#1d1d1f",
  },
  {
    id: "bistro-grid",
    title: "Bistro Vitrin (2'li Görsel Kart)",
    tag: "Tatlıcı, Burger & Kahve",
    description: "İştah açıcı büyük ürün fotoğraflarını ön plana çıkaran 2 sütunlu vitrin ızgarası ve fiyat rozetleriyle görsel satış odaklı tasarım.",
    accentColor: "#e63462",
  },
  {
    id: "luxury-noir",
    title: "Luxury Noir (Koyu Lounge & Fine Dining)",
    tag: "Nargile Lounge, Bar & Steakhouse",
    description: "Obsidyen siyah zemin, şampanya altın detaylar, zarif kontrast ve loş mekan atmosferine uyumlu göz yormayan lüks karanlık tema.",
    accentColor: "#D4AF37",
  },
  {
    id: "editorial",
    title: "Artisanal Editorial (Gastronomi & Brasserie)",
    tag: "Şef Restoranı, Brasserie & Fırın",
    description: "Sıcak krem kağıt dokusu, rafine serif başlıklar, noktalı fiyat hizalaması ve basılı gastronomi menüsü zarafetinde tipografik düzen.",
    accentColor: "#8C6239",
  },
  {
    id: "vibrant-pop",
    title: "Dynamic Bento (Modern Fast-Casual)",
    tag: "Street Food & Yeni Nesil Mekan",
    description: "Canlı mercan-kehribar vurgular, yuvarlatılmış Bento ürün kartları, kategori ürün sayısı rozetleri ve yüksek enerjili modern arayüz.",
    accentColor: "#FF5A36",
  },
]

function TemplateMiniWireframe({ id }: { id: MenuTemplateId }) {
  if (id === "classic") {
    return (
      <div className="h-[118px] rounded-xl bg-[#FAFAF8] border border-[#E5E5EA] p-2.5 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center gap-1.5">
          <span className="h-4 px-2 rounded-full bg-[#1d1d1f] text-white text-[8px] font-semibold flex items-center">Kahveler</span>
          <span className="h-4 px-2 rounded-full bg-white border border-[#E5E5EA] text-[#86868b] text-[8px] flex items-center">Tatlılar</span>
          <span className="h-4 px-2 rounded-full bg-white border border-[#E5E5EA] text-[#86868b] text-[8px] flex items-center">Soğuklar</span>
        </div>
        <div className="space-y-1.5">
          {[
            { name: "Flat White", price: "₺145", tone: "bg-[#EAE6DF]" },
            { name: "San Sebastian", price: "₺220", tone: "bg-[#E2DDD5]" },
          ].map((row) => (
            <div key={row.name} className="flex items-center justify-between bg-white rounded-lg p-1.5 border border-[#EFEFF4] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="space-y-1 min-w-0 pr-2">
                <div className="text-[9px] font-semibold text-[#1d1d1f] leading-none">{row.name}</div>
                <div className="w-20 h-1.5 rounded-full bg-[#E5E5EA]" />
                <div className="text-[9px] font-bold text-[#1d1d1f] leading-none">{row.price}</div>
              </div>
              <div className={`w-8 h-8 rounded-md ${row.tone} flex-shrink-0 border border-black/5`} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (id === "bistro-grid") {
    return (
      <div className="h-[118px] rounded-xl bg-[#F8F6F4] border border-[#E8E2DC] p-2.5 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-[#1d1d1f] tracking-tight">İmza Burger &amp; Tatlı</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#e63462]/10 text-[#e63462] font-semibold">2&apos;li Vitrin</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: "Trüflü Smash", price: "₺340", bg: "from-[#F3D5C0] to-[#E6B89C]" },
            { name: "Belçika Waffle", price: "₺260", bg: "from-[#F5E1C8] to-[#E3C598]" },
          ].map((card) => (
            <div key={card.name} className="bg-white rounded-lg border border-[#EAE4DE] overflow-hidden shadow-sm">
              <div className={`h-11 bg-gradient-to-br ${card.bg} relative p-1.5 flex items-end justify-end`}>
                <span className="px-1.5 py-0.5 rounded-full bg-black/75 text-white text-[8px] font-bold leading-none">{card.price}</span>
              </div>
              <div className="p-1.5">
                <div className="text-[8.5px] font-semibold text-[#1d1d1f] truncate">{card.name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (id === "luxury-noir") {
    return (
      <div className="h-[118px] rounded-xl bg-[#121216] border border-[#D4AF37]/35 p-2.5 flex flex-col justify-between overflow-hidden text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-4 px-2 rounded-full bg-[#D4AF37] text-[#121216] text-[8px] font-bold flex items-center">Signature</span>
            <span className="h-4 px-2 rounded-full bg-white/5 border border-white/10 text-[#A1A1AA] text-[8px] flex items-center">Steak &amp; Lounge</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
        </div>
        <div className="space-y-1.5">
          {[
            { name: "Dry Aged Ribeye", price: "₺1.450" },
            { name: "Gold Artisan Cocktail", price: "₺520" },
          ].map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-[#D4AF37]/20 px-2 py-1.5">
              <div className="space-y-1">
                <div className="text-[9px] font-medium text-[#F5F5F7] leading-none">{item.name}</div>
                <div className="w-16 h-1 rounded-full bg-white/15" />
              </div>
              <span className="text-[9px] font-bold text-[#D4AF37]">{item.price}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (id === "editorial") {
    return (
      <div className="h-[118px] rounded-xl bg-[#F6F2EA] border border-[#DED6C6] p-3 flex flex-col justify-between overflow-hidden">
        <div className="text-center border-b border-[#D5CCB8] pb-1.5">
          <div className="font-serif text-[10px] font-bold tracking-[0.14em] uppercase text-[#2C241D]">Gastronomi Seçkisi</div>
          <div className="text-[7.5px] italic text-[#7A6A58]">Artisanal Brasserie &amp; Chef&apos;s Table</div>
        </div>
        <div className="space-y-2">
          {[
            { name: "Odun Ateşinde Burrata", price: "₺380" },
            { name: "Taze Trüflü Tagliolini", price: "₺540" },
            { name: "Karamelize İncirli Tart", price: "₺290" },
          ].map((item) => (
            <div key={item.name} className="flex items-baseline gap-1 text-[#2C241D]">
              <span className="font-serif text-[9px] font-semibold flex-shrink-0">{item.name}</span>
              <span className="flex-1 border-b border-dotted border-[#8C7A66]/60 translate-y-[-2px]" />
              <span className="font-serif text-[9px] font-bold text-[#6E4720] flex-shrink-0">{item.price}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-[118px] rounded-xl bg-[#FFF7F3] border border-[#FFD8CC] p-2.5 flex flex-col justify-between overflow-hidden">
      <div className="rounded-lg bg-gradient-to-r from-[#FF5A36] to-[#FF9F1C] px-2.5 py-1.5 text-white flex items-center justify-between">
        <span className="text-[9px] font-extrabold tracking-tight">POPÜLER BENTO</span>
        <span className="px-1.5 py-0.5 rounded-full bg-white/25 text-[8px] font-bold">14 Ürün</span>
      </div>
      <div className="grid grid-cols-12 gap-1.5">
        <div className="col-span-7 bg-white rounded-xl p-2 border border-[#FFE0D6] shadow-sm flex flex-col justify-between">
          <span className="inline-flex w-fit px-1.5 py-0.5 rounded-md bg-[#FF5A36]/10 text-[#FF5A36] text-[7.5px] font-bold">Şefin Seçimi</span>
          <div className="text-[9px] font-extrabold text-[#1d1d1f] mt-1">Crispy Korean Bowl</div>
          <div className="text-[9px] font-black text-[#FF5A36]">₺310</div>
        </div>
        <div className="col-span-5 bg-white rounded-xl p-2 border border-[#FFE0D6] shadow-sm flex flex-col justify-between">
          <div className="w-full h-5 rounded-md bg-gradient-to-tr from-[#FFE2D1] to-[#FFC3A0]" />
          <div className="text-[8.5px] font-bold text-[#1d1d1f] truncate">Smash Taco</div>
          <div className="text-[8.5px] font-black text-[#FF8811]">₺245</div>
        </div>
      </div>
    </div>
  )
}

export function MenuTemplatePickerCard(props: {
  selectedTemplate: MenuTemplateId
  restaurantSlug: string
  canManage: boolean
  onSelect: (templateId: MenuTemplateId) => void
}) {
  const { selectedTemplate, restaurantSlug, canManage, onSelect } = props
  const slug = restaurantSlug || "restoran"
  const activeOption = MENU_TEMPLATE_OPTIONS.find((item) => item.id === selectedTemplate) || MENU_TEMPLATE_OPTIONS[0]
  const buildPreviewUrl = (templateId: MenuTemplateId) =>
    `https://menu.corders.uk/?restaurant=${encodeURIComponent(slug)}&template=${encodeURIComponent(templateId)}`

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#e63462]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Palette className="w-4 h-4 text-[#e63462]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">QR Menü Tasarım Şablonu (5 Profesyonel Konsept)</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e63462]/10 text-[#e63462] text-[10px] font-semibold">
                <Sparkles className="w-2.5 h-2.5" /> Aktif: {activeOption.title}
              </span>
            </div>
            <p className="text-[11px] text-[#86868b] mt-0.5">
              İşletmenizin atmosferine en uygun QR menü şablonunu tek tıkla seçin veya canlı önizleme ile yeni sekmede test edin.
            </p>
          </div>
        </div>
        <a
          href={buildPreviewUrl(selectedTemplate)}
          target="_blank"
          rel="noreferrer"
          className="h-[32px] px-3 rounded-lg bg-[#1d1d1f] text-white text-[11px] font-medium hover:bg-[#3a3a3c] transition-colors inline-flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Aktif Menüyü Canlı Aç
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {MENU_TEMPLATE_OPTIONS.map((tpl) => {
          const isSelected = selectedTemplate === tpl.id
          return (
            <div
              key={tpl.id}
              role="button"
              tabIndex={canManage ? 0 : -1}
              onClick={() => { if (canManage && selectedTemplate !== tpl.id) onSelect(tpl.id) }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && canManage && selectedTemplate !== tpl.id) {
                  e.preventDefault()
                  onSelect(tpl.id)
                }
              }}
              className={`group relative rounded-2xl border p-3.5 transition-all flex flex-col justify-between text-left ${
                isSelected
                  ? "border-[#e63462] bg-[#e63462]/[0.02] ring-2 ring-[#e63462]/20 shadow-sm"
                  : "border-[#d1d1d6]/70 bg-white hover:border-[#1d1d1f]/40 hover:shadow-sm"
              } ${canManage ? "cursor-pointer" : "opacity-75 cursor-not-allowed"}`}
            >
              <div>
                <TemplateMiniWireframe id={tpl.id} />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#636366] text-[10px] font-semibold">
                    {tpl.tag}
                  </span>
                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e63462] text-white text-[10px] font-semibold">
                      <Check className="w-3 h-3 stroke-[2.5]" /> Aktif Şablon
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-[#86868b] group-hover:text-[#1d1d1f] transition-colors">
                      Seçmek için tıkla
                    </span>
                  )}
                </div>
                <h4 className="text-[13px] font-semibold text-[#1d1d1f] mt-2">{tpl.title}</h4>
                <p className="text-[11px] text-[#86868b] leading-relaxed mt-1">{tpl.description}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#f0f0f0] flex items-center justify-between gap-2">
                <a
                  href={buildPreviewUrl(tpl.id)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="h-[28px] px-2.5 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3 h-3 text-[#e63462]" /> Canlı Önizle
                </a>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (canManage && !isSelected) onSelect(tpl.id)
                  }}
                  className={`h-[28px] px-3 rounded-lg text-[11px] font-semibold transition-colors ${
                    isSelected ? "bg-[#34c759]/15 text-[#1f8a3b]" : "bg-[#1d1d1f] text-white hover:bg-[#e63462]"
                  }`}
                >
                  {isSelected ? "Kullanımda" : "Şablonu Uygula"}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
