import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_SETTINGS, type AppSettings } from '../shared/types'

const SETTINGS_PATH = join(app.getPath('userData'), 'settings.json')

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8')) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...raw }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
}
