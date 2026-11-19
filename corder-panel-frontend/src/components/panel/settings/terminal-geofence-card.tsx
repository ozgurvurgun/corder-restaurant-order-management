import { useEffect, useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "../panel-toast"
import { LocateFixed, MapPin, ShieldCheck } from "lucide-react"

const RADIUS_PRESETS = [
  { meters: 50, label: "50 m (Bina İçi)" },
  { meters: 100, label: "100 m (Bahçe & Yakın Çevre)" },
  { meters: 150, label: "150 m (Önerilen)" },
  { meters: 250, label: "250 m (Geniş Alan)" },
  { meters: 500, label: "500 m" },
]

export function TerminalGeofenceCard() {
  const { settings, updateSettings } = usePanelStore()
  const { showToast } = usePanelToast()

  const [enabled, setEnabled] = useState(
    Boolean(settings.terminalLocationRestrictionEnabled)
  )
  const [latInput, setLatInput] = useState(
    settings.locationLatitude != null ? String(settings.locationLatitude) : ""
  )
  const [lngInput, setLngInput] = useState(
    settings.locationLongitude != null ? String(settings.locationLongitude) : ""
  )
  const [radius, setRadius] = useState(
    Number(settings.locationRadiusMeters || 150)
  )
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    setEnabled(Boolean(settings.terminalLocationRestrictionEnabled))
    setLatInput(
      settings.locationLatitude != null ? String(settings.locationLatitude) : ""
    )
    setLngInput(
      settings.locationLongitude != null ? String(settings.locationLongitude) : ""
    )
    setRadius(Number(settings.locationRadiusMeters || 150))
  }, [
    settings.terminalLocationRestrictionEnabled,
    settings.locationLatitude,
    settings.locationLongitude,
    settings.locationRadiusMeters,
  ])

  const handleToggle = (nextEnabled: boolean) => {
    setEnabled(nextEnabled)
    if (!nextEnabled) {
      updateSettings({ terminalLocationRestrictionEnabled: false })
    }
  }

  const handleUseCurrentGps = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      showToast("Tarayıcınız GPS konum özelliğini desteklemiyor.", "error")
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
        updateSettings({
          terminalLocationRestrictionEnabled: enabled,
          locationLatitude: lat,
          locationLongitude: lng,
          locationRadiusMeters: radius,
        })
        showToast("Mevcut GPS konumunuz restoran konumu olarak kaydedildi.", "success")
      },
      () => {
        setLocating(false)
        showToast("Konum alınamadı. Tarayıcı konum iznini kontrol edin.", "error")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSave = () => {
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
        "Konum kısıtlamasını aktif etmek için GPS ile konum alın veya geçerli enlem/boylam girin.",
        "error"
      )
      return
    }
    updateSettings({
      terminalLocationRestrictionEnabled: enabled,
      locationLatitude: parsedLat,
      locationLongitude: parsedLng,
      locationRadiusMeters: radius,
    })
  }

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13.5px] font-semibold text-[#1d1d1f]">
                El Terminali Konum &amp; Uzaklık Kısıtlaması (Geofence)
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
            <p className="text-[11px] text-[#86868b]">
              Açık olduğunda restorandan uzakta olan personeller terminale hiç erişemez ve uzaktan sipariş veremez.
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
              disabled={locating}
              onClick={handleUseCurrentGps}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-black/80 disabled:opacity-50"
            >
              <LocateFixed className="h-3.5 w-3.5 text-[#e63462]" />
              {locating
                ? "GPS Konumu Alınıyor..."
                : "Mevcut Konumumu Restoran Konumu Olarak Al (GPS)"}
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
                Restoran Enlem (Latitude)
              </label>
              <input
                type="number"
                step="any"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="Örn: 38.4622"
                className="w-full h-8 rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] px-2.5 text-[12px] text-[#1d1d1f]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-[#86868b] mb-1">
                Restoran Boylam (Longitude)
              </label>
              <input
                type="number"
                step="any"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                placeholder="Örn: 27.2164"
                className="w-full h-8 rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] px-2.5 text-[12px] text-[#1d1d1f]"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSave}
                className="w-full h-8 rounded-lg bg-[#e63462] hover:bg-[#d42d56] text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Konum Kuralını Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
