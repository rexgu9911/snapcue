import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync, statSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { systemPreferences } from 'electron'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)

const MAX_LONG_EDGE = 1200

/** Resize a PNG buffer so the longest edge is at most `maxEdge` px. Returns base64. */
export async function downscaleToBase64(
  pngBuffer: Buffer,
  maxEdge = MAX_LONG_EDGE,
): Promise<string> {
  const image = sharp(pngBuffer)
  const meta = await image.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0

  if (width === 0 || height === 0) {
    throw new Error('Invalid image dimensions')
  }

  const longEdge = Math.max(width, height)
  const resized =
    longEdge > maxEdge
      ? image.resize({
          width: width >= height ? maxEdge : undefined,
          height: height > width ? maxEdge : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        })
      : image

  const buf = await resized.png().toBuffer()
  return buf.toString('base64')
}

/**
 * Get the CGWindowID of the frontmost window (excluding desktop elements).
 * Uses macOS JXA (JavaScript for Automation) to call CGWindowListCopyWindowInfo.
 * Returns null if detection fails.
 */
async function getFrontmostWindowId(): Promise<number | null> {
  try {
    const script = `
      ObjC.import('Quartz');
      var list = ObjC.deepUnwrap(
        $.CGWindowListCopyWindowInfo(
          $.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements,
          0
        )
      );
      var result = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].kCGWindowLayer === 0 && list[i].kCGWindowOwnerName !== 'SnapCue') {
          result = list[i].kCGWindowNumber;
          break;
        }
      }
      JSON.stringify(result);
    `
    const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
      timeout: 3000,
    })
    const parsed = parseInt(stdout.trim(), 10)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function tempPath(): string {
  return join(tmpdir(), `snapcue-${randomUUID()}.png`)
}

function cleanupFile(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch {
    // best-effort cleanup
  }
}

async function captureSilent(): Promise<string> {
  const dest = tempPath()
  try {
    const windowId = await getFrontmostWindowId()

    if (windowId !== null) {
      await execFileAsync('screencapture', ['-l', String(windowId), '-x', dest], {
        timeout: 5000,
      })
    } else {
      // Fallback: full screen capture
      await execFileAsync('screencapture', ['-x', dest], { timeout: 5000 })
    }

    if (!existsSync(dest) || statSync(dest).size === 0) {
      throw new Error('Screenshot capture produced no output')
    }

    const buf = await sharp(dest).png().toBuffer()
    return downscaleToBase64(buf)
  } finally {
    cleanupFile(dest)
  }
}

async function captureRegion(): Promise<string> {
  const dest = tempPath()
  try {
    // -i interactive, -s selection mode, -x no sound
    await execFileAsync('screencapture', ['-i', '-s', '-x', dest], {
      timeout: 60000, // user needs time to draw selection
    })

    if (!existsSync(dest) || statSync(dest).size === 0) {
      throw new Error('Region capture cancelled or produced no output')
    }

    const buf = await sharp(dest).png().toBuffer()
    return downscaleToBase64(buf)
  } finally {
    cleanupFile(dest)
  }
}

export async function captureScreenshot(mode: 'silent' | 'region'): Promise<string> {
  return mode === 'silent' ? captureSilent() : captureRegion()
}

/**
 * Check if macOS screen recording permission is granted.
 * Uses Electron's systemPreferences API which queries the TCC database directly.
 */
export function checkScreenRecordingPermission(): boolean {
  const status = systemPreferences.getMediaAccessStatus('screen')
  console.log('[SnapCue] Screen recording permission status:', status)
  return status === 'granted'
}
