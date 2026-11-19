/**
 * Self-contained ISO/IEC 18004 Byte-mode QR Code -> SVG & Data-URI generator
 * and HTML string escaper for safe same-origin print popup rendering.
 * Zero external network requests.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] || ch)
}

// Level L version parameters for versions 1..10:
// [totalDataCodewords, ecPerBlock, blocksGroup1, dataColsGroup1, blocksGroup2, dataColsGroup2]
const VERSION_TABLE_L: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [0, 0, 0, 0, 0, 0],
  [19, 7, 1, 19, 0, 0], [34, 10, 1, 34, 0, 0], [55, 15, 1, 55, 0, 0],
  [80, 20, 1, 80, 0, 0], [108, 26, 1, 108, 0, 0], [136, 18, 2, 68, 0, 0],
  [156, 20, 2, 78, 0, 0], [194, 24, 2, 97, 0, 0], [232, 30, 2, 116, 0, 0],
  [274, 18, 2, 68, 2, 69],
]

const ALIGN_POS: ReadonlyArray<readonly number[]> = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30],
  [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
]

const GF_EXP = new Uint8Array(256)
const GF_LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0)
  }
  GF_EXP[255] = GF_EXP[0]
})()

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255]
}

function computeReedSolomonRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  let gen = new Uint8Array([1])
  for (let i = 0; i < ecLen; i++) {
    const next = new Uint8Array(gen.length + 1)
    const root = GF_EXP[i]
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j]
      next[j + 1] ^= gfMul(gen[j], root)
    }
    gen = next
  }
  const rem = new Uint8Array(ecLen)
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0]
    rem.copyWithin(0, 1)
    rem[ecLen - 1] = 0
    for (let j = 0; j < ecLen; j++) rem[j] ^= gfMul(gen[j + 1], factor)
  }
  return rem
}

export function encodeQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text)
  let version = 1
  while (version <= 10) {
    const countBits = version < 10 ? 8 : 16
    if (4 + countBits + utf8.length * 8 <= VERSION_TABLE_L[version][0] * 8) break
    version++
  }
  if (version > 10) version = 10

  const [totalDataBytes, ecLen, b1, c1, b2, c2] = VERSION_TABLE_L[version]
  const countBits = version < 10 ? 8 : 16
  const payload = utf8.length * 8 + 4 + countBits > totalDataBytes * 8
    ? utf8.slice(0, Math.floor((totalDataBytes * 8 - 4 - countBits) / 8))
    : utf8

  const bits: number[] = []
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1)
  }
  pushBits(0b0100, 4)
  pushBits(payload.length, countBits)
  for (let i = 0; i < payload.length; i++) pushBits(payload[i], 8)

  const maxBits = totalDataBytes * 8
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const dataBytes = new Uint8Array(totalDataBytes)
  const byteLen = bits.length / 8
  for (let i = 0; i < byteLen; i++) {
    let b = 0
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j]
    dataBytes[i] = b
  }
  for (let i = byteLen, p = 0; i < totalDataBytes; i++, p ^= 1) {
    dataBytes[i] = p === 0 ? 0xec : 0x11
  }

  const dataBlocks: Uint8Array[] = []
  const ecBlocks: Uint8Array[] = []
  let offset = 0
  for (let i = 0; i < b1; i++) {
    const blk = dataBytes.slice(offset, offset + c1)
    dataBlocks.push(blk)
    ecBlocks.push(computeReedSolomonRemainder(blk, ecLen))
    offset += c1
  }
  for (let i = 0; i < b2; i++) {
    const blk = dataBytes.slice(offset, offset + c2)
    dataBlocks.push(blk)
    ecBlocks.push(computeReedSolomonRemainder(blk, ecLen))
    offset += c2
  }

  const codewords: number[] = []
  const maxDataCols = Math.max(c1, c2)
  for (let col = 0; col < maxDataCols; col++) {
    for (const blk of dataBlocks) if (col < blk.length) codewords.push(blk[col])
  }
  for (let col = 0; col < ecLen; col++) {
    for (const blk of ecBlocks) codewords.push(blk[col])
  }

  const size = 17 + version * 4
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark
      reserved[r][c] = true
    }
  }

  const drawFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
        setFunc(top + dr, left + dc, inOuter && (onBorder || inCore))
      }
    }
  }
  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  const coords = ALIGN_POS[version]
  for (const r of coords) {
    for (const c of coords) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          setFunc(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1)
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setFunc(6, i, i % 2 === 0)
    if (!reserved[i][6]) setFunc(i, 6, i % 2 === 0)
  }
  setFunc(size - 8, 8, true)

  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) setFunc(8, i, false)
    if (!reserved[i][8]) setFunc(i, 8, false)
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, size - 1 - i, false)
    if (i < 7) setFunc(size - 1 - i, 8, false)
  }

  if (version >= 7) {
    let rem = version << 12
    for (let b = 17; b >= 12; b--) if ((rem >> b) & 1) rem ^= 0x1f25 << (b - 12)
    const vInfo = (version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const bit = ((vInfo >> i) & 1) === 1
      const r = Math.floor(i / 3)
      const c = size - 11 + (i % 3)
      setFunc(r, c, bit)
      setFunc(c, r, bit)
    }
  }

  let bitIdx = 0
  const totalCwBits = codewords.length * 8
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert
      for (let dx = 0; dx < 2; dx++) {
        const c = right - dx
        if (!reserved[r][c]) {
          const dark = bitIdx < totalCwBits && ((codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1
          modules[r][c] = (r + c) % 2 === 0 ? !dark : dark
          bitIdx++
        }
      }
    }
    upward = !upward
  }

  // Format information for Level L (01) + Mask 0 (000) -> BCH & XOR 0x5412 = 0x77c4
  const fmt = 0x77c4
  const fmtBit = (i: number) => ((fmt >> i) & 1) === 1
  for (let i = 0; i <= 5; i++) modules[i][8] = fmtBit(i)
  modules[7][8] = fmtBit(6)
  modules[8][8] = fmtBit(7)
  modules[8][7] = fmtBit(8)
  for (let i = 9; i < 15; i++) modules[8][14 - i] = fmtBit(i)
  for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = fmtBit(i)
  for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = fmtBit(i)

  return modules
}

export function generateQrSvg(text: string, pixelSize = 160, margin = 2): string {
  const matrix = encodeQrMatrix(text)
  const n = matrix.length
  const viewSize = n + margin * 2
  let path = ""
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (matrix[r][c]) path += `M${c + margin} ${r + margin}h1v1h-1z`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${path}" fill="#1d1d1f"/></svg>`
}

export function generateQrDataUri(text: string, pixelSize = 160, margin = 2): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(generateQrSvg(text, pixelSize, margin))}`
}
