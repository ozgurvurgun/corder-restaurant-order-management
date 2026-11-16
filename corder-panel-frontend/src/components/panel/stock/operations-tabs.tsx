import { ArrowDown, ArrowUp, ClipboardList, Plus, Trash2 } from "lucide-react"
import type { InventoryCount, StockMaterial, StockMovement, Supplier } from "@/lib/panel-types"
import { AddMovementForm, AddSupplierForm } from "./stock-modals"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }
function formatDate(d: Date) { return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }

export function MovementsTab(props: {
  stockMaterials: StockMaterial[]
  stockMovements: StockMovement[]
  showAddMovement: boolean
  setShowAddMovement: (v: boolean) => void
  mvMatId: string
  setMvMatId: (v: string) => void
  mvType: "in" | "out" | "waste"
  setMvType: (v: "in" | "out" | "waste") => void
  mvQty: string
  setMvQty: (v: string) => void
  mvCost: string
  setMvCost: (v: string) => void
  mvReason: string
  setMvReason: (v: string) => void
  handleAddMovement: () => void
}) {
  const {
    stockMaterials, stockMovements, showAddMovement, setShowAddMovement,
    mvMatId, setMvMatId, mvType, setMvType, mvQty, setMvQty, mvCost, setMvCost,
    mvReason, setMvReason, handleAddMovement,
  } = props

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setShowAddMovement(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56]">
          <Plus className="w-3.5 h-3.5" /> Hareket Ekle
        </button>
      </div>
      {showAddMovement && (
        <AddMovementForm
          stockMaterials={stockMaterials} mvMatId={mvMatId} setMvMatId={setMvMatId}
          mvType={mvType} setMvType={setMvType} mvQty={mvQty} setMvQty={setMvQty}
          mvCost={mvCost} setMvCost={setMvCost} mvReason={mvReason} setMvReason={setMvReason}
          onClose={() => setShowAddMovement(false)} onSubmit={handleAddMovement}
        />
      )}
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tarih</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Malzeme</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tur</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Miktar</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Stok</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Sebep</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Isleyen</th>
            </tr>
          </thead>
          <tbody>
            {stockMovements.map((mv, idx) => (
              <tr key={mv.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                <td className="px-4 py-2 text-[12px] text-[#86868b]">{formatDate(mv.createdAt)}</td>
                <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">{mv.materialName}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1 ${mv.type === "in" ? "bg-green-50 text-green-600" : mv.type === "out" ? "bg-blue-50 text-blue-600" : mv.type === "waste" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"}`}>
                    {mv.type === "in" ? <><ArrowDown className="w-2.5 h-2.5" /> Giris</> : mv.type === "out" ? <><ArrowUp className="w-2.5 h-2.5" /> Cikis</> : mv.type === "waste" ? "Fire" : "Sayim"}
                  </span>
                </td>
                <td className={`px-4 py-2 text-[12px] text-right font-semibold ${mv.type === "in" || (mv.type === "count-adjustment" && mv.quantity > 0) ? "text-green-600" : "text-red-500"}`}>
                  {mv.type === "count-adjustment" ? `${mv.quantity > 0 ? "+" : ""}${mv.quantity}` : `${mv.type === "in" ? "+" : "-"}${mv.quantity}`}
                </td>
                <td className="px-4 py-2 text-[12px] text-right text-[#86868b]">{mv.previousStock} {"->"} {mv.newStock}</td>
                <td className="px-4 py-2 text-[12px] text-[#86868b]">{mv.reason || "-"}</td>
                <td className="px-4 py-2 text-[12px] text-[#86868b]">{mv.createdBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function SuppliersTab(props: {
  suppliers: Supplier[]
  showAddSupplier: boolean
  setShowAddSupplier: (v: boolean) => void
  supName: string
  setSupName: (v: string) => void
  supContact: string
  setSupContact: (v: string) => void
  supPhone: string
  setSupPhone: (v: string) => void
  savingSupplier: boolean
  handleAddSupplier: () => void
  updateSupplier: (id: string, data: Partial<Supplier>) => void
  deleteSupplier: (id: string) => void
}) {
  const {
    suppliers, showAddSupplier, setShowAddSupplier, supName, setSupName,
    supContact, setSupContact, supPhone, setSupPhone, savingSupplier,
    handleAddSupplier, updateSupplier, deleteSupplier,
  } = props

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setShowAddSupplier(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56]">
          <Plus className="w-3.5 h-3.5" /> Tedarikci Ekle
        </button>
      </div>
      {showAddSupplier && (
        <AddSupplierForm
          supName={supName} setSupName={setSupName} supContact={supContact} setSupContact={setSupContact}
          supPhone={supPhone} setSupPhone={setSupPhone} savingSupplier={savingSupplier}
          onClose={() => setShowAddSupplier(false)} onSubmit={handleAddSupplier}
        />
      )}
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Firma</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Yetkili</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Telefon</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Durum</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[80px]">Islem</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[#86868b]">Henuz tedarikci yok. Yukaridan &quot;Tedarikci Ekle&quot; ile kayit acin.</td></tr>
            ) : (
              suppliers.map((sup, idx) => (
                <tr key={sup.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{sup.name}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#86868b]">{sup.contactPerson || "-"}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#86868b]">{sup.phone || "-"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button type="button" onClick={() => updateSupplier(sup.id, { active: !sup.active })} className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${sup.active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                      {sup.active ? "Aktif" : "Pasif"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" onClick={() => deleteSupplier(sup.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function InventoryCountsTab(props: {
  inventoryCounts: InventoryCount[]
  startInventoryCount: () => void
  updateInventoryItem: (countId: string, materialId: string, actual: number) => void
  completeInventoryCount: (countId: string) => void
}) {
  const { inventoryCounts, startInventoryCount, updateInventoryItem, completeInventoryCount } = props

  return (
    <>
      <div className="flex justify-end">
        <button onClick={startInventoryCount} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56]">
          <ClipboardList className="w-3.5 h-3.5" /> Yeni Sayim Baslat
        </button>
      </div>
      {inventoryCounts.map((ic) => (
        <div key={ic.id} className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0] bg-[#f9f9f9]">
            <div>
              <h4 className="text-[13px] font-semibold text-[#1d1d1f]">Sayim - {formatDate(ic.date)}</h4>
              <p className="text-[11px] text-[#86868b]">Sayan: {ic.countedBy}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${ic.status === "completed" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                {ic.status === "completed" ? "Tamamlandi" : "Devam Ediyor"}
              </span>
              {ic.status === "in-progress" && (
                <button onClick={() => completeInventoryCount(ic.id)} className="h-[26px] px-3 bg-[#34c759] text-white rounded-lg text-[11px] font-medium hover:bg-[#2db84e]">Tamamla</button>
              )}
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f0f0f0]">
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Malzeme</th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Beklenen</th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Sayilan</th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Fark</th>
              </tr>
            </thead>
            <tbody>
              {ic.items.map((item) => (
                <tr key={item.materialId} className="border-b border-[#f0f0f0]">
                  <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">{item.materialName}</td>
                  <td className="px-4 py-2 text-[12px] text-right text-[#86868b]">{item.expectedStock}</td>
                  <td className="px-4 py-2 text-right">
                    {ic.status === "in-progress" ? (
                      <input type="number" defaultValue={item.actualStock} onBlur={(e) => updateInventoryItem(ic.id, item.materialId, parseFloat(e.target.value) || 0)} className="w-[80px] h-[26px] px-2 text-[12px] text-right bg-[#f5f5f7] rounded border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                    ) : (
                      <span className="text-[12px] text-[#1d1d1f]">{item.actualStock}</span>
                    )}
                  </td>
                  <td className={`px-4 py-2 text-[12px] text-right font-semibold ${item.difference === 0 ? "text-[#86868b]" : item.difference > 0 ? "text-green-600" : "text-red-500"}`}>
                    {item.difference > 0 ? "+" : ""}{item.difference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}

export function CostAnalysisTab(props: {
  costAnalysis: { id: string; name: string; sellPrice: number; costPrice: number; margin: number; marginPercent: number; source: "manual" | "recipe" }[]
}) {
  const { costAnalysis } = props

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-[#86868b] px-1">
        Maliyet: once manuel <span className="font-medium text-[#1d1d1f]">costPrice</span> (varsa), yoksa <span className="font-medium text-[#1d1d1f]">Urun Eslestir</span> recetesi ile malzeme birim maliyetlerinin toplami.
      </p>
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f] px-4 pt-4 pb-2">Urun Maliyet Analizi</h3>
        <table className="w-full">
          <thead>
            <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Urun</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kaynak</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Satis Fiyati</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Maliyet</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kar</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kar Marji</th>
            </tr>
          </thead>
          <tbody>
            {costAnalysis.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[#86868b]">Hesaplanabilir urun yok. Urunlere recete tanimlayin (Urun Eslestir) ve malzemelerde birim maliyet girin.</td></tr>
            ) : (
              costAnalysis.map((item, idx) => (
                <tr key={item.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{item.name}</td>
                  <td className="px-4 py-2.5 text-[11px] text-[#86868b]">{item.source === "manual" ? "Manuel" : "Recete"}</td>
                  <td className="px-4 py-2.5 text-[12px] text-right text-[#1d1d1f]">{"\u20BA"}{formatCurrency(item.sellPrice)}</td>
                  <td className="px-4 py-2.5 text-[12px] text-right text-red-500">{"\u20BA"}{formatCurrency(item.costPrice)}</td>
                  <td className="px-4 py-2.5 text-[12px] text-right font-semibold text-green-600">{"\u20BA"}{formatCurrency(item.margin)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, item.marginPercent))}%`, backgroundColor: item.marginPercent > 60 ? "#34c759" : item.marginPercent > 40 ? "#ff9500" : "#ff3b30" }} />
                      </div>
                      <span className={`text-[12px] font-semibold ${item.marginPercent > 60 ? "text-green-600" : item.marginPercent > 40 ? "text-amber-600" : "text-red-500"}`}>%{item.marginPercent}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
