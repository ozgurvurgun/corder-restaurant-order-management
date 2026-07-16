import { useState, useCallback } from "react"
import { ChevronRight, User, ChevronLeft, Delete, Lock } from "lucide-react"
import { useApp } from "@/lib/store"

interface UserSelectScreenProps {
  onSelect: () => void
}

export function UserSelectScreen({ onSelect }: UserSelectScreenProps) {
  const { users, selectUser } = useApp()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [shake, setShake] = useState(false)

  const selectedUser = users.find((u) => u.id === selectedUserId)

  const handleUserTap = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (!user) return
    if (!user.password) {
      selectUser(userId)
      onSelect()
      return
    }
    setSelectedUserId(userId)
    setPin("")
    setError("")
  }

  const handleBack = () => {
    setSelectedUserId(null)
    setPin("")
    setError("")
  }

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  const handlePinInput = useCallback(
    (digit: string) => {
      if (!selectedUser) return
      const newPin = pin + digit
      setPin(newPin)
      setError("")

      // Auto-submit when PIN length matches the user's password length
      if (selectedUser.password && newPin.length === selectedUser.password.length) {
        if (newPin === selectedUser.password) {
          selectUser(selectedUser.id)
          onSelect()
        } else {
          setError("Yanlis parola")
          triggerShake()
          setTimeout(() => setPin(""), 300)
        }
      }
    },
    [pin, selectedUser, selectUser, onSelect, triggerShake]
  )

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
    setError("")
  }, [])

  // PIN pad screen
  if (selectedUserId && selectedUser) {
    return (
      <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#e63462] via-[#c62a6b] to-[#7b2d8e] safe-top safe-bottom">
        {/* Back button */}
        <div className="px-4 pt-4 relative z-50">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-white/70 active:text-white transition-colors py-2 pr-3 pl-1 touch-manipulation cursor-pointer relative z-50"
            style={{ pointerEvents: 'auto' }}
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-[15px] font-medium">Geri</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
          {/* User avatar */}
          <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-xl flex items-center justify-center mb-4">
            <User className="h-9 w-9 text-white" />
          </div>
          <h2 className="text-[22px] font-bold text-white capitalize">{selectedUser.name}</h2>
          <p className="text-white/50 text-[14px] mt-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Terminal Parolasi
          </p>

          {/* PIN dots */}
          <div
            className={`flex items-center gap-3.5 mt-8 mb-3 transition-transform ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
          >
            {Array.from({ length: selectedUser.password?.length || 4 }).map((_, i) => (
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
            <p className="text-white/90 text-[13px] bg-white/10 backdrop-blur-xl rounded-xl py-2 px-4 mb-4">
              {error}
            </p>
          )}

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3 mt-4 w-[260px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handlePinInput(String(num))}
                className="h-[62px] rounded-2xl bg-white/10 backdrop-blur-xl text-white text-[24px] font-medium active:bg-white/25 active:scale-95 transition-all"
              >
                {num}
              </button>
            ))}
            <div />
            <button
              onClick={() => handlePinInput("0")}
              className="h-[62px] rounded-2xl bg-white/10 backdrop-blur-xl text-white text-[24px] font-medium active:bg-white/25 active:scale-95 transition-all"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              className="h-[62px] rounded-2xl bg-white/5 flex items-center justify-center active:bg-white/15 active:scale-95 transition-all"
            >
              <Delete className="h-6 w-6 text-white/60" />
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

  // User list screen — users will be added from the panel and loaded from the API
  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#e63462] via-[#c62a6b] to-[#7b2d8e] safe-top safe-bottom">
      <div className="px-5 pt-16 pb-6">
        <h1 className="text-[34px] font-bold text-white leading-tight">
          Kullanici Secin
        </h1>
      </div>

      <div className="px-5 flex flex-col gap-3 flex-1">
        {users.length === 0 ? (
          <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-6 mt-2">
            <p className="text-white/90 text-[15px] leading-relaxed">
              Henuz garson eklenmemis. Panel uzerinden kullanici ekleyin; kullanici secilmeden sisteme girilemez ve siparis verilemez.
            </p>
          </div>
        ) : (
          users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleUserTap(user.id)}
              className="flex items-center gap-4 w-full bg-white/12 backdrop-blur-xl rounded-2xl p-4 active:bg-white/20 transition-all"
            >
              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-white font-semibold text-[17px] capitalize block">
                  {user.name}
                </span>
                {user.password && (
                  <span className="text-white/40 text-[12px] flex items-center gap-1 mt-0.5">
                    <Lock className="w-3 h-3" /> Parola korumali
                  </span>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-white/40" />
            </button>
          ))
        )}
      </div>

      <div className="text-center pb-8 pt-12">
        <p className="text-white/40 text-[12px] font-medium">Powered By</p>
        <p className="text-white/70 font-bold text-[14px] tracking-wider mt-0.5">
          COMPART SOFTWARE
        </p>
      </div>
    </div>
  )
}
