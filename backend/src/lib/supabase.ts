import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

const url = process.env['SUPABASE_URL']
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (url && serviceRoleKey) {
  client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
} else {
  console.warn(
    '[SnapCue] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — auth disabled (anonymous mode).',
  )
}

export const supabaseAdmin = client
