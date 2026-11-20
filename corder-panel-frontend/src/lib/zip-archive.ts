/**
 * Pure TypeScript PKZIP (STORE / method 0, UTF-8) archive builder.
 * Generates standard .zip archives in memory with zero external dependencies.
 */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function toDosDateTime(date = new Date()): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear())
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = Math.floor(date.getSeconds() / 2)
  const dosTime = (hours << 11) | (minutes << 5) | seconds
  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  return { dosTime, dosDate }
}

export interface ZipTextEntry {
  filename: string
  content: string
}

export function buildZipArchiveBytes(entries: ZipTextEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const { dosTime, dosDate } = toDosDateTime()

  const prepared = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.filename.replace(/^\/+/, ""))
    const dataBytes = encoder.encode(entry.content)
    const checksum = crc32(dataBytes)
    return { nameBytes, dataBytes, checksum }
  })

  let localTotalSize = 0
  let centralTotalSize = 0
  for (const item of prepared) {
    localTotalSize += 30 + item.nameBytes.length + item.dataBytes.length
    centralTotalSize += 46 + item.nameBytes.length
  }

  const totalSize = localTotalSize + centralTotalSize + 22
  const out = new Uint8Array(totalSize)
  const view = new DataView(out.buffer)

  let localOffset = 0
  const localOffsets: number[] = []

  for (const item of prepared) {
    localOffsets.push(localOffset)
    view.setUint32(localOffset, 0x04034b50, true) // Local file header signature
    view.setUint16(localOffset + 4, 20, true) // Version needed to extract (2.0)
    view.setUint16(localOffset + 6, 0x0800, true) // General purpose bit flag (UTF-8)
    view.setUint16(localOffset + 8, 0, true) // Compression method (0 = STORE)
    view.setUint16(localOffset + 10, dosTime, true)
    view.setUint16(localOffset + 12, dosDate, true)
    view.setUint32(localOffset + 14, item.checksum, true)
    view.setUint32(localOffset + 18, item.dataBytes.length, true)
    view.setUint32(localOffset + 22, item.dataBytes.length, true)
    view.setUint16(localOffset + 26, item.nameBytes.length, true)
    view.setUint16(localOffset + 28, 0, true) // Extra field length
    out.set(item.nameBytes, localOffset + 30)
    out.set(item.dataBytes, localOffset + 30 + item.nameBytes.length)
    localOffset += 30 + item.nameBytes.length + item.dataBytes.length
  }

  let centralOffset = localOffset
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i]
    view.setUint32(centralOffset, 0x02014b50, true) // Central directory file header signature
    view.setUint16(centralOffset + 4, 20, true) // Version made by
    view.setUint16(centralOffset + 6, 20, true) // Version needed to extract
    view.setUint16(centralOffset + 8, 0x0800, true) // UTF-8 flag
    view.setUint16(centralOffset + 10, 0, true) // Compression method (0 = STORE)
    view.setUint16(centralOffset + 12, dosTime, true)
    view.setUint16(centralOffset + 14, dosDate, true)
    view.setUint32(centralOffset + 16, item.checksum, true)
    view.setUint32(centralOffset + 20, item.dataBytes.length, true)
    view.setUint32(centralOffset + 24, item.dataBytes.length, true)
    view.setUint16(centralOffset + 28, item.nameBytes.length, true)
    view.setUint16(centralOffset + 30, 0, true) // Extra field length
    view.setUint16(centralOffset + 32, 0, true) // File comment length
    view.setUint16(centralOffset + 34, 0, true) // Disk number start
    view.setUint16(centralOffset + 36, 0, true) // Internal file attributes
    view.setUint32(centralOffset + 38, 0, true) // External file attributes
    view.setUint32(centralOffset + 42, localOffsets[i], true) // Relative offset of local header
    out.set(item.nameBytes, centralOffset + 46)
    centralOffset += 46 + item.nameBytes.length
  }

  view.setUint32(centralOffset, 0x06054b50, true) // End of central directory signature
  view.setUint16(centralOffset + 4, 0, true) // Number of this disk
  view.setUint16(centralOffset + 6, 0, true) // Disk where central directory starts
  view.setUint16(centralOffset + 8, prepared.length, true) // Total entries on this disk
  view.setUint16(centralOffset + 10, prepared.length, true) // Total entries
  view.setUint32(centralOffset + 12, centralTotalSize, true) // Size of central directory
  view.setUint32(centralOffset + 16, localTotalSize, true) // Offset of start of central directory
  view.setUint16(centralOffset + 20, 0, true) // ZIP file comment length

  return out
}

export function downloadZipArchive(filename: string, entries: ZipTextEntry[]): void {
  const bytes = buildZipArchiveBytes(entries)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy.buffer], { type: "application/zip" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
