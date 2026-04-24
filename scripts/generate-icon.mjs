/**
 * Generate a proper macOS squircle app icon from the existing logo.
 *
 * Uses Apple's official icon grid proportions:
 * - 1024×1024 canvas
 * - ~824×824 squircle body (centered)
 * - Superellipse with n≈5 for the continuous corner shape
 *
 * Usage: node scripts/generate-icon.mjs
 */

import sharp from 'sharp'
import { mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SOURCE_ICON = resolve(ROOT, 'build/icon.original.png')
const OUTPUT_ICNS = resolve(ROOT, 'build/icon.icns')
const OUTPUT_PNG = resolve(ROOT, 'build/icon.png')
const ICONSET_DIR = resolve(ROOT, 'build/icon.iconset')

// ── Generate superellipse path points ──────────────────────────────
// The Apple squircle is a superellipse: |x/a|^n + |y/a|^n = 1
// with n ≈ 5 for the macOS icon shape.

function superellipsePoints(cx, cy, rx, ry, n = 5, numPoints = 360) {
  const points = []
  for (let i = 0; i < numPoints; i++) {
    const t = (2 * Math.PI * i) / numPoints
    const cosT = Math.cos(t)
    const sinT = Math.sin(t)

    const x = cx + Math.sign(cosT) * rx * Math.pow(Math.abs(cosT), 2 / n)
    const y = cy + Math.sign(sinT) * ry * Math.pow(Math.abs(sinT), 2 / n)

    points.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })
  }
  return points
}

function makeSquircleSvg(size, bgColor = '#FFFFFF') {
  const s = size
  const cx = s / 2
  const cy = s / 2
  // Squircle body is ~80.5% of canvas
  const radius = Math.round(s * 0.4025)

  const points = superellipsePoints(cx, cy, radius, radius, 5, 720)

  const pathD =
    `M ${points[0].x},${points[0].y} ` + points.slice(1).map((p) => `L ${p.x},${p.y}`).join(' ') + ' Z'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <filter id="shadow" x="-5%" y="-3%" width="110%" height="112%">
      <feDropShadow dx="0" dy="${Math.round(s * 0.003)}" stdDeviation="${Math.round(s * 0.006)}" flood-color="#000000" flood-opacity="0.15"/>
    </filter>
  </defs>
  <path d="${pathD}" fill="${bgColor}" filter="url(#shadow)"/>
</svg>`
}

function makeSquircleMask(size) {
  const s = size
  const cx = s / 2
  const cy = s / 2
  const radius = Math.round(s * 0.4025)

  const points = superellipsePoints(cx, cy, radius, radius, 5, 720)

  const pathD =
    `M ${points[0].x},${points[0].y} ` + points.slice(1).map((p) => `L ${p.x},${p.y}`).join(' ') + ' Z'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="black"/>
  <path d="${pathD}" fill="white"/>
</svg>`
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const CANVAS = 1024
  const BG_COLOR = '#FFFFFF'

  console.log('📐 Generating macOS squircle icon...')
  console.log(`   Source: ${SOURCE_ICON}`)

  // 1. Create the squircle background
  const squircleSvg = Buffer.from(makeSquircleSvg(CANVAS, BG_COLOR))
  const squircleBg = await sharp(squircleSvg).resize(CANVAS, CANVAS).png().toBuffer()

  // 2. Load and resize the original logo to fit inside the squircle
  //    The logo should sit comfortably within the squircle body
  //    Squircle body is ~805px, logo should be ~70% of that = ~564px
  const squircleBodySize = Math.round(CANVAS * 0.805)
  const logoScale = 0.72 // how much of the squircle body the logo fills
  const logoSize = Math.round(squircleBodySize * logoScale) // ~580px
  const logoPadding = Math.round((CANVAS - logoSize) / 2) // center it

  const logo = await sharp(SOURCE_ICON)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  // 3. Composite: squircle bg + centered logo
  const composited = await sharp(squircleBg)
    .composite([
      {
        input: logo,
        left: logoPadding,
        top: logoPadding,
      },
    ])
    .png()
    .toBuffer()

  // 4. Apply the squircle mask to clip everything outside
  const maskSvg = Buffer.from(makeSquircleMask(CANVAS))

  const maskedIcon = await sharp(composited)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(async ({ data, info }) => {
      const maskData = await sharp(maskSvg)
        .resize(CANVAS, CANVAS)
        .extractChannel(0)
        .raw()
        .toBuffer()

      // Apply mask: set alpha to mask value
      for (let i = 0; i < maskData.length; i++) {
        data[i * 4 + 3] = maskData[i]
      }

      return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png()
        .toBuffer()
    })

  // 5. Save the 1024px master icon
  console.log('   Saving master 1024×1024 icon...')
  await sharp(maskedIcon).toFile(OUTPUT_PNG + '.new')

  // 6. Generate the .iconset directory with all required sizes
  console.log('   Generating .iconset...')

  try {
    rmSync(ICONSET_DIR, { recursive: true, force: true })
  } catch {}
  mkdirSync(ICONSET_DIR, { recursive: true })

  const sizes = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ]

  for (const { name, size } of sizes) {
    const outPath = resolve(ICONSET_DIR, name)
    await sharp(maskedIcon).resize(size, size, { kernel: 'lanczos3' }).png().toFile(outPath)
    console.log(`   ✓ ${name} (${size}×${size})`)
  }

  // 7. Use iconutil to generate .icns
  console.log('   Running iconutil...')
  try {
    execSync(`iconutil -c icns "${ICONSET_DIR}" -o "${OUTPUT_ICNS}"`)
    console.log(`   ✓ Generated ${OUTPUT_ICNS}`)
  } catch (err) {
    console.error('   ✗ iconutil failed:', err.message)
    process.exit(1)
  }

  // 8. Replace original icon.png with new version
  const { rename } = await import('fs/promises')
  await rename(OUTPUT_PNG + '.new', OUTPUT_PNG)
  console.log(`   ✓ Updated ${OUTPUT_PNG}`)

  // 9. Clean up
  rmSync(ICONSET_DIR, { recursive: true, force: true })
  console.log('\n✅ Done! Your macOS icon has been updated.')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
