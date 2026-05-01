/* oxlint-disable no-console -- CLI script */
import sharp from 'sharp'
import { join } from 'node:path'

const width = 2400
const height = 1260

const bg = { r: 13, g: 10, b: 26 }

async function createGlow(
  canvasW: number,
  canvasH: number,
  cx: number,
  cy: number,
  radius: number,
  color: { r: number; g: number; b: number },
  opacity: number,
) {
  const pixels = Buffer.alloc(canvasW * canvasH * 4, 0)

  for (let y = 0; y < canvasH; y++) {
    for (let x = 0; x < canvasW; x++) {
      const dx = (x - cx) / radius
      const dy = (y - cy) / radius
      const dist = Math.sqrt(dx * dx + dy * dy)
      const a = dist < 1.5 ? Math.max(0, 1 - (dist / 1.5) * (dist / 1.5)) ** 2 : 0
      const alpha = Math.round(a * opacity * 255)
      if (alpha > 0) {
        const idx = (y * canvasW + x) * 4
        pixels[idx] = color.r
        pixels[idx + 1] = color.g
        pixels[idx + 2] = color.b
        pixels[idx + 3] = alpha
      }
    }
  }

  return sharp(pixels, { raw: { width: canvasW, height: canvasH, channels: 4 } })
    .blur(50)
    .png()
    .toBuffer()
}

/** Triangular PDF dithering to break up 8 bit quantization bands */
function applyDithering(pixels: Buffer, w: number, h: number) {
  for (let i = 0; i < w * h * 4; i += 4) {
    for (let c = 0; c < 3; c++) {
      const noise = (Math.random() + Math.random() - 1) * 1.5
      const value = pixels[i + c] + noise
      pixels[i + c] = Math.max(0, Math.min(255, Math.round(value)))
    }
  }
}

console.log('Generating glows...')
const [coralGlow, purpleGlow, warmGlow] = await Promise.all([
  createGlow(width, height, width * 0.72, height * 0.15, 550, { r: 212, g: 99, b: 122 }, 0.22),
  createGlow(width, height, width * 0.15, height * 0.8, 500, { r: 138, g: 106, b: 191 }, 0.16),
  createGlow(width, height, width * 0.45, height * 0.45, 700, { r: 160, g: 140, b: 180 }, 0.05),
])

console.log('Compositing...')
const composited = await sharp({
  create: { width, height, channels: 4, background: { ...bg, alpha: 255 } },
})
  .composite([
    { input: warmGlow, left: 0, top: 0, blend: 'over' },
    { input: coralGlow, left: 0, top: 0, blend: 'over' },
    { input: purpleGlow, left: 0, top: 0, blend: 'over' },
  ])
  .raw()
  .toBuffer()

console.log('Applying dithering...')
applyDithering(composited, width, height)

const outPath = join(import.meta.dir, '..', 'public', 'og-bg.webp')
await sharp(composited, { raw: { width, height, channels: 4 } })
  .webp({ quality: 90 })
  .toFile(outPath)

console.log(`Background written to ${outPath} (${width}x${height})`)
