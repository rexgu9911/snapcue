import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env['SUPABASE_URL']
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!url || !serviceRoleKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
      'Copy backend/.env.example to backend/.env and fill both values.',
  )
}

export const supabaseAdmin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})
