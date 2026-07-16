import { useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { Plus, Pencil, Trash2, MapPin, Store, X, Globe, Instagram, MessageCircle, Monitor, Type, LayoutGrid, Image, ToggleLeft, ToggleRight, Zap } from "lucide-react"

type SettingsTab = "genel" | "bolum-masa" | "gorunum" | "sosyal"

export default function SettingsView() {
  const { settings, updateSettings, sections, addSection, updateSection, deleteSection, tables, addTable, deleteTable } = usePanelStore()
  
  const [activeTab, setActiveTab] = useState<SettingsTab>("genel")

  const [name, setName] = useState(settings.name)
  const [address, setAddress] = useState(settings.address || "")
  const [phone, setPhone] = useState(settings.phone || "")
  const [taxId, setTaxId] = useState(settings.taxId || "")
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp || "")
  const [instagram, setInstagram] = useState(settings.instagram || "")
  const [facebook, setFacebook] = useState(settings.facebook || "")
  const [website, setWebsite] = useState(settings.website || "")
  const [workingHours, setWorkingHours] = useState(settings.workingHours || "")
  
  // Display settings
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">(settings.fontSize || "medium")
  const [tableCardSize, setTableCardSize] = useState<"compact" | "normal" | "large">(settings.tableCardSize || "normal")
  const [showProductImages, setShowProductImages] = useState(settings.showProductImages !== false)
  const [quickActionsEnabled, setQuickActionsEnabled] = useState(settings.quickActionsEnabled !== false)

  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [editingSec, setEditingSec] = useState<string | null>(null)

  const [showAddTable, setShowAddTable] = useState<string | null>(null)
  const [newTableName, setNewTableName] = useState("")

  const handleSaveSettings = () => {
    updateSettings({ 
      name, 
      address: address || undefined, 
      phone: phone || undefined, 
      taxId: taxId || undefined,
      whatsapp: whatsapp || undefined,
      instagram: instagram || undefined,
      facebook: facebook || undefined,
      website: website || undefined,
      workingHours: workingHours || undefined,
    })
  }

  const handleAddSection = () => {
    if (!newSectionName.trim()) return
    addSection(newSectionName)
    setNewSectionName(""); setShowAddSection(false)
  }

  const handleAddTable = (section: string) => {
    if (!newTableName.trim()) return
    addTable(newTableName, section)
    setNewTableName(""); setShowAddTable(null)
  }

  const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "genel", label: "Genel Bilgiler", icon: Store },
    { id: "bolum-masa", label: "Bolum & Masalar", icon: MapPin },
    { id: "gorunum", label: "Gorunum", icon: Monitor },
    { id: "sosyal", label: "Sosyal Medya", icon: Globe },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center px-5">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Ayarlar</h2>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 bg-white border-b border-[#d1d1d6]/40 px-5 py-3">
        <div className="flex items-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-[36px] px-4 rounded-full text-[13px] font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-[#e63462] text-white"
                  : "text-[#86868b] hover:bg-[#f5f5f7]"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-3xl flex flex-col gap-6">
          
          {/* ===== GENERAL INFO ===== */}
          {activeTab === "genel" && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Store className="w-4 h-4 text-[#e63462]" />
                <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Restoran Bilgileri</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Isletme Adi</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                </div>
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Telefon</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Adres</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                </div>
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Vergi No</label>
                  <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)}
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                </div>
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Calisma Saatleri</label>
                  <input type="text" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder="09:00 - 23:00"
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={handleSaveSettings}
                  className="h-[34px] px-5 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56] transition-colors">
                  Kaydet
                </button>
              </div>
            </div>
          )}

          {/* ===== SECTION & TABLE ===== */}
          {activeTab === "bolum-masa" && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#e63462]" />
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Bolum & Masa Yonetimi</h3>
                </div>
                <button onClick={() => { setShowAddSection(true); setNewSectionName("") }}
                  className="h-[28px] px-3 flex items-center gap-1.5 bg-[#e63462]/10 text-[#e63462] rounded-lg text-[11px] font-medium hover:bg-[#e63462]/20 transition-colors">
                  <Plus className="w-3 h-3" /> Bolum Ekle
                </button>
              </div>

              {showAddSection && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-[#f5f5f7] rounded-lg">
                  <input type="text" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="Bolum adi"
                    autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleAddSection() }}
                    className="flex-1 h-[30px] px-2.5 text-[12px] bg-white rounded border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  <button onClick={() => setShowAddSection(false)} className="h-[30px] px-3 text-[11px] font-medium text-[#86868b] rounded border border-[#d1d1d6]/60 hover:bg-white">Iptal</button>
                  <button onClick={handleAddSection} className="h-[30px] px-3 text-[11px] font-medium text-white bg-[#e63462] rounded hover:bg-[#d42d56]">Ekle</button>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {sections.map((sec) => {
                  const sectionTables = tables.filter((t) => t.section === sec.name)
                  return (
                    <div key={sec.id} className="border border-[#d1d1d6]/40 rounded-xl overflow-hidden">
                      {/* Section header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#f9f9f9] border-b border-[#f0f0f0]">
                        {editingSec === sec.id ? (
                          <input type="text" defaultValue={sec.name} autoFocus
                            onBlur={(e) => { updateSection(sec.id, e.target.value); setEditingSec(null) }}
                            onKeyDown={(e) => { if (e.key === "Enter") { updateSection(sec.id, e.currentTarget.value); setEditingSec(null) } }}
                            className="h-[26px] px-2 text-[13px] bg-white rounded border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                        ) : (
                          <span className="text-[13px] font-semibold text-[#1d1d1f]">{sec.name}</span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#86868b]">{sectionTables.length} masa</span>
                          <button onClick={() => setEditingSec(sec.id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/80">
                            <Pencil className="w-3 h-3 text-[#86868b]" />
                          </button>
                          <button onClick={() => deleteSection(sec.id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                          <button onClick={() => { setShowAddTable(sec.id); setNewTableName("") }}
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e63462]/10">
                            <Plus className="w-3 h-3 text-[#e63462]" />
                          </button>
                        </div>
                      </div>

                      {/* Tables */}
                      <div className="p-3">
                        {showAddTable === sec.id && (
                          <div className="flex items-center gap-2 mb-2 p-2 bg-[#f5f5f7] rounded-lg">
                            <input type="text" value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="Masa adi"
                              autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleAddTable(sec.name) }}
                              className="flex-1 h-[28px] px-2.5 text-[12px] bg-white rounded border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                            <button onClick={() => setShowAddTable(null)} className="text-[11px] text-[#86868b] hover:text-[#1d1d1f]">
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleAddTable(sec.name)} className="h-[28px] px-2.5 text-[11px] font-medium text-white bg-[#e63462] rounded hover:bg-[#d42d56]">Ekle</button>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {sectionTables.map((t) => (
                            <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f7] rounded-lg group">
                              <span className={`text-[12px] font-medium ${t.status === "occupied" ? "text-[#e63462]" : "text-[#1d1d1f]"}`}>
                                {t.name}
                              </span>
                              {t.status === "empty" && (
                                <button onClick={() => deleteTable(t.id)}
                                  className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center hover:bg-red-100 transition-all">
                                  <X className="w-2.5 h-2.5 text-red-400" />
                                </button>
                              )}
                            </div>
                          ))}
                          {sectionTables.length === 0 && <span className="text-[12px] text-[#d1d1d6]">Masa yok</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ===== APPEARANCE ===== */}
          {activeTab === "gorunum" && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-4 h-4 text-[#e63462]" />
                <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Gorunum Ayarlari</h3>
              </div>
              
              <div className="space-y-4">
                {/* Font Size */}
                <div>
                  <label className="text-[12px] text-[#86868b] font-medium mb-2 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5" /> Yazi Boyutu
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["small", "medium", "large"] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setFontSize(size)
                          updateSettings({ fontSize: size })
                        }}
                        className={`h-[40px] rounded-lg text-[12px] font-medium transition-colors ${
                          fontSize === size 
                            ? "bg-[#e63462] text-white" 
                            : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                        }`}
                      >
                        <span className={size === "small" ? "text-[11px]" : size === "large" ? "text-[14px]" : "text-[12px]"}>
                          {size === "small" ? "Kucuk" : size === "medium" ? "Normal" : "Buyuk"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table Card Size */}
                <div>
                  <label className="text-[12px] text-[#86868b] font-medium mb-2 flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5" /> Masa Karti Boyutu
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["compact", "normal", "large"] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setTableCardSize(size)
                          updateSettings({ tableCardSize: size })
                        }}
                        className={`h-[40px] rounded-lg text-[12px] font-medium transition-colors ${
                          tableCardSize === size 
                            ? "bg-[#e63462] text-white" 
                            : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                        }`}
                      >
                        {size === "compact" ? "Kompakt" : size === "normal" ? "Normal" : "Genis"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle options */}
                <div className="space-y-3 pt-2">
                  {/* Show Product Images */}
                  <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#e63462]/10 flex items-center justify-center">
                        <Image className="w-4 h-4 text-[#e63462]" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#1d1d1f]">Urun Gorselleri</p>
                        <p className="text-[11px] text-[#86868b]">Siparis ekraninda gorselleri goster</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setShowProductImages(!showProductImages)
                        updateSettings({ showProductImages: !showProductImages })
                      }}
                    >
                      {showProductImages ? (
                        <ToggleRight className="w-9 h-9 text-[#e63462]" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-[#d1d1d6]" />
                      )}
                    </button>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#007aff]/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-[#007aff]" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#1d1d1f]">Hizli Islemler</p>
                        <p className="text-[11px] text-[#86868b]">Masa kartlarinda hizli islem butonlari</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setQuickActionsEnabled(!quickActionsEnabled)
                        updateSettings({ quickActionsEnabled: !quickActionsEnabled })
                      }}
                    >
                      {quickActionsEnabled ? (
                        <ToggleRight className="w-9 h-9 text-[#007aff]" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-[#d1d1d6]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== SOCIAL MEDIA ===== */}
          {activeTab === "sosyal" && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-[#e63462]" />
                <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Sosyal Medya & Iletisim</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> WhatsApp
                  </label>
                  <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="905551234567"
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                </div>
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1">
                    <Instagram className="w-3 h-3" /> Instagram
                  </label>
                  <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@kullanici_adi"
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                </div>
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Facebook
                  </label>
                  <input type="text" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/sayfa"
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                </div>
                <div>
                  <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Web Sitesi
                  </label>
                  <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..."
                    className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                </div>
              </div>
              <p className="text-[10px] text-[#86868b] mt-3">Bu bilgiler menu sayfasindaki iletisim bolumunde gosterilir.</p>
              <div className="flex justify-end mt-4">
                <button onClick={handleSaveSettings}
                  className="h-[34px] px-5 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56] transition-colors">
                  Kaydet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
