import { app } from 'electron'
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

const AUTH_FILE = join(app.getPath('userData'), 'auth.json')
const MAGIC_LINK_REDIRECT = 'https://snapcue-web.vercel.app/auth/callback'

// ── File-backed storage adapter ──────────────────────────────────────────────
//
// Supabase JS expects a Web Storage-like interface (getItem/setItem/removeItem).
// In Electron main we back it with a JSON file under userData so sessions
// survive app restarts and Supabase can auto-refresh tokens transparently.

function readStore(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

function writeStore(data: Record<string, string>): void {
  writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2))
}

const fileStorage = {
  getItem(key: string): string | null {
    const data = readStore()
    return data[key] ?? null
  },
  setItem(key: string, value: string): void {
    const data = readStore()
    data[key] = value
    writeStore(data)
  },
  removeItem(key: string): void {
    const data = readStore()
    delete data[key]
    writeStore(data)
  },
}

// ── Supabase client ──────────────────────────────────────────────────────────

const url = import.meta.env.SNAPCUE_SUPABASE_URL
const anonKey = import.meta.env.SNAPCUE_SUPABASE_ANON_KEY

let supabase: SupabaseClient | null = null

if (url && anonKey) {
  supabase = createClient(url, anonKey, {
    auth: {
      storage: fileStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
} else {
  console.warn(
    '[SnapCue] SNAPCUE_SUPABASE_URL or SNAPCUE_SUPABASE_ANON_KEY missing — auth disabled',
  )
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getStoredSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getStoredSession()
  return session?.user ?? null
}

export async function setStoredSession(
  access_token: string,
  refresh_token: string,
): Promise<Session | null> {
  if (!supabase) return null
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) {
    console.error('[SnapCue] setSession failed:', error.message)
    return null
  }
  return data.session
}

export async function clearStoredSession(): Promise<void> {
  if (!supabase) {
    if (existsSync(AUTH_FILE)) unlinkSync(AUTH_FILE)
    return
  }
  await supabase.auth.signOut()
}

export async function signInWithMagicLink(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Auth is not configured.' }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: MAGIC_LINK_REDIRECT },
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
