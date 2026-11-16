import { useEffect, useState } from "react"
import { useAdminStore } from "@/lib/store"
import type { BossTier, RootAdmin } from "@/lib/types"
import { BossFormModal } from "@/components/BossFormModal"
import {
  Crown,
  Plus,
  Building2,
  Mail,
  Phone,
  Pencil,
  Trash2,
  ExternalLink,
  Layers,
} from "lucide-react"

function getTierBadge(tier?: BossTier) {
  if (tier === "brand_owner") {
    return {
      label: "Marka & Üst Franchise Sahibi (HQ)",
      cls: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    }
  }
  if (tier === "regional_manager") {
    return {
      label: "Bölge / Grup Yöneticisi",
      cls: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    }
  }
  return {
    label: "Şube / Franchise Sahibi (Şube Boss)",
    cls: "bg-[#e63462]/15 text-[#e63462] border-[#e63462]/30",
  }
}

export function BossesPage() {
  const {
    allBosses,
    bossesLoading,
    loadAllBosses,
    restaurants,
    loadRestaurants,
    createBoss,
    updateBoss,
    deleteBoss,
  } = useAdminStore()

  const [showModal, setShowModal] = useState(false)
  const [editingBoss, setEditingBoss] = useState<RootAdmin | null>(null)

  useEffect(() => {
    void loadAllBosses()
    void loadRestaurants()
  }, [loadAllBosses, loadRestaurants])

  const openCreate = () => {
    setEditingBoss(null)
    setShowModal(true)
  }

  const openEdit = (boss: RootAdmin) => {
    setEditingBoss(boss)
    setShowModal(true)
  }

  const handleDelete = async (boss: RootAdmin) => {
    if (
      !confirm(
        `${boss.name} (${boss.email}) Boss hesabını tamamen silmek istediğinize emin misiniz?`
      )
    ) {
      return
    }
    try {
      await deleteBoss(boss.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Silinemedi")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2.5">
            <Crown className="h-6 w-6 text-[#e63462]" />
            Marka Sahipleri (HQ) &amp; Şube / Franchise Boss Hesapları
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            En tepedeki <strong className="text-white">Marka / Üst Franchise Sahipleri (HQ)</strong> tüm şubelerin eksiksiz analiz ve cirosunu görür. <strong className="text-white">Şube / Franchise Sahipleri</strong> ise kendi dükkanlarının cirosunu, metriklerini ve personel/yetki yapısını yönetir.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#e63462] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#d42d56] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Boss Hesabı Oluştur
        </button>
      </div>

      {bossesLoading && allBosses.length === 0 ? (
        <p className="mt-8 text-zinc-400">Yükleniyor…</p>
      ) : allBosses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-12 text-center">
          <Crown className="mx-auto h-10 w-10 text-zinc-600" />
          <h3 className="mt-3 text-base font-medium text-white">Henüz Boss hesabı yok</h3>
          <p className="mt-1 text-sm text-zinc-400">
            İlk Marka Sahibi (HQ) veya Şube / Franchise Sahibi hesabını oluşturarak şubeleri bağlayın.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#e63462] px-4 py-2 text-sm font-medium text-white hover:bg-[#d42d56]"
          >
            <Plus className="h-4 w-4" />
            Boss Oluştur
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allBosses.map((boss) => {
            const tierBadge = getTierBadge(boss.bossTier)
            return (
              <div
                key={boss.id}
                className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-[#e63462]/15 flex items-center justify-center text-[#e63462] font-bold text-base">
                        {boss.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{boss.name}</h3>
                        <span
                          className={`mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${tierBadge.cls}`}
                        >
                          {tierBadge.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(boss)}
                        className="rounded-lg p-2 text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
                        title="Düzenle & Şube Ata"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void handleDelete(boss)}
                        className="rounded-lg p-2 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{boss.email}</span>
                    </div>
                    {boss.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{boss.phone}</span>
                      </div>
                    )}
                    {boss.brandName && (
                      <div className="flex items-center gap-2 text-purple-300">
                        <Layers className="h-3.5 w-3.5 text-purple-400" />
                        <span>Ana Marka Ağı: <strong>{boss.brandName}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                      Erişebildiği Şubeler ({boss.restaurants?.length ?? 0})
                    </p>
                    {boss.restaurants && boss.restaurants.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {boss.restaurants.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 py-1 text-xs text-zinc-200"
                          >
                            <Building2 className="h-3 w-3 text-[#e63462]" />
                            {r.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-400">Henüz şube atanmamış</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#2a2a2a]/60 flex items-center justify-between text-xs text-zinc-500">
                  <span>Kayıt: {new Date(boss.createdAt).toLocaleDateString("tr-TR")}</span>
                  <button
                    onClick={() => openEdit(boss)}
                    className="text-[#e63462] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    Şube &amp; Rol Yönet <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <BossFormModal
          editingBoss={editingBoss}
          restaurants={restaurants}
          onClose={() => setShowModal(false)}
          onCreateBoss={createBoss}
          onUpdateBoss={updateBoss}
        />
      )}
    </div>
  )
}
