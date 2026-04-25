import 'dotenv/config'
import { z } from 'zod'

// Single source of truth for backend env vars. Imported first by server.ts so
// any missing/invalid value fails the boot with a clear, aggregated error
// instead of crashing later inside an unrelated module.
//
// Naming convention (decided after the Phase 6.2 PR 2 retrospective):
//   - Third-party-native names for vendor secrets: OPENAI_API_KEY, SUPABASE_*
//   - SNAPCUE_ prefix only for our own private vars (e.g. SNAPCUE_API_KEY)
//   - Frontend (Vite) keeps its SNAPCUE_ prefix — Vite filters by envPrefix.

const schema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1)
    .refine(
      (v) => !v.startsWith('sb_publishable_'),
      'SUPABASE_SERVICE_ROLE_KEY looks like an anon/publishable key. Use the service_role secret (Supabase dashboard → Project Settings → API → service_role).',
    ),
  SNAPCUE_API_KEY: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.string().optional(),

  // Stripe (Phase 6.3). SECRET_KEY + WEBHOOK_SECRET are required as of task 4
  // (webhook handler depends on both). The four PRICE_* vars stay optional
  // until task 6 wires up checkout — tightened then.
  STRIPE_SECRET_KEY: z
    .string()
    .min(1)
    .refine(
      (v) => v.startsWith('sk_test_') || v.startsWith('sk_live_'),
      'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_',
    ),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1)
    .refine(
      (v) => v.startsWith('whsec_'),
      'STRIPE_WEBHOOK_SECRET must start with whsec_',
    ),
  STRIPE_PRICE_WEEKLY: z.string().startsWith('price_').optional(),
  STRIPE_PRICE_MONTHLY: z.string().startsWith('price_').optional(),
  STRIPE_PRICE_PACK_30: z.string().startsWith('price_').optional(),
  STRIPE_PRICE_PACK_100: z.string().startsWith('price_').optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')
  throw new Error(
    `Invalid backend environment:\n${issues}\n\n` +
      'Copy backend/.env.example to backend/.env and fill all required values.',
  )
}

export const env = parsed.data
