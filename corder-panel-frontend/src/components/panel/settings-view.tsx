import { useState, useEffect, useRef, useMemo } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"
import ImageUpload from "./image-upload"
import { BulkCreateTablesModal, NotificationSoundSettingsCard, TableQrCodesModal } from "./settings/table-qr-and-bulk-modal"
import { MenuTemplatePickerCard } from "./settings/menu-template-picker"
import { TerminalGeofenceCard } from "./settings/terminal-geofence-card"
import { AutoCloseShiftCard } from "./settings/auto-close-shift-card"
import { PrintAgentDownloadCard } from "./settings/print-agent-download-card"
import { Plus, Pencil, Trash2, MapPin, Store, X, Globe, Instagram, MessageCircle, Monitor, Type, LayoutGrid, Image, ToggleLeft, ToggleRight, Zap, Layers, QrCode } from "lucide-react"

type SettingsTab = "general" | "sections-tables" | "appearance" | "social"

export default function SettingsView() {
  const { settings, updateSettings, sections, addSection, updateSection, deleteSection, tables, addTable, bulkCreateTables, deleteTable, currentUser, hasPermission } = usePanelStore()
  const { token, currentBusiness } = usePanelAuth()

  const isBoss = currentUser?.role === "root"
  const canManageSettings = isBoss || hasPermission("system.manage_settings")
  const canManageTables = isBoss || hasPermission("system.manage_tables")

  const [activeTab, setActiveTab] = useState<SettingsTab>("general")
  const [name, setName] = useState(settings.name)
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || "")
  const [address, setAddress] = useState(settings.address || "")
  const [phone, setPhone] = useState(settings.phone || "")
  const [taxId, setTaxId] = useState(settings.taxId || "")
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp || "")
  const [instagram, setInstagram] = useState(settings.instagram || "")
  const [facebook, setFacebook] = useState(settings.facebook || "")
  const [website, setWebsite] = useState(settings.website || "")
  const [workingHours, setWorkingHours] = useState(settings.workingHours || "")

  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">(settings.fontSize || "medium")
  const [tableCardSize, setTableCardSize] = useState<"compact" | "normal" | "large">(settings.tableCardSize || "normal")
  const [showProductImages, setShowProductImages] = useState(settings.showProductImages !== false)
  const [quickActionsEnabled, setQuickActionsEnabled] = useState(settings.quickActionsEnabled !== false)

  useEffect(() => {
    setName(settings.name || ""); setLogoUrl(settings.logoUrl || ""); setAddress(settings.address || ""); setPhone(settings.phone || ""); setTaxId(settings.taxId || "")
    setWhatsapp(settings.whatsapp || ""); setInstagram(settings.instagram || ""); setFacebook(settings.facebook || ""); setWebsite(settings.website || ""); setWorkingHours(settings.workingHours || "")
    setFontSize(settings.fontSize || "medium"); setTableCardSize(settings.tableCardSize || "normal"); setShowProductImages(settings.showProductImages !== false); setQuickActionsEnabled(settings.quickActionsEnabled !== false)
  }, [settings])

  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [editingSec, setEditingSec] = useState<string | null>(null)
  const [showAddTable, setShowAddTable] = useState<string | null>(null)
  const [newTableName, setNewTableName] = useState("")
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false)
  const [showQrCodesModal, setShowQrCodesModal] = useState(false)
  const secRenameCommittedRef = useRef(false)

  const commitSectionRename = (secId: string, rawVal: string) => {
    if (secRenameCommittedRef.current) return
    secRenameCommittedRef.current = true
    const trimmed = rawVal.trim()
    const existing = sections.find((s) => s.id === secId)
    if (trimmed && existing && trimmed !== existing.name) void updateSection(secId, trimmed)
    setEditingSec(null)
  }

  const handleSaveSettings = () => {
    if (!canManageSettings) return
    updateSettings({
      name: name.trim(),
      logoUrl: logoUrl.trim() || null,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      taxId: taxId.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      instagram: instagram.trim() || undefined,
      facebook: facebook.trim() || undefined,
      website: website.trim() || undefined,
      workingHours: workingHours.trim() || undefined,
    })
  }

  const handleAddSection = () => {
    if (!canManageTables || !newSectionName.trim()) return
    addSection(newSectionName.trim())
    setNewSectionName("")
    setShowAddSection(false)
  }

  const handleAddTable = (section: string) => {
    if (!canManageTables || !newTableName.trim()) return
    addTable(newTableName.trim(), section)
    setNewTableName("")
    setShowAddTable(null)
  }

  const TABS = useMemo(() => {
    const list: { id: SettingsTab; label: string; icon: React.ElementType }[] = []
    if (canManageSettings) list.push({ id: "general", label: "Genel Bilgiler", icon: Store })
    if (canManageTables) list.push({ id: "sections-tables", label: "Bölüm & Masalar", icon: MapPin })
    list.push({ id: "appearance", label: "Görünüm & Bildirim", icon: Monitor })
    if (canManageSettings) list.push({ id: "social", label: "QR Menü & Sosyal Medya", icon: Globe })
    return list
  }, [canManageSettings, canManageTables])

  useEffect(() => {
    if (TABS.length > 0 && !TABS.some((t) => t.id === activeTab)) setActiveTab(TABS[0].id)
  }, [TABS, activeTab])

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-white border-b border-[#d1d1d6]/40 px-3.5 sm:px-5 py-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-[36px] px-4 rounded-full text-[13px] font-medium transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id ? "bg-[#e63462] text-white" : "text-[#86868b] hover:bg-[#f5f5f7]"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3.5 sm:p-5">
        <div className="w-full flex flex-col gap-6">
          {activeTab === "general" && canManageSettings && (
            <>
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Store className="w-4 h-4 text-[#e63462]" />
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Restoran Bilgileri &amp; QR Menü Logosu</h3>
                </div>
                <div className="mb-4 pb-4 border-b border-[#f0f0f0]">
                  <ImageUpload
                    label="Restoran Logosu (QR Menü Sol Üst)"
                    value={logoUrl}
                    onChange={(url) => setLogoUrl(url)}
                    onUpload={(file) =>
                      token
                        ? api.upload(token, file).then((res) => res.url)
                        : Promise.reject(new Error("Oturum gerekli"))
                    }
                    placeholder="PNG, JPG, WEBP - Maks 5MB"
                  />
                  <p className="text-[11px] text-[#86868b] mt-1.5">
                    Yüklenmezse QR menüde restoran adının baş harfi gösterilir.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 block">İşletme Adı</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Telefon (QR Menü)</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Örn: 0232 000 00 00" className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Açık Adres / Konum (QR Menü)</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Müşterilerin QR menüde göreceği açık adres" className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Vergi No</label>
                    <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 block">Çalışma Saatleri</label>
                    <input type="text" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder="09:00 - 23:00" className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={handleSaveSettings} className="h-[34px] px-5 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56] transition-colors">
                    Kaydet
                  </button>
                </div>
              </div>
              <PrintAgentDownloadCard />
              <AutoCloseShiftCard />
              <TerminalGeofenceCard />
              <NotificationSoundSettingsCard />
            </>
          )}

          {activeTab === "sections-tables" && canManageTables && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#e63462]" />
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Bölüm &amp; Masa Yönetimi</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setShowQrCodesModal(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#1d1d1f] text-white rounded-lg text-[11px] font-medium hover:bg-[#3a3a3c] transition-colors">
                    <QrCode className="w-3.5 h-3.5" /> Masaya Özel QR Kodlar (Garson Çağrılı)
                  </button>
                  <button type="button" onClick={() => setShowBulkCreateModal(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[11px] font-medium hover:bg-[#d42d56] transition-colors">
                    <Layers className="w-3.5 h-3.5" /> Çoklu Masa Oluştur (Örn: B1..B20)
                  </button>
                  <button type="button" onClick={() => { setShowAddSection(true); setNewSectionName("") }} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462]/10 text-[#e63462] rounded-lg text-[11px] font-medium hover:bg-[#e63462]/20 transition-colors">
                    <Plus className="w-3 h-3" /> Bölüm Ekle
                  </button>
                </div>
              </div>

              {showAddSection && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-[#f5f5f7] rounded-lg">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="Bölüm adı"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddSection() }}
                    className="flex-1 h-[30px] px-2.5 text-[12px] bg-white rounded border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                  />
                  <button onClick={() => setShowAddSection(false)} className="h-[30px] px-3 text-[11px] font-medium text-[#86868b] rounded border border-[#d1d1d6]/60 hover:bg-white">İptal</button>
                  <button onClick={handleAddSection} className="h-[30px] px-3 text-[11px] font-medium text-white bg-[#e63462] rounded hover:bg-[#d42d56]">Ekle</button>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {sections.map((sec) => {
                  const sectionTables = tables.filter((t) => t.section === sec.name)
                  return (
                    <div key={sec.id} className="border border-[#d1d1d6]/40 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#f9f9f9] border-b border-[#f0f0f0]">
                        {editingSec === sec.id ? (
                          <input
                            type="text"
                            defaultValue={sec.name}
                            autoFocus
                            onBlur={(e) => commitSectionRename(sec.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitSectionRename(sec.id, e.currentTarget.value)
                              else if (e.key === "Escape") { secRenameCommittedRef.current = true; setEditingSec(null) }
                            }}
                            className="h-[26px] px-2 text-[13px] bg-white rounded border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                          />
                        ) : (
                          <span className="text-[13px] font-semibold text-[#1d1d1f]">{sec.name}</span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#86868b]">{sectionTables.length} masa</span>
                          <button onClick={() => { secRenameCommittedRef.current = false; setEditingSec(sec.id) }} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/80">
                            <Pencil className="w-3 h-3 text-[#86868b]" />
                          </button>
                          <button onClick={() => void deleteSection(sec.id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                          <button onClick={() => { setShowAddTable(sec.id); setNewTableName("") }} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e63462]/10">
                            <Plus className="w-3 h-3 text-[#e63462]" />
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        {showAddTable === sec.id && (
                          <div className="flex items-center gap-2 mb-2 p-2 bg-[#f5f5f7] rounded-lg">
                            <input
                              type="text"
                              value={newTableName}
                              onChange={(e) => setNewTableName(e.target.value)}
                              placeholder="Masa adı"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddTable(sec.name) }}
                              className="flex-1 h-[28px] px-2.5 text-[12px] bg-white rounded border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                            />
                            <button onClick={() => setShowAddTable(null)} className="text-[11px] text-[#86868b] hover:text-[#1d1d1f]"><X className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleAddTable(sec.name)} className="h-[28px] px-2.5 text-[11px] font-medium text-white bg-[#e63462] rounded hover:bg-[#d42d56]">Ekle</button>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {sectionTables.map((t) => {
                            const isOccupied = t.status !== "empty"
                            return (
                              <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f7] rounded-lg group">
                                <span className={`text-[12px] font-medium ${isOccupied ? "text-[#e63462]" : "text-[#1d1d1f]"}`}>{t.name}</span>
                                {!isOccupied && (
                                  <button onClick={() => deleteTable(t.id)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center hover:bg-red-100 transition-all">
                                    <X className="w-2.5 h-2.5 text-red-400" />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                          {sectionTables.length === 0 && <span className="text-[12px] text-[#d1d1d6]">Masa yok</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <>
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Monitor className="w-4 h-4 text-[#e63462]" />
                  <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Görünüm Ayarları</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[12px] text-[#86868b] font-medium mb-2 flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5" /> Yazı Boyutu
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["small", "medium", "large"] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => { setFontSize(size); updateSettings({ fontSize: size }) }}
                          className={`h-[40px] rounded-lg text-[12px] font-medium transition-colors ${fontSize === size ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"}`}
                        >
                          <span className={size === "small" ? "text-[11px]" : size === "large" ? "text-[14px]" : "text-[12px]"}>
                            {size === "small" ? "Küçük" : size === "medium" ? "Normal" : "Büyük"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] text-[#86868b] font-medium mb-2 flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5" /> Masa Kartı Boyutu
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["compact", "normal", "large"] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => { setTableCardSize(size); updateSettings({ tableCardSize: size }) }}
                          className={`h-[40px] rounded-lg text-[12px] font-medium transition-colors ${tableCardSize === size ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"}`}
                        >
                          {size === "compact" ? "Kompakt" : size === "normal" ? "Normal" : "Geniş"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#e63462]/10 flex items-center justify-center"><Image className="w-4 h-4 text-[#e63462]" /></div>
                        <div>
                          <p className="text-[13px] font-medium text-[#1d1d1f]">Ürün Görselleri</p>
                          <p className="text-[11px] text-[#86868b]">Sipariş ekranında görselleri göster</p>
                        </div>
                      </div>
                      <button onClick={() => { setShowProductImages(!showProductImages); updateSettings({ showProductImages: !showProductImages }) }}>
                        {showProductImages ? <ToggleRight className="w-9 h-9 text-[#e63462]" /> : <ToggleLeft className="w-9 h-9 text-[#d1d1d6]" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#007aff]/10 flex items-center justify-center"><Zap className="w-4 h-4 text-[#007aff]" /></div>
                        <div>
                          <p className="text-[13px] font-medium text-[#1d1d1f]">Hızlı İşlemler</p>
                          <p className="text-[11px] text-[#86868b]">Masa kartlarında hızlı işlem butonları</p>
                        </div>
                      </div>
                      <button onClick={() => { setQuickActionsEnabled(!quickActionsEnabled); updateSettings({ quickActionsEnabled: !quickActionsEnabled }) }}>
                        {quickActionsEnabled ? <ToggleRight className="w-9 h-9 text-[#007aff]" /> : <ToggleLeft className="w-9 h-9 text-[#d1d1d6]" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <MenuTemplatePickerCard
                selectedTemplate={settings.menuTemplate || "classic"}
                restaurantSlug={currentBusiness?.slug || "restoran"}
                canManage={canManageSettings}
                onSelect={(tpl) => updateSettings({ menuTemplate: tpl })}
              />
              <NotificationSoundSettingsCard />
            </>
          )}

          {activeTab === "social" && canManageSettings && (
            <>
              <MenuTemplatePickerCard
                selectedTemplate={settings.menuTemplate || "classic"}
                restaurantSlug={currentBusiness?.slug || "restoran"}
                canManage={canManageSettings}
                onSelect={(tpl) => updateSettings({ menuTemplate: tpl })}
              />
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#e63462]" />
                    <h3 className="text-[14px] font-semibold text-[#1d1d1f]">QR Menü İletişim &amp; Sosyal Medya</h3>
                  </div>
                  <button type="button" onClick={() => setShowQrCodesModal(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#1d1d1f] text-white rounded-lg text-[11px] font-medium hover:bg-[#3a3a3c]">
                    <QrCode className="w-3.5 h-3.5" /> Masaya Özel QR Kodları &amp; Yazdır
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1">Telefon (Menüde Gösterilir)</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Örn: 0232 000 00 00" className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Açık Adres / Konum (Menüde Gösterilir)</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Örn: Bornova Küçükpark, İzmir" className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> WhatsApp</label>
                    <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="905551234567" className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram</label>
                    <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@kullanici_adi" className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Facebook</label>
                    <input type="text" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/sayfa" className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#86868b] font-medium mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Web Sitesi</label>
                    <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="w-full h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                </div>
                <p className="text-[10px] text-[#86868b] mt-3">Bu bilgiler menü sayfasındaki iletişim bölümünde gösterilir.</p>
                <div className="flex justify-end mt-4">
                  <button onClick={handleSaveSettings} className="h-[34px] px-5 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56] transition-colors">Kaydet</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showBulkCreateModal && (
        <BulkCreateTablesModal sections={sections} onClose={() => setShowBulkCreateModal(false)} onBulkCreate={bulkCreateTables} />
      )}
      {showQrCodesModal && (
        <TableQrCodesModal
          restaurantName={settings.name || currentBusiness?.name || "Restoran"}
          restaurantSlug={currentBusiness?.slug || "restoran"}
          tables={tables}
          onClose={() => setShowQrCodesModal(false)}
        />
      )}
    </div>
  )
}
