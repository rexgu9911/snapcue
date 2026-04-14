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

  input: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="12" height="12" rx="2" stroke="black" stroke-width="1.2" fill="none"/>
    <text x="11" y="15" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="600" fill="black">A</text>
  </svg>`,

  shield: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 3C8 5 5 5 5 5C5 5 5 12 11 19C17 12 17 5 17 5C17 5 14 5 11 3Z" stroke="black" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
  </svg>`,

  cn: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <text x="11" y="16" text-anchor="middle" font-family="PingFang SC, SF Pro SC, sans-serif" font-size="14" font-weight="500" fill="black">中</text>
  </svg>`,

  ghost: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 18L8.5 16L11 18L13.5 16L15 18V10C15 7.2 13.2 4 11 4C8.8 4 7 7.2 7 10V18Z" stroke="black" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
    <circle cx="9.5" cy="10" r="1" fill="black"/>
    <circle cx="12.5" cy="10" r="1" fill="black"/>
  </svg>`,
}

/** SVGs with lowered opacity for the "analyzing" state (dimmed icon). */
const ANALYZING_SVGS: Record<TrayIcon, string> = {
  dot: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="4" fill="black" opacity="0.35"/>
  </svg>`,

  book: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <g opacity="0.35">
      <path d="M5 4.5C5 4.5 7.5 3.5 11 4.5V17C7.5 16 5 17 5 17V4.5Z" stroke="black" stroke-width="1.4" fill="none" stroke-linejoin="round"/>
      <path d="M17 4.5C17 4.5 14.5 3.5 11 4.5V17C14.5 16 17 17 17 17V4.5Z" stroke="black" stroke-width="1.4" fill="none" stroke-linejoin="round"/>
    </g>
  </svg>`,

  bolt: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 3L7 12H10.5L9.5 19L15 10H11.5L12.5 3Z" fill="black" opacity="0.35"/>
  </svg>`,

  square: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect x="6.5" y="6.5" width="9" height="9" rx="2" stroke="black" stroke-width="1.5" fill="none" opacity="0.35"/>
  </svg>`,

  input: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <g opacity="0.35">
      <rect x="5" y="5" width="12" height="12" rx="2" stroke="black" stroke-width="1.2" fill="none"/>
      <text x="11" y="15" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="600" fill="black">A</text>
    </g>
  </svg>`,

  shield: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 3C8 5 5 5 5 5C5 5 5 12 11 19C17 12 17 5 17 5C17 5 14 5 11 3Z" stroke="black" stroke-width="1.2" fill="none" stroke-linejoin="round" opacity="0.35"/>
  </svg>`,

  cn: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <text x="11" y="16" text-anchor="middle" font-family="PingFang SC, SF Pro SC, sans-serif" font-size="14" font-weight="500" fill="black" opacity="0.35">中</text>
  </svg>`,

  ghost: `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <g opacity="0.35">
      <path d="M7 18L8.5 16L11 18L13.5 16L15 18V10C15 7.2 13.2 4 11 4C8.8 4 7 7.2 7 10V18Z" stroke="black" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
      <circle cx="9.5" cy="10" r="1" fill="black"/>
      <circle cx="12.5" cy="10" r="1" fill="black"/>
    </g>
  </svg>`,
}

const cache = new Map<string, Electron.NativeImage>()

async function renderIcon(svg: string, cacheKey: string): Promise<Electron.NativeImage> {
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const png = await sharp(Buffer.from(svg))
    .resize(SIZE * 2, SIZE * 2) // @2x for Retina
    .png()
    .toBuffer()

  const img = nativeImage.createFromBuffer(png, { scaleFactor: 2.0 })
  img.setTemplateImage(true)
  cache.set(cacheKey, img)
  return img
}

export async function getTrayIcon(name: TrayIcon): Promise<Electron.NativeImage> {
  return renderIcon(SVGS[name], name)
}

export async function getAnalyzingIcon(name: TrayIcon): Promise<Electron.NativeImage> {
  return renderIcon(ANALYZING_SVGS[name], `${name}-analyzing`)
}
