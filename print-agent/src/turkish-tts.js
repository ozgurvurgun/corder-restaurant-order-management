const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { spawn } = require("child_process")
const { getAppDataDir } = require("./config")
const { info, warn } = require("./logger")

const TURKISH_ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
const TURKISH_TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]

const MAX_CACHE_FILES = 250
const ANNOUNCEMENT_GAP_MS = 4200
const DEDUPE_TTL_MS = 15000

let electronTtsSender = null
const recentUiAudioEvents = []
const announcedCallTimestamps = new Map()
const announcementQueue = []
let isProcessingQueue = false

function numberToTurkishWords(num) {
  const n = Math.floor(Math.abs(Number(num)))
  if (!Number.isFinite(n)) return String(num)
  if (n === 0) return "sıfır"
  if (n >= 1000000) return String(n)

  const convertBelowThousand = (val) => {
    const parts = []
    const hundreds = Math.floor(val / 100)
    const remainder = val % 100
    const tens = Math.floor(remainder / 10)
    const ones = remainder % 10

    if (hundreds > 0) {
      if (hundreds === 1) parts.push("yüz")
      else parts.push(`${TURKISH_ONES[hundreds]} yüz`)
    }
    if (tens > 0) parts.push(TURKISH_TENS[tens])
    if (ones > 0) parts.push(TURKISH_ONES[ones])
    return parts.join(" ")
  }

  const thousands = Math.floor(n / 1000)
  const rest = n % 1000
  const words = []

  if (thousands > 0) {
    if (thousands === 1) words.push("bin")
    else words.push(`${convertBelowThousand(thousands)} bin`)
  }
  if (rest > 0) {
    words.push(convertBelowThousand(rest))
  }
  return words.join(" ").trim()
}

function replaceNumbersWithTurkishWords(rawText) {
  const raw = String(rawText || "").trim()
  if (!raw) return ""

  return raw
    .replace(/\bVIP\b/gi, "VİP")
    .replace(/\bNo\.?\s*(\d+)/gi, "numara $1")
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-ZçğıöşüÇĞİÖŞÜ])/g, "$1 $2")
    .replace(/[-_/]+/g, " ")
    .replace(/\d+/g, (match) => numberToTurkishWords(Number.parseInt(match, 10)))
    .replace(/\s+/g, " ")
    .trim()
}

function buildTurkishWaiterAnnouncement(payload = {}) {
  const rawTable = String(payload.tableName || "").trim()
  const rawSection = String(payload.sectionName || "").trim()
  const requestType = payload.requestType === "bill" ? "bill" : "waiter"
  const actionText = requestType === "bill" ? "hesap istiyor." : "garson çağırıyor."

  const hasValidSection =
    Boolean(rawSection) &&
    rawSection.toLowerCase() !== "default" &&
    !rawTable.toLocaleLowerCase("tr-TR").startsWith(rawSection.toLocaleLowerCase("tr-TR"))

  const spokenSection = hasValidSection ? replaceNumbersWithTurkishWords(rawSection) : ""

  let spokenTable = "Masa"
  if (rawTable) {
    const normalizedTableWords = replaceNumbersWithTurkishWords(rawTable)
    const containsMasaWord = /\bmasa\b/i.test(rawTable)
    spokenTable = containsMasaWord
      ? normalizedTableWords
      : `${normalizedTableWords} numaralı masa`
  }

  return spokenSection
    ? `${spokenSection}, ${spokenTable} ${actionText}`
    : `${spokenTable} ${actionText}`
}

function getTtsCacheDir() {
  const dir = path.join(getAppDataDir(), "tts-cache")
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

function pruneTtsCache(cacheDir) {
  try {
    const entries = fs
      .readdirSync(cacheDir)
      .filter((name) => name.endsWith(".mp3"))
      .map((name) => {
        const fullPath = path.join(cacheDir, name)
        const stat = fs.statSync(fullPath)
        return { fullPath, mtimeMs: stat.mtimeMs }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)

    if (entries.length <= MAX_CACHE_FILES) return
    for (const stale of entries.slice(MAX_CACHE_FILES)) {
      try {
        fs.unlinkSync(stale.fullPath)
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore cache prune errors
  }
}

async function synthesizeTurkishMp3(text) {
  const cleanText = String(text || "").trim()
  if (!cleanText) return null

  const cacheDir = getTtsCacheDir()
  const hash = crypto.createHash("sha1").update(cleanText, "utf8").digest("hex")
  const cacheFile = path.join(cacheDir, `${hash}.mp3`)

  try {
    if (fs.existsSync(cacheFile)) {
      const stat = fs.statSync(cacheFile)
      if (stat.size > 256) {
        const now = new Date()
        try {
          fs.utimesSync(cacheFile, now, now)
        } catch {
          // ignore
        }
        return {
          mp3Buffer: fs.readFileSync(cacheFile),
          cacheFile,
          fromCache: true,
        }
      }
    }
  } catch {
    // fallback to fresh download
  }

  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=tr&client=tw-ob&q=${encodeURIComponent(cleanText)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(ttsUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "audio/mpeg, audio/*;q=0.9, */*;q=0.8",
        Referer: "https://translate.google.com/",
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`TTS HTTP ${res.status}`)
    }
    const arrayBuf = await res.arrayBuffer()
    const mp3Buffer = Buffer.from(arrayBuf)
    if (mp3Buffer.length < 256) {
      throw new Error("TTS audio response too small")
    }

    const tmpFile = `${cacheFile}.${process.pid}.tmp`
    try {
      fs.writeFileSync(tmpFile, mp3Buffer)
      fs.renameSync(tmpFile, cacheFile)
    } catch {
      fs.writeFileSync(cacheFile, mp3Buffer)
    }
    pruneTtsCache(cacheDir)

    return {
      mp3Buffer,
      cacheFile,
      fromCache: false,
    }
  } finally {
    clearTimeout(timer)
  }
}

function playMp3WithOsFallback(cacheFile) {
  return new Promise((resolve) => {
    if (!cacheFile || !fs.existsSync(cacheFile)) {
      resolve(false)
      return
    }

    if (process.platform === "win32") {
      const escapedPath = cacheFile.replace(/'/g, "''")
      const psScript = [
        "Add-Type -AssemblyName presentationCore;",
        "$player = New-Object System.Windows.Media.MediaPlayer;",
        `$player.Open([Uri]::new('${escapedPath}'));`,
        "$player.Volume = 1.0;",
        "Start-Sleep -Milliseconds 250;",
        "$player.Play();",
        "Start-Sleep -Milliseconds 3800;",
        "$player.Close();",
      ].join(" ")
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", psScript],
        { windowsHide: true, stdio: "ignore" },
      )
      child.on("error", () => resolve(false))
      child.on("close", (code) => resolve(code === 0))
      return
    }

    const players = [
      ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", cacheFile]],
      ["mpg123", ["-q", cacheFile]],
      ["cvlc", ["--play-and-exit", "--quiet", cacheFile]],
    ]

    const tryNext = (idx) => {
      if (idx >= players.length) {
        resolve(false)
        return
      }
      const [cmd, args] = players[idx]
      const child = spawn(cmd, args, { stdio: "ignore" })
      child.on("error", () => tryNext(idx + 1))
      child.on("close", (code) => {
        if (code === 0) resolve(true)
        else tryNext(idx + 1)
      })
    }
    tryNext(0)
  })
}

function setElectronTtsSender(fn) {
  electronTtsSender = typeof fn === "function" ? fn : null
}

function getRecentUiAudioEvents() {
  const cutoff = Date.now() - 20000
  while (recentUiAudioEvents.length > 0 && recentUiAudioEvents[0].timestamp < cutoff) {
    recentUiAudioEvents.shift()
  }
  return [...recentUiAudioEvents]
}

async function processSingleAnnouncement(payload) {
  const text = buildTurkishWaiterAnnouncement(payload)
  const eventId = String(payload?.id || `tts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  const requestType = payload?.requestType === "bill" ? "bill" : "waiter"

  let mp3Base64 = null
  let cacheFile = null
  let fromCache = false

  try {
    const synth = await synthesizeTurkishMp3(text)
    if (synth?.mp3Buffer) {
      mp3Base64 = synth.mp3Buffer.toString("base64")
      cacheFile = synth.cacheFile
      fromCache = synth.fromCache
    }
  } catch (err) {
    warn("Turkish TTS synthesis failed, falling back to chime + speech", {
      text,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const audioEvent = {
    id: eventId,
    text,
    tableName: String(payload?.tableName || ""),
    sectionName: String(payload?.sectionName || ""),
    requestType,
    isTest: Boolean(payload?.isTest),
    mp3Base64,
    timestamp: Date.now(),
  }

  recentUiAudioEvents.push(audioEvent)
  while (recentUiAudioEvents.length > 12) {
    recentUiAudioEvents.shift()
  }

  let deliveredToElectron = false
  if (electronTtsSender) {
    try {
      deliveredToElectron = Boolean(electronTtsSender(audioEvent))
    } catch {
      deliveredToElectron = false
    }
  }

  if (!deliveredToElectron && cacheFile) {
    await playMp3WithOsFallback(cacheFile)
  }

  info("Masa çağrısı sesli anonsu okundu", {
    text,
    tableName: audioEvent.tableName,
    sectionName: audioEvent.sectionName,
    requestType,
    fromCache,
    deliveredToElectron,
  })
}

async function drainAnnouncementQueue() {
  if (isProcessingQueue) return
  isProcessingQueue = true
  try {
    while (announcementQueue.length > 0) {
      const nextPayload = announcementQueue.shift()
      await processSingleAnnouncement(nextPayload)
      if (announcementQueue.length > 0) {
        await new Promise((r) => setTimeout(r, ANNOUNCEMENT_GAP_MS))
      }
    }
  } finally {
    isProcessingQueue = false
  }
}

function announceWaiterCall(payload = {}) {
  const now = Date.now()
  for (const [id, ts] of announcedCallTimestamps.entries()) {
    if (now - ts > DEDUPE_TTL_MS) announcedCallTimestamps.delete(id)
  }

  const dedupeKey = payload?.id
    ? String(payload.id)
    : `${payload?.tableName || ""}:${payload?.requestType || "waiter"}:${Math.floor(now / 3000)}`

  if (!payload?.isTest && announcedCallTimestamps.has(dedupeKey)) {
    return { queued: false, reason: "duplicate" }
  }
  announcedCallTimestamps.set(dedupeKey, now)

  const text = buildTurkishWaiterAnnouncement(payload)
  announcementQueue.push(payload)
  void drainAnnouncementQueue()
  return { queued: true, text }
}

module.exports = {
  numberToTurkishWords,
  replaceNumbersWithTurkishWords,
  buildTurkishWaiterAnnouncement,
  synthesizeTurkishMp3,
  announceWaiterCall,
  setElectronTtsSender,
  getRecentUiAudioEvents,
}

