/* global showToast */
const playedAudioEventIds = new Set()
let sharedAudioCtx = null

function getOrCreateAudioContext() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new Ctx()
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume().catch(() => {})
    }
    return sharedAudioCtx
  } catch {
    return null
  }
}

function playAttentionChime(isBill = false) {
  const ctx = getOrCreateAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const notes = isBill ? [783.99, 987.77, 1174.66] : [659.25, 880.0]
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.12
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.001, start)
      gain.gain.exponentialRampToValueAtTime(0.24, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.24)
    })
  } catch {
    // ignore chime error
  }
}

function playWaiterCallAudioEvent(audioEvent) {
  if (!audioEvent || !audioEvent.id) return
  if (playedAudioEventIds.has(audioEvent.id)) return
  playedAudioEventIds.add(audioEvent.id)
  if (playedAudioEventIds.size > 120) {
    const oldest = playedAudioEventIds.values().next().value
    if (oldest) playedAudioEventIds.delete(oldest)
  }

  const isBill = audioEvent.requestType === "bill"
  playAttentionChime(isBill)

  if (typeof showToast === "function" && audioEvent.text) {
    showToast(`Sesli Anons: ${audioEvent.text}`)
  }

  if (audioEvent.mp3Base64) {
    setTimeout(() => {
      try {
        const audio = new Audio(`data:audio/mp3;base64,${audioEvent.mp3Base64}`)
        audio.volume = 1.0
        void audio.play().catch((err) => {
          console.warn("MP3 TTS playback failed:", err)
        })
      } catch (err) {
        console.warn("MP3 Audio init failed:", err)
      }
    }, 280)
  }
}

if (window.corderDesktop && typeof window.corderDesktop.onPlayTts === "function") {
  window.corderDesktop.onPlayTts((audioEvent) => {
    playWaiterCallAudioEvent(audioEvent)
  })
}

