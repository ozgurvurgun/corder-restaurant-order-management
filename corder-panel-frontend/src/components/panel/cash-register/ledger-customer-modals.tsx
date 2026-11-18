import { Loader2, X } from "lucide-react"
import type { LedgerCustomer, LedgerEntry } from "@/lib/panel-types"
import {
  formatCurrency,
  formatIstanbulDate,
  formatIstanbulTime,
} from "@/lib/format"

export type CollectionMethod = "cash" | "credit-card" | "meal-card" | "multinet"

export const COLLECTION_METHODS: { key: CollectionMethod; label: string }[] = [
  { key: "cash", label: "Nakit" },
  { key: "credit-card", label: "Kredi Kartı" },
  { key: "meal-card", label: "Yemek Kartı" },
  { key: "multinet", label: "Multinet" },
]

export function AddLedgerCustomerModal(props: {
  lcName: string
  setLcName: (v: string) => void
  lcPhone: string
  setLcPhone: (v: string) => void
  lcNotes: string
  setLcNotes: (v: string) => void
  lcSaving: boolean
  onClose: () => void
  onSave: () => void
}) {
  const {
    lcName,
    setLcName,
    lcPhone,
    setLcPhone,
    lcNotes,
    setLcNotes,
    lcSaving,
    onClose,
    onSave,
  } = props

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
            Cari Müşteri Ekle
          </h3>
          <button
            type="button"
            disabled={lcSaving}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          <input
            type="text"
            disabled={lcSaving}
            value={lcName}
            onChange={(e) => setLcName(e.target.value)}
            placeholder="Unvan / Ad Soyad"
            autoFocus
            className="h-[40px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
          />
          <input
            type="tel"
            disabled={lcSaving}
            value={lcPhone}
            onChange={(e) => setLcPhone(e.target.value)}
            placeholder="Telefon (opsiyonel)"
            className="h-[40px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
          />
          <textarea
            disabled={lcSaving}
            value={lcNotes}
            onChange={(e) => setLcNotes(e.target.value)}
            placeholder="Not (opsiyonel)"
            rows={2}
            className="px-3 py-2 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 resize-none"
          />
        </div>
        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button
            type="button"
            disabled={lcSaving}
            onClick={onClose}
            className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b] disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={lcSaving || !lcName.trim()}
            onClick={onSave}
            className="flex-1 h-[38px] rounded-xl bg-[#e63462] text-white text-[13px] font-semibold hover:bg-[#d42d56] disabled:opacity-50"
          >
            {lcSaving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LedgerCustomerDetailModal(props: {
  customer: LedgerCustomer | undefined
  ledgerBounds?: { from: string; to: string }
  ledgerEntries: LedgerEntry[]
  ledgerEntriesLoading: boolean
  canCollectLedger: boolean
  hasOpenShift: boolean
  ledgerPayAmount: string
  setLedgerPayAmount: (v: string) => void
  ledgerPayMethod: CollectionMethod
  setLedgerPayMethod: (v: CollectionMethod) => void
  ledgerPayBusy: boolean
  hasToken: boolean
  onClose: () => void
  onCollect: () => void
}) {
  const {
    customer,
    ledgerBounds,
    ledgerEntries,
    ledgerEntriesLoading,
    canCollectLedger,
    hasOpenShift,
    ledgerPayAmount,
    setLedgerPayAmount,
    ledgerPayMethod,
    setLedgerPayMethod,
    ledgerPayBusy,
    hasToken,
    onClose,
    onCollect,
  } = props

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0] flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
              {customer?.name || "Cari"}
            </h3>
            <p className="text-[12px] text-[#86868b] mt-0.5">
              Güncel bakiye:{" "}
              <span className="font-semibold text-[#1d1d1f]">
                {"\u20BA"}
                {formatCurrency(customer?.balance ?? 0)}
              </span>
            </p>
            {ledgerBounds && (
              <p className="text-[11px] text-[#aeaeb2] mt-1">
                Hareketler Kasa tarih filtresine göre listelenir.
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={ledgerPayBusy}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>
        <div className="px-6 py-4 flex-1 overflow-y-auto">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">
            Hareketler
          </p>
          {ledgerEntriesLoading ? (
            <div className="flex items-center justify-center py-12 text-[#86868b] gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-[13px]">Yükleniyor…</span>
            </div>
          ) : ledgerEntries.length === 0 ? (
            <p className="text-[13px] text-[#86868b] py-6 text-center">
              Hareket yok
            </p>
          ) : (
            <ul className="space-y-2 border border-[#f0f0f0] rounded-xl overflow-hidden">
              {ledgerEntries.map((e) => (
                <li
                  key={e.id}
                  className="px-3 py-2.5 border-b border-[#f0f0f0] last:border-0 text-[12px]"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-[#1d1d1f] font-medium">
                      {e.description}
                    </span>
                    <span
                      className={
                        e.entryType === "debt"
                          ? "text-red-600 font-semibold"
                          : e.entryType === "credit"
                            ? "text-amber-800 font-semibold"
                            : "text-green-600 font-semibold"
                      }
                    >
                      {e.entryType === "debt"
                        ? "+"
                        : e.entryType === "credit"
                          ? "\u2212"
                          : "-"}
                      {"\u20BA"}
                      {formatCurrency(e.amount)}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#86868b] mt-1 flex flex-wrap gap-x-2">
                    <span>
                      {e.entryType === "debt"
                        ? "Borç"
                        : e.entryType === "credit"
                          ? "Adisyon geri al"
                          : "Tahsilat"}
                    </span>
                    <span>
                      {formatIstanbulDate(e.createdAt)}{" "}
                      {formatIstanbulTime(e.createdAt)}
                    </span>
                    {e.tableName && <span>Masa: {e.tableName}</span>}
                    {e.receivedBy && (
                      <span>
                        {e.entryType === "payment"
                          ? "Kasiyer:"
                          : "İşlem yapan:"}{" "}
                        {e.receivedBy}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {canCollectLedger && (
          <div className="px-6 py-4 border-t border-[#f0f0f0] flex-shrink-0 space-y-2.5">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
              Tahsilat
            </p>
            {!hasOpenShift && (
              <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                Tahsilat kaydetmek için açık bir kasa vardiyası gereklidir.
              </p>
            )}
            <div className="flex gap-1.5">
              {COLLECTION_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  disabled={ledgerPayBusy || !hasOpenShift}
                  onClick={() => setLedgerPayMethod(m.key)}
                  className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                    ledgerPayMethod === m.key
                      ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]"
                      : "border-[#d1d1d6]/60 text-[#86868b]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={0.01}
                step="0.01"
                disabled={ledgerPayBusy || !hasOpenShift}
                value={ledgerPayAmount}
                onChange={(e) => {
                  const v = e.target.value
                  if (v !== "" && Number(v) < 0) return
                  setLedgerPayAmount(v)
                }}
                placeholder="Tutar"
                className="flex-1 h-[40px] px-3 text-[14px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
              />
              <button
                type="button"
                disabled={
                  ledgerPayBusy ||
                  !hasOpenShift ||
                  !(
                    parseFloat(String(ledgerPayAmount).replace(",", ".")) > 0
                  ) ||
                  !hasToken
                }
                onClick={onCollect}
                className="h-[40px] px-4 rounded-lg bg-[#34c759] text-white text-[13px] font-semibold hover:bg-[#2db84e] disabled:opacity-50"
              >
                {ledgerPayBusy ? "…" : "Kaydet"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
