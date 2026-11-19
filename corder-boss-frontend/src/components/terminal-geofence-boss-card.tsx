import { useCallback, useEffect, useState } from "react"
import { getApiBase, getBossToken } from "@/lib/api"
import { useBossStore } from "@/lib/boss-store"
import { LocateFixed, MapPin, ShieldCheck } from "lucide-react"

const RADIUS_PRESETS = [
  { meters: 50, label: "50 m (Bina İçi)" },
  { meters: 100, label: "100 m (Bahçe & Çevre)" },
  { meters: 150, label: "150 m (Önerilen)" },
  { meters: 250, label: "250 m" },
  { meters: 500, label: "500 m" },
]

export function TerminalGeofenceBossCard() {
  const { effectiveBranchId, effectiveBranch, showToast } = useBossStore()
  const [enabled, setEnabled] = useState(false)
  const [latInput, setLatInput] = useState("")
  const [lngInput, setLngInput] = useState("")
  const [radius, setRadius] = useState(150)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  const loadSettings = useCallback(async (branchId: string) => {
    const token = getBossToken()
    if (!token || !branchId) return
    try {
      const res = await fetch(`${getApiBase()}/restaurant/settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-restaurant-id": branchId,
        },
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        terminalLocationRestrictionEnabled?: boolean
        locationLatitude?: number | null
        locationLongitude?: number | null
        locationRadiusMeters?: number
      }
      setEnabled(Boolean(data.terminalLocationRestrictionEnabled))
      setLatInput(
        data.locationLatitude != null ? String(data.locationLatitude) : ""
      )
      setLngInput(
        data.locationLongitude != null ? String(data.locationLongitude) : ""
      )
      setRadius(Number(data.locationRadiusMeters || 150))
    } catch {}
  }, [])

  useEffect(() => {
    if (effectiveBranchId) void loadSettings(effectiveBranchId)
  }, [effectiveBranchId, loadSettings])

  const saveGeofence = async (body: {
    terminalLocationRestrictionEnabled: boolean
    locationLatitude?: number | null
    locationLongitude?: number | null
    locationRadiusMeters?: number
  }) => {
    const token = getBossToken()
    if (!token || !effectiveBranchId) return
    setSaving(true)
    try {
      const res = await fetch(`${getApiBase()}/restaurant/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-restaurant-id": effectiveBranchId,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Konum kuralı güncellenemedi")
      showToast("Terminal konum kısıtlaması kaydedildi")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Kaydedilemedi", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (nextEnabled: boolean) => {
    setEnabled(nextEnabled)
    if (!nextEnabled) {
      void saveGeofence({ terminalLocationRestrictionEnabled: false })
    }
  }

  const handleUseCurrentGps = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      showToast("Cihazınız GPS konum özelliğini desteklemiyor", "error")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        setLatInput(String(lat))
        setLngInput(String(lng))
        setLocating(false)
        void saveGeofence({
          terminalLocationRestrictionEnabled: enabled,
          locationLatitude: lat,
          locationLongitude: lng,
          locationRadiusMeters: radius,
        })
      },
      () => {
        setLocating(false)
        showToast("GPS konumu alınamadı, tarayıcı konum iznini açın", "error")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleManualSave = () => {
    const parsedLat = latInput.trim() !== "" ? Number(latInput) : null
    const parsedLng = lngInput.trim() !== "" ? Number(lngInput) : null
    if (
      enabled &&
      (parsedLat == null ||
        parsedLng == null ||
        !Number.isFinite(parsedLat) ||
        !Number.isFinite(parsedLng))
    ) {
      showToast(
        "Konum kısıtlaması için GPS ile konum alın veya geçerli enlem/boylam girin",
        "error"
      )
      return
    }
    void saveGeofence({
      terminalLocationRestrictionEnabled: enabled,
      locationLatitude: parsedLat,
      locationLongitude: parsedLng,
      locationRadiusMeters: radius,
    })
  }

  return (
    <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                El Terminali Konum &amp; Uzaklık Kısıtlaması ({effectiveBranch?.name})
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  enabled
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[#f5f5f7] text-[#86868b]"
                }`}
              >
                {enabled ? "Aktif" : "Kapalı"}
              </span>
            </div>
            <p className="text-[11.5px] text-[#86868b]">
              Açık olduğunda mekan konumundan uzakta olan garsonlar terminale erişemez ve uzaktan sipariş giremez.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleToggle(!enabled)}
          className={`h-6 w-11 flex-shrink-0 rounded-full p-0.5 transition-colors ${
            enabled ? "bg-[#e63462]" : "bg-[#d1d1d6]"
          }`}
        >
          <div
            className={`h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3 pt-2 border-t border-[#f0f0f0]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={locating || saving}
              onClick={handleUseCurrentGps}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-black/80 disabled:opacity-50"
            >
              <LocateFixed className="h-3.5 w-3.5 text-[#e63462]" />
              {locating
                ? "GPS Konumu Alınıyor..."
                : "Mevcut Konumumu Mekan Konumu Olarak Kaydet (GPS)"}
            </button>

            <div className="flex flex-wrap items-center gap-1">
              {RADIUS_PRESETS.map((p) => (
                <button
                  key={p.meters}
                  type="button"
                  onClick={() => setRadius(p.meters)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    radius === p.meters
                      ? "border-[#e63462] bg-[#e63462]/10 text-[#e63462]"
                      : "border-[#e5e5ea] bg-[#f5f5f7] text-[#636366]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10.5px] font-semibold text-[#86868b] mb-1">
                Mekan Enlem (Latitude)
              </label>
              <input
                type="number"
                step="any"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="Örn: 38.4622"
                className="w-full h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[12px] text-[#1d1d1f]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-[#86868b] mb-1">
                Mekan Boylam (Longitude)
              </label>
              <input
                type="number"
                step="any"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                placeholder="Örn: 27.2164"
                className="w-full h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[12px] text-[#1d1d1f]"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                disabled={saving}
                onClick={handleManualSave}
                className="w-full h-9 rounded-xl bg-[#e63462] hover:bg-[#d42d56] text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {saving ? "Kaydediliyor..." : "Konum Kuralını Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
