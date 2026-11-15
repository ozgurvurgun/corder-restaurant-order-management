import { useState, useCallback } from "react"
import { Check, Delete, Lock, LogOut, User } from "lucide-react"
import { useApp } from "@/lib/store"

interface UserSelectScreenProps {
  onSelect: () => void
}

const MIN_PIN_LENGTH = 4
const MAX_PIN_LENGTH = 8

export function UserSelectScreen({ onSelect }: UserSelectScreenProps) {
  const { verifyStaffPin, logout, restaurant } = useApp()
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [shake, setShake] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  const submitPin = useCallback(
    async (candidate: string) => {
      if (candidate.length < MIN_PIN_LENGTH || submitting) return
      setSubmitting(true)
      setError("")
      setPin("")
      try {
        const res = await verifyStaffPin(candidate)
        if (res.ok) {
          onSelect()
        } else {
          setError(res.error || "Gecersiz PIN")
          triggerShake()
        }
      } finally {
        setSubmitting(false)
      }
    },
    [submitting, verifyStaffPin, onSelect, triggerShake]
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

  const dotCount = Math.max(MIN_PIN_LENGTH, pin.length)

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#e63462] via-[#c62a6b] to-[#7b2d8e] safe-top safe-bottom">
      <div className="px-4 pt-4 flex items-center justify-between relative z-50">
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 text-white/70 active:text-white transition-colors py-2 px-2 touch-manipulation cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-[13px] font-medium">Restorandan Cikis</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-6">
        <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-xl flex items-center justify-center mb-4">
          <User className="h-9 w-9 text-white" />
        </div>
        <h2 className="text-[22px] font-bold text-white text-center">
          {restaurant?.name || "Personel Girisi"}
        </h2>
        <p className="text-white/60 text-[14px] mt-1 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          Personel PIN Kodunu Girin
        </p>

        {/* PIN dots */}
        <div
          className={`flex items-center gap-3 mt-8 mb-3 transition-transform ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
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
            aria-label="Giris"
            className="h-[62px] rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center text-white active:bg-white/30 active:scale-95 transition-all disabled:opacity-30"
          >
            <Check className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8 pt-6">
        <p className="text-white/40 text-[12px] font-medium">Powered By</p>
        <p className="text-white/70 font-bold text-[14px] tracking-wider mt-0.5">
          COMPART SOFTWARE
        </p>
      </div>
    </div>
  )
}
