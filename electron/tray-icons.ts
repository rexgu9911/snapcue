import sharp from 'sharp'
import { nativeImage } from 'electron'
import type { TrayIcon } from '../shared/types'

const SIZE = 22

const SVGS: Record<TrayIcon, string> = {
  dot: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="4" fill="black"/>
  </svg>`,

  book: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 4.5C5 4.5 7.5 3.5 11 4.5V17C7.5 16 5 17 5 17V4.5Z" stroke="black" stroke-width="1.4" fill="none" stroke-linejoin="round"/>
    <path d="M17 4.5C17 4.5 14.5 3.5 11 4.5V17C14.5 16 17 17 17 17V4.5Z" stroke="black" stroke-width="1.4" fill="none" stroke-linejoin="round"/>
  </svg>`,

  bolt: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 3L7 12H10.5L9.5 19L15 10H11.5L12.5 3Z" fill="black"/>
  </svg>`,

  square: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect x="6.5" y="6.5" width="9" height="9" rx="2" stroke="black" stroke-width="1.5" fill="none"/>
  </svg>`,
}

const cache = new Map<TrayIcon, Electron.NativeImage>()

export async function getTrayIcon(name: TrayIcon): Promise<Electron.NativeImage> {
  const cached = cache.get(name)
  if (cached) return cached

  const png = await sharp(Buffer.from(SVGS[name]))
    .resize(SIZE * 2, SIZE * 2) // @2x for Retina
    .png()
    .toBuffer()

  const img = nativeImage.createFromBuffer(png, { scaleFactor: 2.0 })
  img.setTemplateImage(true)
  cache.set(name, img)
  return img
}
