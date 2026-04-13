import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_SETTINGS, type AppSettings } from '../shared/types'

const SETTINGS_PATH = join(app.getPath('userData'), 'settings.json')

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8')) as Record<string, unknown>
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      hotkeys: {
        ...DEFAULT_SETTINGS.hotkeys,
        ...(raw['hotkeys'] as Record<string, string> | undefined),
      },
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
}
