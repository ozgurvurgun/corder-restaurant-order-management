import { useState, useCallback, useEffect } from "react"
import { AlertCircle, Check, ChevronLeft, ChevronRight, Clock, Delete, Lock, LogOut, MapPin, RefreshCw, User } from "lucide-react"
import { useApp } from "@/lib/store"
import { acquireTerminalCoords } from "@/lib/api"
import type { TerminalStaffMember } from "@/lib/types"
import { useToast } from "@/components/ios-toast"

interface UserSelectScreenProps {
  onSelect: () => void
}

const MIN_PIN_LENGTH = 4
const MAX_PIN_LENGTH = 8

export function UserSelectScreen({ onSelect }: UserSelectScreenProps) {
  const { users, usersError, isLoading, refreshData, loginWithPin, logoutRestaurant, restaurant } = useApp()
  const { showToast } = useToast()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [shake, setShake] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [kickNotice, setKickNotice] = useState<string | null>(null)

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null
  const locationRestrictionActive = Boolean(users[0]?.terminalLocationRestrictionEnabled)

  useEffect(() => {
    try {
      const notice = sessionStorage.getItem("terminal_staff_kick_notice")
      if (notice) {
        setKickNotice(notice)
        showToast(notice, "error")
        sessionStorage.removeItem("terminal_staff_kick_notice")
      }
    } catch {}
  }, [showToast])

  useEffect(() => {
    if (locationRestrictionActive) {
      void acquireTerminalCoords(false)
    }
  }, [locationRestrictionActive])

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  const handleUserTap = (user: TerminalStaffMember) => {
    if (!user.hasPin) {
      showToast("Bu personel için PIN tanımlanmamış. Panelden PIN atayın.", "error")
      return
    }
    if (user.shiftRestrictionEnabled && user.isWithinShift === false) {
      showToast(
        user.shiftBlockReason ||
          `Mesai saatleriniz dışında terminale giriş yapamazsınız (${user.effectiveStartTime} - ${user.effectiveEndTime}).`,
        "error"
      )
      return
    }
    setSelectedUserId(user.id)
    setPin("")
    setError("")
  }

  const handleBack = useCallback(() => {
    if (submitting) return
    setSelectedUserId(null)
    setPin("")
    setError("")
  }, [submitting])

  const submitPin = useCallback(
    async (candidate: string) => {
      if (!selectedUser || candidate.length < MIN_PIN_LENGTH || submitting) return
      setSubmitting(true)
      setError("")
      setPin("")
      try {
        const res = await loginWithPin(candidate, selectedUser.id)
        if (res.ok) {
          onSelect()
        } else {
          setError(res.error || "Geçersiz PIN kodu")
          triggerShake()
        }
      } finally {
        setSubmitting(false)
      }
    },
    [selectedUser, submitting, loginWithPin, onSelect, triggerShake]
  )

  const handlePinInput = useCallback(
    (digit: string) => {
      if (submitting || pin.length >= MAX_PIN_LENGTH) return
      setPin((prev) => (prev.length < MAX_PIN_LENGTH ? prev + digit : prev))
      setError("")
    },
    [pin.length, submitting]
  )

  const handleDelete = useCallback(() => {
    if (submitting) return
    setPin((prev) => prev.slice(0, -1))
    setError("")
  }, [submitting])

  useEffect(() => {
    if (!selectedUser) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault()
        handlePinInput(e.key)
      } else if (e.key === "Backspace") {
        e.preventDefault()
        handleDelete()
      } else if (e.key === "Enter" && pin.length >= MIN_PIN_LENGTH) {
        e.preventDefault()
        void submitPin(pin)
      } else if (e.key === "Escape") {
        e.preventDefault()
        handleBack()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedUser, pin, handlePinInput, handleDelete, submitPin, handleBack])

  const dotCount = Math.max(MIN_PIN_LENGTH, pin.length)

  if (selectedUser) {
    return (
      <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#e63462] via-[#c62a6b] to-[#7b2d8e] safe-top safe-bottom">
        {/* Top bar */}
        <div className="px-4 pt-4 flex items-center justify-between relative z-50">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-white/80 active:text-white transition-colors py-2 pr-3 pl-1 touch-manipulation cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-[15px] font-medium">Geri</span>
          </button>

          <button
            type="button"
            onClick={logoutRestaurant}
            className="flex items-center gap-1.5 text-white/70 active:text-white transition-colors py-2 px-2 touch-manipulation cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-[13px] font-medium">Restorandan Çıkış</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-6">
          <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-xl flex items-center justify-center mb-4">
            <User className="h-9 w-9 text-white" />
          </div>
          <h2 className="text-[22px] font-bold text-white text-center">
            {selectedUser.name}
          </h2>
          {selectedUser.roleLabel && (
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-white/15 text-white/90 text-[12px] font-medium">
              {selectedUser.roleLabel}
            </span>
          )}
          <p className="text-white/60 text-[14px] mt-2 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Personel PIN Kodunu Girin
          </p>

          {/* PIN dots */}
          <div
            className={`flex items-center gap-3 mt-7 mb-3 transition-transform ${
              shake ? "animate-[shake_0.5s_ease-in-out]" : ""
            }`}
          >
            {Array.from({ length: dotCount }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  i < pin.length ? "bg-white scale-110" : "bg-white/20 border border-white/30"
                }`}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-white/90 text-[13px] bg-white/10 backdrop-blur-xl rounded-xl py-2 px-4 mb-4 text-center">
              {error}
            </p>
          )}

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3 mt-4 w-[260px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                disabled={submitting}
                onClick={() => handlePinInput(String(num))}
                className="h-[62px] rounded-2xl bg-white/10 backdrop-blur-xl text-white text-[24px] font-medium active:bg-white/25 active:scale-95 transition-all disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              disabled={submitting || pin.length === 0}
              onClick={handleDelete}
              aria-label="Sil"
              className="h-[62px] rounded-2xl bg-white/5 flex items-center justify-center active:bg-white/15 active:scale-95 transition-all disabled:opacity-30"
            >
              <Delete className="h-6 w-6 text-white/70" />
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handlePinInput("0")}
              className="h-[62px] rounded-2xl bg-white/10 backdrop-blur-xl text-white text-[24px] font-medium active:bg-white/25 active:scale-95 transition-all disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              disabled={submitting || pin.length < MIN_PIN_LENGTH}
              onClick={() => void submitPin(pin)}
              aria-label="Giriş"
              className="h-[62px] rounded-2xl bg-white/25 backdrop-blur-xl flex items-center justify-center text-white active:bg-white/35 active:scale-95 transition-all disabled:opacity-30"
            >
              <Check className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-2 pt-3">
          <p className="text-white/40 text-[12px] font-medium">Powered By</p>
          <p className="text-white/70 font-bold text-[14px] tracking-wider mt-0.5">
            COMPART SOFTWARE
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#e63462] via-[#c62a6b] to-[#7b2d8e] safe-top safe-bottom">
      <div className="px-4 pt-4 flex items-center justify-between relative z-50">
        <button
          type="button"
          onClick={logoutRestaurant}
          className="flex items-center gap-1.5 text-white/70 active:text-white transition-colors py-2 px-2 touch-manipulation cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-[13px] font-medium">Restorandan Çıkış</span>
        </button>

        <button
          type="button"
          onClick={() => void refreshData()}
          aria-label="Yenile"
          className="flex items-center gap-1.5 text-white/70 active:text-white transition-colors py-2 px-2 touch-manipulation cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          <span className="text-[13px] font-medium">Yenile</span>
        </button>
      </div>

      <div className="px-5 pt-6 pb-5">
        {restaurant?.name && (
          <p className="text-white/70 text-[13px] font-semibold uppercase tracking-wider mb-1">
            {restaurant.name}
          </p>
        )}
        <h1 className="text-[32px] font-bold text-white leading-tight">
          Kullanıcı Seçin
        </h1>
        {locationRestrictionActive && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-xl px-3 py-1 text-[12px] font-medium text-white/90">
            <MapPin className="h-3.5 w-3.5 text-amber-300" />
            <span>
              Konum Koruması Aktif ({users[0]?.locationRadiusMeters || 150} m yarıçap)
            </span>
          </div>
        )}
        {kickNotice && (
          <div className="mt-3 rounded-2xl bg-red-950/75 border border-red-400/60 p-3.5 text-white text-[13px] leading-snug flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-300 flex-shrink-0 mt-0.5" />
            <span>{kickNotice}</span>
          </div>
        )}
      </div>

      <div className="px-5 flex flex-col gap-3 flex-1 overflow-y-auto pb-4">
        {usersError && users.length === 0 ? (
          <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-6 mt-2 flex flex-col items-start gap-3">
            <div className="flex items-center gap-2 text-white">
              <AlertCircle className="h-5 w-5 text-amber-300 flex-shrink-0" />
              <span className="font-semibold text-[15px]">Bağlantı Sorunu</span>
            </div>
            <p className="text-white/85 text-[14px] leading-relaxed">{usersError}</p>
            <button
              type="button"
              onClick={() => void refreshData()}
              className="mt-1 px-4 py-2 rounded-xl bg-white text-[#e63462] text-[14px] font-semibold active:opacity-80"
            >
              Tekrar Dene
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-6 mt-2">
            <p className="text-white/90 text-[15px] leading-relaxed">
              {isLoading
                ? "Personel listesi yükleniyor..."
                : "Henüz terminal yetkili personel eklenmemiş. Panel üzerinden personel ekleyin; kullanıcı seçilmeden sisteme girilemez ve sipariş verilemez."}
            </p>
          </div>
        ) : (
          users.map((user) => {
            const isOutOfShift =
              Boolean(user.shiftRestrictionEnabled) && user.isWithinShift === false
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => handleUserTap(user)}
                className={`flex items-center gap-4 w-full bg-white/12 backdrop-blur-xl rounded-2xl p-4 active:bg-white/20 transition-all cursor-pointer ${
                  !user.hasPin || isOutOfShift ? "opacity-65" : ""
                }`}
              >
                <div
                  className="h-11 w-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={user.roleColor ? { background: user.roleColor } : undefined}
                >
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white font-semibold text-[17px]">
                      {user.name}
                    </span>
                    {user.shiftRestrictionEnabled &&
                      user.effectiveStartTime &&
                      user.effectiveEndTime && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isOutOfShift
                              ? "bg-red-950/80 text-red-200 border border-red-400/50"
                              : "bg-emerald-950/60 text-emerald-200 border border-emerald-400/40"
                          }`}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {isOutOfShift
                            ? `Mesai Dışı (${user.effectiveStartTime} - ${user.effectiveEndTime})`
                            : `Mesai: ${user.effectiveStartTime} - ${user.effectiveEndTime}`}
                        </span>
                      )}
                  </div>
                  <span className="text-white/60 text-[12px] flex items-center gap-1.5 mt-0.5">
                    <Lock className="w-3 h-3" />
                    {!user.hasPin
                      ? `${user.roleLabel ? `${user.roleLabel} • ` : ""}PIN tanımlanmamış`
                      : user.roleLabel
                        ? `${user.roleLabel} • PIN korumalı`
                        : "PIN korumalı"}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-white/40" />
              </button>
            )
          })
        )}
      </div>

      <div className="text-center pb-2 pt-3">
        <p className="text-white/40 text-[12px] font-medium">Powered By</p>
        <p className="text-white/70 font-bold text-[14px] tracking-wider mt-0.5">
          COMPART SOFTWARE
        </p>
      </div>
    </div>
  )
}
