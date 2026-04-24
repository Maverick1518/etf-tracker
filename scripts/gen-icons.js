// Generates public/icon-192.png and public/icon-512.png — no external deps
import zlib from 'zlib'
import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const tb = Buffer.from(type, 'ascii')
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length)
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])))
  return Buffer.concat([lb, tb, data, cb])
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function makePNG(size) {
  const pixels = new Uint8Array(size * size * 4)

  // Background #030712
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4]     = 0x03
    pixels[i * 4 + 1] = 0x07
    pixels[i * 4 + 2] = 0x12
    pixels[i * 4 + 3] = 0xFF
  }

  function blendPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (Math.round(y) * size + Math.round(x)) * 4
    const alpha = a / 255
    pixels[i]     = Math.min(255, Math.round(pixels[i]     * (1 - alpha) + r * alpha))
    pixels[i + 1] = Math.min(255, Math.round(pixels[i + 1] * (1 - alpha) + g * alpha))
    pixels[i + 2] = Math.min(255, Math.round(pixels[i + 2] * (1 - alpha) + b * alpha))
    pixels[i + 3] = 0xFF
  }

  // Filled disc with soft AA edge
  function disc(cx, cy, radius, r, g, b, a = 255) {
    const x0 = Math.floor(cx - radius - 1)
    const x1 = Math.ceil(cx + radius + 1)
    const y0 = Math.floor(cy - radius - 1)
    const y1 = Math.ceil(cy + radius + 1)
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
        if (d <= radius) {
          blendPixel(px, py, r, g, b, a)
        } else if (d <= radius + 1) {
          blendPixel(px, py, r, g, b, Math.round(a * (radius + 1 - d)))
        }
      }
    }
  }

  // Thick line via disc sweep
  function line(x0, y0, x1, y1, thickness, r, g, b, a = 255) {
    const dx = x1 - x0, dy = y1 - y0
    const steps = Math.max(Math.ceil(Math.sqrt(dx * dx + dy * dy)), 1)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      disc(x0 + dx * t, y0 + dy * t, thickness, r, g, b, a)
    }
  }

  // ── Chart geometry ──
  const mg  = size * 0.16          // margin
  const cw  = size - mg * 2        // chart width
  const ch  = size * 0.50          // chart height
  const bY  = size * 0.72          // baseline Y (top of bottom margin)
  const lw  = size * 0.042         // line half-width
  const dR  = size * 0.058         // dot radius

  // Ascending chart points [0..1 x, 0..1 y] — 0 = bottom
  const rawPts = [
    [0.00, 0.60],
    [0.24, 0.38],
    [0.43, 0.52],
    [0.64, 0.20],
    [1.00, 0.00],
  ]
  const pts = rawPts.map(([px, py]) => [mg + px * cw, bY - py * ch])

  const IR = 0x63, IG = 0x66, IB = 0xF1  // #6366f1

  // Glow pass (wider, transparent)
  for (let i = 0; i < pts.length - 1; i++) {
    line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lw * 3.2, IR, IG, IB, 28)
  }

  // Main line
  for (let i = 0; i < pts.length - 1; i++) {
    line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lw, IR, IG, IB)
  }

  // Dots: glow → indigo ring → white core
  for (const [x, y] of pts) {
    disc(x, y, dR * 2.4, IR, IG, IB, 35)
    disc(x, y, dR,       IR, IG, IB)
    disc(x, y, dR * 0.4, 255, 255, 255)
  }

  // ── Encode PNG ──
  const scanlines = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    scanlines[y * (size * 3 + 1)] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      const dst = y * (size * 3 + 1) + 1 + x * 3
      const src = (y * size + x) * 4
      scanlines[dst]     = pixels[src]
      scanlines[dst + 1] = pixels[src + 1]
      scanlines[dst + 2] = pixels[src + 2]
    }
  }

  const compressed = zlib.deflateSync(scanlines, { level: 9 })

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Write files ───────────────────────────────────────────────────────────────
const publicDir = join(__dirname, '..', 'public')

for (const size of [192, 512]) {
  const png = makePNG(size)
  const out = join(publicDir, `icon-${size}.png`)
  fs.writeFileSync(out, png)
  console.log(`icon-${size}.png  ${png.length} bytes`)
}
