import { useEffect, useState } from "react"
import { useAdminStore } from "@/lib/store"
import { formatIstanbulDate } from "@/lib/money"
import type { BossTier, RootAdmin } from "@/lib/types"
import { BossFormModal } from "@/components/BossFormModal"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { PaginationBar } from "@/components/ui/pagination-bar"
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
  RefreshCw,
} from "lucide-react"

function getTierBadge(tier?: BossTier) {
  if (tier === "brand_owner") {
    return {
      label: "Marka & Üst Franchise Sahibi (HQ)",
      cls: "bg-purple-50 text-purple-700 border-purple-200",
    }
  }
  if (tier === "regional_manager") {
    return {
      label: "Bölge / Grup Yöneticisi",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
    }
  }
  return {
    label: "Şube / Franchise Sahibi (Şube Boss)",
    cls: "bg-[#fef3f5] text-[#e63462] border-[#e63462]/25",
  }
}

const BOSSES_PAGE_SIZE = 12

export function BossesPage() {
  const {
    allBosses,
    bossesLoading,
    bossesError,
    loadAllBosses,
    restaurants,
    loadRestaurants,
    createBoss,
    updateBoss,
    deleteBoss,
  } = useAdminStore()

  const confirm = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [editingBoss, setEditingBoss] = useState<RootAdmin | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(allBosses.length / BOSSES_PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedBosses = allBosses.slice(
    (safePage - 1) * BOSSES_PAGE_SIZE,
    safePage * BOSSES_PAGE_SIZE
  )

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

  const handleToggleActive = async (boss: RootAdmin) => {
    setActionError(null)
    try {
      await updateBoss(boss.id, { isActive: boss.isActive === false })
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Durum güncellenemedi"
      )
    }
  }

  const handleDelete = async (boss: RootAdmin) => {
    if (
      !(await confirm({
        title: "Boss Hesabını Sil",
        message: `${boss.name} (${boss.email}) Boss hesabını tamamen silmek istediğinize emin misiniz?`,
        confirmLabel: "Hesabı Sil",
        variant: "danger",
      }))
    ) {
      return
    }
    setActionError(null)
    try {
      await deleteBoss(boss.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Silinemedi")
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-[#e63462]" />
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
              Marka Sahipleri (HQ) &amp; Şube / Franchise Boss Hesapları ({allBosses.length})
            </h2>
          </div>
          <p className="mt-0.5 text-[12px] text-[#86868b]">
            <span className="font-semibold text-[#1d1d1f]">Marka Sahipleri (HQ)</span> tüm şubelerin analiz ve cirosunu görür; <span className="font-semibold text-[#1d1d1f]">Şube / Franchise Sahipleri</span> ise kendi dükkanlarının cirosunu ve personel/yetki yapısını yönetir.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#e63462] px-3.5 text-[12px] font-semibold text-white hover:bg-[#d42d56] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Boss Hesabı Oluştur
        </button>
      </div>

      {(bossesError || actionError) && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <span>{bossesError || actionError}</span>
          {bossesError && (
            <button
              type="button"
              onClick={() => void loadAllBosses()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
            >
              <RefreshCw className="h-3 w-3" />
              Yenile
            </button>
          )}
        </div>
      )}

      {bossesLoading && allBosses.length === 0 ? (
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-10 text-center text-[13px] text-[#86868b]">
          Yükleniyor…
        </div>
      ) : allBosses.length === 0 ? (
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-12 text-center">
          <Crown className="mx-auto h-9 w-9 text-[#86868b]" />
          <h3 className="mt-2 text-[15px] font-semibold text-[#1d1d1f]">Henüz Boss hesabı yok</h3>
          <p className="mt-1 text-[12px] text-[#86868b]">
            İlk Marka Sahibi (HQ) veya Şube / Franchise Sahibi hesabını oluşturarak şubeleri bağlayın.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#e63462] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#d42d56]"
          >
            <Plus className="h-4 w-4" />
            Boss Oluştur
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedBosses.map((boss) => {
            const tierBadge = getTierBadge(boss.bossTier)
            const isActive = boss.isActive !== false
            return (
              <div
                key={boss.id}
                className="rounded-2xl border border-[#e5e5ea] bg-white p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#e63462]/12 flex items-center justify-center text-[#e63462] font-semibold text-[15px]">
                        {boss.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[14px] font-semibold text-[#1d1d1f]">{boss.name}</h3>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(boss)}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-600"
                            }`}
                            title="Durumu değiştirmek için tıklayın"
                          >
                            {isActive ? "Aktif" : "Pasif"}
                          </button>
                        </div>
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
                        className="rounded-lg bg-[#f5f5f7] p-2 text-[#636366] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]"
                        title="Düzenle & Şube Ata"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void handleDelete(boss)}
                        className="rounded-lg bg-[#f5f5f7] p-2 text-red-500 hover:bg-red-50"
                        title="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-[12px] text-[#636366]">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-[#86868b]" />
                      <span>{boss.email}</span>
                    </div>
                    {boss.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-[#86868b]" />
                        <span>{boss.phone}</span>
                      </div>
                    )}
                    {boss.brandName && (
                      <div className="flex items-center gap-2 text-purple-700">
                        <Layers className="h-3.5 w-3.5 text-purple-600" />
                        <span>
                          Ana Marka Ağı: <span className="font-semibold">{boss.brandName}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3.5 pt-3.5 border-t border-[#f0f0f0]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b] mb-2">
                      Erişebildiği Şubeler ({boss.restaurants?.length ?? 0})
                    </p>
                    {boss.restaurants && boss.restaurants.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {boss.restaurants.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5ea] bg-[#f9f9fb] px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f]"
                          >
                            <Building2 className="h-3 w-3 text-[#e63462]" />
                            {r.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-amber-600 font-medium">Henüz şube atanmamış</p>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-[#f0f0f0] flex items-center justify-between text-[11px] text-[#86868b]">
                  <span>Kayıt: {formatIstanbulDate(boss.createdAt)}</span>
                  <button
                    onClick={() => openEdit(boss)}
                    className="text-[#e63462] hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    Şube &amp; Rol Yönet <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
          </div>
          <div className="rounded-2xl border border-[#e5e5ea] bg-white overflow-hidden">
            <PaginationBar
              currentPage={safePage}
              totalItems={allBosses.length}
              pageSize={BOSSES_PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="Boss hesabı"
              className="border-t-0"
            />
          </div>
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
