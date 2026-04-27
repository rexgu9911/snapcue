/**
 * Rasterize build/dmg-background.svg → build/dmg-background.png + @2x.png
 *
 * The SVG is the design source of truth (1× dimensions: 540×380). Sharp
 * renders it at 2× resolution internally (via density), then resizes down
 * to the target 1× and 2× pixel sizes, giving crisp output on both
 * standard and retina displays.
 *
 * Run via:  node scripts/generate-dmg-background.js
 */

const sharp = require('sharp')
const { join } = require('path')

const buildDir = join(__dirname, '..', 'build')
const svgPath = join(buildDir, 'dmg-background.svg')

async function main() {
  // 1× — 540×380 (Finder's nominal DMG window pixels)
  await sharp(svgPath, { density: 144 })
    .resize(540, 380, { fit: 'fill' })
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(join(buildDir, 'dmg-background.png'))

  // 2× — 1080×760 (retina)
  await sharp(svgPath, { density: 288 })
    .resize(1080, 760, { fit: 'fill' })
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(join(buildDir, 'dmg-background@2x.png'))

  console.log('Generated build/dmg-background.png + @2x.png')
}

main().catch((err) => {
  console.error('Failed to generate DMG background:', err)
  process.exit(1)
})
