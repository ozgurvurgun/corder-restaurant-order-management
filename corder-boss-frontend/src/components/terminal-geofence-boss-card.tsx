import { useCallback, useEffect, useMemo, useState } from "react"
import { getApiBase, getBossToken } from "@/lib/api"
import { useBossStore } from "@/lib/boss-store"
import {
  ChevronDown,
  ExternalLink,
  LocateFixed,
  MapPin,
  ShieldCheck,
} from "lucide-react"

const RADIUS_PRESETS = [
  { meters: 50, label: "50 m (Bina İçi)" },
  { meters: 100, label: "100 m (Bahçe & Çevre)" },
  { meters: 150, label: "150 m (Önerilen)" },
  { meters: 250, label: "250 m" },
  { meters: 500, label: "500 m" },
]

function buildOsmEmbedUrl(lat: number, lng: number, radiusMeters: number): string {
  const delta = Math.max(0.0018, (radiusMeters / 111_320) * 2.4)
  const minLng = (lng - delta).toFixed(6)
  const minLat = (lat - delta).toFixed(6)
  const maxLng = (lng + delta).toFixed(6)
  const maxLat = (lat + delta).toFixed(6)
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`
}

export function TerminalGeofenceBossCard() {
  const { effectiveBranchId, effectiveBranch, showToast } = useBossStore()
  const [enabled, setEnabled] = useState(false)
  const [expanded, setExpanded] = useState(false)
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

  const parsedCoords = useMemo(() => {
    const lat = latInput.trim() !== "" ? Number(latInput) : NaN
    const lng = lngInput.trim() !== "" ? Number(lngInput) : NaN
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null
    }
    return { lat, lng }
  }, [latInput, lngInput])

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
      setExpanded(false)
      void saveGeofence({ terminalLocationRestrictionEnabled: false })
    } else if (!parsedCoords) {
      setExpanded(true)
    } else {
      void saveGeofence({
        terminalLocationRestrictionEnabled: true,
        locationLatitude: parsedCoords.lat,
        locationLongitude: parsedCoords.lng,
        locationRadiusMeters: radius,
      })
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
        showToast("GPS konumu alınamadı, cihaz konum iznini açın", "error")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleManualSave = () => {
    if (enabled && !parsedCoords) {
      showToast(
        "Konum kısıtlaması için GPS ile konum alın veya geçerli enlem/boylam girin",
        "error"
      )
      return
    }
    void saveGeofence({
      terminalLocationRestrictionEnabled: enabled,
      locationLatitude: parsedCoords?.lat ?? null,
      locationLongitude: parsedCoords?.lng ?? null,
      locationRadiusMeters: radius,
    })
    setExpanded(false)
  }

  return (
    <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div
          onClick={() => enabled && setExpanded((v) => !v)}
          className={`flex items-center gap-2.5 min-w-0 flex-1 ${
            enabled ? "cursor-pointer select-none" : ""
          }`}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
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
              {enabled && parsedCoords && (
                <span className="rounded-md bg-[#f5f5f7] border border-[#e5e5ea] px-2 py-0.5 text-[10.5px] font-medium text-[#1d1d1f]">
                  {radius} m Yarıçap • {parsedCoords.lat.toFixed(4)}, {parsedCoords.lng.toFixed(4)}
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[#86868b] truncate">
              Açık olduğunda mekan konumundan uzakta olan garsonlar terminale erişemez ve uzaktan sipariş giremez.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {enabled && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-2.5 text-[11.5px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors"
              title={expanded ? "Konum Ayarlarını Gizle" : "Konum & Harita Ayarlarını Aç"}
            >
              <span>{expanded ? "Gizle" : "Konum & Harita"}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-[#e63462] transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
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
      </div>

      {enabled && expanded && (
        <div className="mt-3 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={locating || saving}
                onClick={handleUseCurrentGps}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-3 py-2 text-[11.5px] font-semibold text-white hover:bg-black/80 disabled:opacity-50"
              >
                <LocateFixed className="h-3.5 w-3.5 text-[#e63462]" />
                {locating
                  ? "GPS Konumu Alınıyor..."
                  : "Mevcut Konumumu Mekan Konumu Olarak Kaydet (GPS)"}
              </button>
            </div>

            <div>
              <label className="block text-[10.5px] font-semibold text-[#86868b] mb-1.5">
                İzin Verilen Maksimum Mesafe (Yarıçap)
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {RADIUS_PRESETS.map((p) => (
                  <button
                    key={p.meters}
                    type="button"
                    onClick={() => setRadius(p.meters)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      radius === p.meters
                        ? "border-[#e63462] bg-[#e63462]/10 text-[#e63462]"
                        : "border-[#e5e5ea] bg-[#f5f5f7] text-[#636366] hover:bg-[#e8e8ed]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10.5px] font-semibold text-[#86868b] mb-1">
                  Mekan Enlem (Latitude)
                </label>
                <input
                  type="number"
                  step="any"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder="Örn: 38.373287"
                  className="w-full h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[12px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white"
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
                  placeholder="Örn: 27.167468"
                  className="w-full h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[12px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="h-9 rounded-xl border border-[#d1d1d6] bg-white px-3.5 text-[12px] font-medium text-[#636366] hover:bg-[#f5f5f7]"
              >
                Kapat
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleManualSave}
                className="h-9 rounded-xl bg-[#e63462] hover:bg-[#d42d56] px-4 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {saving ? "Kaydediliyor..." : "Konum Kuralını Kaydet"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-full min-h-[178px] rounded-2xl border border-[#e5e5ea] bg-[#f9f9fb] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-[#f0f0f0]">
                <span className="text-[11px] font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-[#e63462]" />
                  Seçili Konum Harita Önizlemesi ({radius} m)
                </span>
                {parsedCoords && (
                  <a
                    href={`https://www.google.com/maps?q=${parsedCoords.lat},${parsedCoords.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#e63462] hover:underline"
                  >
                    Haritada Aç
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
              {parsedCoords ? (
                <div className="relative flex-1 min-h-[150px]">
                  <iframe
                    title="Mekan Konum Haritası"
                    src={buildOsmEmbedUrl(parsedCoords.lat, parsedCoords.lng, radius)}
                    className="w-full h-full min-h-[150px] border-0"
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-20 w-20 rounded-full border-2 border-[#e63462] bg-[#e63462]/15 shadow-inner" />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <MapPin className="h-6 w-6 text-[#d1d1d6] mb-1" />
                  <p className="text-[11.5px] font-medium text-[#86868b]">
                    Harita önizlemesi için GPS butonuna tıklayın veya koordinat girin.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
