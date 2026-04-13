import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { downscaleToBase64 } from './screenshot'

async function createTestPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

describe('downscaleToBase64', () => {
  it('returns valid base64 for a small image without resizing', async () => {
    const png = await createTestPng(800, 600)
    const base64 = await downscaleToBase64(png, 1200)

    expect(base64).toBeTruthy()

    // Decode and check dimensions are unchanged
    const meta = await sharp(Buffer.from(base64, 'base64')).metadata()
    expect(meta.width).toBe(800)
    expect(meta.height).toBe(600)
  })

  it('downscales a landscape image so long edge = maxEdge', async () => {
    const png = await createTestPng(2400, 1600)
    const base64 = await downscaleToBase64(png, 1200)

    const meta = await sharp(Buffer.from(base64, 'base64')).metadata()
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(800)
  })

  it('downscales a portrait image so long edge = maxEdge', async () => {
    const png = await createTestPng(1080, 1920)
    const base64 = await downscaleToBase64(png, 1200)

    const meta = await sharp(Buffer.from(base64, 'base64')).metadata()
    expect(meta.width).toBe(675)
    expect(meta.height).toBe(1200)
  })

  it('downscales a square image correctly', async () => {
    const png = await createTestPng(2000, 2000)
    const base64 = await downscaleToBase64(png, 1200)

    const meta = await sharp(Buffer.from(base64, 'base64')).metadata()
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(1200)
  })

  it('does not upscale a small image', async () => {
    const png = await createTestPng(400, 300)
    const base64 = await downscaleToBase64(png, 1200)

    const meta = await sharp(Buffer.from(base64, 'base64')).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(300)
  })

  it('uses custom maxEdge parameter', async () => {
    const png = await createTestPng(1000, 500)
    const base64 = await downscaleToBase64(png, 600)

    const meta = await sharp(Buffer.from(base64, 'base64')).metadata()
    expect(meta.width).toBe(600)
    expect(meta.height).toBe(300)
  })
})
