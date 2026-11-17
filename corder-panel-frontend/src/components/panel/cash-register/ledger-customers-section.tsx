import { useState, useEffect, useRef } from "react"
import { BookUser, Loader2, Plus, X } from "lucide-react"
import { api } from "@/lib/api"
import type { LedgerCustomer, LedgerEntry } from "@/lib/panel-types"
import { formatCurrency, formatIstanbulDate, formatIstanbulTime } from "@/lib/format"

type CollectionMethod = "cash" | "credit-card" | "meal-card" | "multinet"

const COLLECTION_METHODS: { key: CollectionMethod; label: string }[] = [
  { key: "cash", label: "Nakit" },
  { key: "credit-card", label: "Kredi Kartı" },
  { key: "meal-card", label: "Yemek Kartı" },
  { key: "multinet", label: "Multinet" },
]

export function LedgerCustomersSection(props: {
  token: string | null
  ledgerBounds?: { from: string; to: string }
  ledgerTabLoading: boolean
  ledgerTabCustomers: LedgerCustomer[] | null
  ledgerCustomers: LedgerCustomer[]
  displayLedgerCustomers: LedgerCustomer[]
  canManageLedger?: boolean
  canCollectLedger?: boolean
  hasOpenShift?: boolean
  ledgerRefresh: () => Promise<void>
  refetchLedgerTabCustomers: () => Promise<void>
  createLedgerCustomer: (body: {
    name: string
    phone?: string
    notes?: string
  }) => Promise<LedgerCustomer | null>
  addLedgerPayment: (
    customerId: string,
    amount: number,
    paymentMethod?: CollectionMethod,
  ) => Promise<boolean>
}) {
  const { token, ledgerBounds, ledgerTabLoading, ledgerTabCustomers, ledgerCustomers, displayLedgerCustomers, canManageLedger = true, canCollectLedger = true, hasOpenShift = true, ledgerRefresh, refetchLedgerTabCustomers, createLedgerCustomer, addLedgerPayment } = props

  const [showAddLedger, setShowAddLedger] = useState(false)
  const [ledgerDetailId, setLedgerDetailId] = useState<string | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [ledgerEntriesLoading, setLedgerEntriesLoading] = useState(false)
  const [ledgerPayAmount, setLedgerPayAmount] = useState("")
  const [ledgerPayMethod, setLedgerPayMethod] =
    useState<CollectionMethod>("cash")
  const [ledgerPayBusy, setLedgerPayBusy] = useState(false)
  const [lcName, setLcName] = useState("")
  const [lcPhone, setLcPhone] = useState("")
  const [lcNotes, setLcNotes] = useState("")
  const [lcSaving, setLcSaving] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    if (!showAddLedger) return
    setLcName("")
    setLcPhone("")
    setLcNotes("")
  }, [showAddLedger])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || lcSaving || ledgerPayBusy || busyRef.current)
        return
      if (showAddLedger) setShowAddLedger(false)
      else if (ledgerDetailId) setLedgerDetailId(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showAddLedger, ledgerDetailId, lcSaving, ledgerPayBusy])

  useEffect(() => {
    if (!ledgerDetailId || !token) {
      setLedgerEntries([])
      return
    }
    setLedgerEntriesLoading(true)
    const req = ledgerBounds
      ? api.ledgerCustomers.entries(token, ledgerDetailId, ledgerBounds)
      : api.ledgerCustomers.entries(token, ledgerDetailId)
    void req
      .then((rows) =>
        setLedgerEntries(
          rows.map((e) => ({
            id: e.id,
            entryType: e.entryType,
            amount: Number(e.amount),
            description: e.description,
            tableId: e.tableId ?? undefined,
            tableName: e.tableName ?? undefined,
            completedOrderId: e.completedOrderId ?? undefined,
            receivedBy: e.receivedBy ?? undefined,
            receivedByUserId: e.receivedByUserId ?? undefined,
            createdAt: new Date(e.createdAt),
          })),
        ),
      )
      .catch(() => setLedgerEntries([]))
      .finally(() => setLedgerEntriesLoading(false))
  }, [ledgerDetailId, token, ledgerBounds])

  const handleSaveLedgerCustomer = async () => {
    if (!lcName.trim() || lcSaving || busyRef.current) return
    busyRef.current = true
    setLcSaving(true)
    try {
      const c = await createLedgerCustomer({
        name: lcName.trim(),
        phone: lcPhone.trim() || undefined,
        notes: lcNotes.trim() || undefined,
      })
      if (c) {
        setShowAddLedger(false)
        if (ledgerBounds) void refetchLedgerTabCustomers()
      }
    } finally {
      busyRef.current = false
      setLcSaving(false)
    }
  }

  const handleLedgerCollection = async () => {
    const amountVal = parseFloat(String(ledgerPayAmount).replace(",", "."))
    if (
      !ledgerDetailId ||
      !Number.isFinite(amountVal) ||
      amountVal <= 0 ||
      ledgerPayBusy ||
      busyRef.current
    )
      return
    busyRef.current = true
    setLedgerPayBusy(true)
    try {
      const ok = await addLedgerPayment(
        ledgerDetailId,
        amountVal,
        ledgerPayMethod,
      )
      if (ok) {
        setLedgerPayAmount("")
        void ledgerRefresh()
        if (token) {
          setLedgerEntriesLoading(true)
          try {
            const rows = ledgerBounds
              ? await api.ledgerCustomers.entries(
                  token,
                  ledgerDetailId,
                  ledgerBounds,
                )
              : await api.ledgerCustomers.entries(token, ledgerDetailId)
            setLedgerEntries(
              rows.map((e) => ({
                id: e.id,
                entryType: e.entryType,
                amount: Number(e.amount),
                description: e.description,
                tableId: e.tableId ?? undefined,
                tableName: e.tableName ?? undefined,
                completedOrderId: e.completedOrderId ?? undefined,
                receivedBy: e.receivedBy ?? undefined,
                receivedByUserId: e.receivedByUserId ?? undefined,
                createdAt: new Date(e.createdAt),
              })),
            )
          } finally {
            setLedgerEntriesLoading(false)
          }
        }
        if (ledgerBounds) void refetchLedgerTabCustomers()
      }
    } finally {
      busyRef.current = false
      setLedgerPayBusy(false)
    }
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() =>
            void (async () => {
              await ledgerRefresh()
              if (ledgerBounds && token) await refetchLedgerTabCustomers()
            })()
          }
          className="h-[30px] px-3 flex items-center gap-1.5 border border-[#d1d1d6]/60 rounded-lg text-[12px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
        >
          Yenile
        </button>
        {canManageLedger && (
          <button type="button" onClick={() => setShowAddLedger(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Cari Ekle
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {ledgerBounds && ledgerTabLoading && ledgerTabCustomers === null ? (
          <div className="flex items-center justify-center py-16 text-[#86868b] gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[14px]">Yükleniyor…</span>
          </div>
        ) : (
          displayLedgerCustomers
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, "tr"))
            .map((c) => {
              const showPeriod = Boolean(
                ledgerBounds && c.periodNet !== undefined,
              )
              const net = showPeriod ? (c.periodNet ?? 0) : c.balance
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setLedgerDetailId(c.id)
                    setLedgerPayAmount("")
                    setLedgerPayMethod("cash")
                  }}
                  className="text-left bg-white rounded-xl border border-[#d1d1d6]/60 p-4 hover:border-[#e63462]/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookUser className="w-4 h-4 text-[#e63462] flex-shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-[14px] font-semibold text-[#1d1d1f] truncate">
                          {c.name}
                        </h4>
                        {c.phone && (
                          <p className="text-[11px] text-[#86868b]">{c.phone}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {showPeriod ? (
                        <>
                          <p
                            className={`text-[13px] font-bold ${net > 0.009 ? "text-red-600" : net < -0.009 ? "text-green-600" : "text-[#86868b]"}`}
                          >
                            Dönem neti
                          </p>
                          <p
                            className={`text-[14px] font-semibold ${net > 0.009 ? "text-red-600" : net < -0.009 ? "text-green-600" : "text-[#1d1d1f]"}`}
                          >
                            {net > 0.009 ? "+" : net < -0.009 ? "\u2212" : ""}
                            {"\u20BA"}
                            {formatCurrency(Math.abs(net))}
                          </p>
                          <p className="text-[10px] text-[#86868b] mt-0.5">
                            Güncel: {"\u20BA"}
                            {formatCurrency(Math.abs(c.balance))}
                          </p>
                        </>
                      ) : (
                        <>
                          <p
                            className={`text-[13px] font-bold ${c.balance > 0.009 ? "text-red-600" : c.balance < -0.009 ? "text-green-600" : "text-[#86868b]"}`}
                          >
                            {c.balance > 0.009
                              ? "Borç"
                              : c.balance < -0.009
                                ? "Alacak"
                                : "Bakiye"}
                          </p>
                          <p className="text-[14px] font-semibold text-[#1d1d1f]">
                            {"\u20BA"}
                            {formatCurrency(Math.abs(c.balance))}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
        )}
        {!ledgerBounds && ledgerCustomers.length === 0 && (
          <div className="text-center py-16 text-[#86868b] text-[14px]">Kayıtlı Cari yok. Yukarıdan Cari ekleyin.</div>
        )}
        {ledgerBounds &&
          !ledgerTabLoading &&
          displayLedgerCustomers.length === 0 && (
            <div className="text-center py-16 text-[#86868b] text-[14px]">Bu tarih aralığında Cari hareketi yok.</div>
          )}
      </div>

      {showAddLedger && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Cari Müşteri Ekle</h3>
              <button type="button" disabled={lcSaving} onClick={() => setShowAddLedger(false)} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50">
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
              <button type="button" disabled={lcSaving} onClick={() => setShowAddLedger(false)} className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b] disabled:opacity-50">
                Vazgeç
              </button>
              <button
                type="button"
                disabled={lcSaving || !lcName.trim()}
                onClick={() => void handleSaveLedgerCustomer()}
                className="flex-1 h-[38px] rounded-xl bg-[#e63462] text-white text-[13px] font-semibold hover:bg-[#d42d56] disabled:opacity-50"
              >
                {lcSaving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ledgerDetailId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0] flex-shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  {displayLedgerCustomers.find((c) => c.id === ledgerDetailId)
                    ?.name ||
                    ledgerCustomers.find((c) => c.id === ledgerDetailId)
                      ?.name ||
                    "Cari"}
                </h3>
                <p className="text-[12px] text-[#86868b] mt-0.5">
                  Güncel bakiye:{" "}
                  <span className="font-semibold text-[#1d1d1f]">
                    {"\u20BA"}
                    {formatCurrency(
                      ledgerCustomers.find((c) => c.id === ledgerDetailId)
                        ?.balance ?? 0,
                    )}
                  </span>
                </p>
                {ledgerBounds && (
                  <p className="text-[11px] text-[#aeaeb2] mt-1">Hareketler Kasa tarih filtresine göre listelenir.</p>
                )}
              </div>
              <button type="button" disabled={ledgerPayBusy} onClick={() => setLedgerDetailId(null)} className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50">
                <X className="w-3.5 h-3.5 text-[#86868b]" />
              </button>
            </div>
            <div className="px-6 py-4 flex-1 overflow-y-auto">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">Hareketler</p>
              {ledgerEntriesLoading ? (
                <div className="flex items-center justify-center py-12 text-[#86868b] gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-[13px]">Yükleniyor…</span>
                </div>
              ) : ledgerEntries.length === 0 ? (
                <p className="text-[13px] text-[#86868b] py-6 text-center">Hareket yok</p>
              ) : (
                <ul className="space-y-2 border border-[#f0f0f0] rounded-xl overflow-hidden">
                  {ledgerEntries.map((e) => (
                    <li key={e.id} className="px-3 py-2.5 border-b border-[#f0f0f0] last:border-0 text-[12px]">
                      <div className="flex justify-between gap-2">
                        <span className="text-[#1d1d1f] font-medium">
                          {e.description}
                        </span>
                        <span className={ e.entryType === "debt" ? "text-red-600 font-semibold" : e.entryType === "credit" ? "text-amber-800 font-semibold" : "text-green-600 font-semibold" }>
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
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tahsilat</p>
                {!hasOpenShift && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">Tahsilat kaydetmek için açık bir kasa vardiyası gereklidir.</p>
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
                        parseFloat(String(ledgerPayAmount).replace(",", ".")) >
                        0
                      ) ||
                      !token
                    }
                    onClick={() => void handleLedgerCollection()}
                    className="h-[40px] px-4 rounded-lg bg-[#34c759] text-white text-[13px] font-semibold hover:bg-[#2db84e] disabled:opacity-50"
                  >
                    {ledgerPayBusy ? "…" : "Kaydet"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
