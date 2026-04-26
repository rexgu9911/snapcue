import { describe, it, expect, vi } from 'vitest'

// CORS is a config one-liner, but it's also the kind of thing that silently
// breaks when someone "cleans up" the origin list. These tests pin the
// intended behavior: snapcue.io (prod), the legacy snapcue-web.vercel.app
// origin, and localhost dev are allowed, everything else doesn't get an
// Access-Control-Allow-Origin header (which is what makes browsers block
// the actual request).

vi.mock('../lib/env.js', () => ({
  env: {
    OPENAI_API_KEY: 'sk-test-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SNAPCUE_API_KEY: undefined,
    PORT: 3001,
    NODE_ENV: 'test',
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_fake',
    STRIPE_PRICE_WEEKLY: 'price_weekly_fake',
    STRIPE_PRICE_MONTHLY: 'price_monthly_fake',
    STRIPE_PRICE_PACK_30: 'price_pack30_fake',
    STRIPE_PRICE_PACK_100: 'price_pack100_fake',
  },
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}))

vi.mock('../lib/supabase.js', () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

import { buildApp } from '../server.js'

async function preflight(origin: string) {
  const app = await buildApp()
  return app.inject({
    method: 'OPTIONS',
    url: '/checkout',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type',
    },
  })
}

describe('CORS', () => {
  it('allows snapcue.io production origin', async () => {
    const res = await preflight('https://snapcue.io')
    expect(res.headers['access-control-allow-origin']).toBe('https://snapcue.io')
  })

  it('allows legacy snapcue-web.vercel.app origin', async () => {
    const res = await preflight('https://snapcue-web.vercel.app')
    expect(res.headers['access-control-allow-origin']).toBe('https://snapcue-web.vercel.app')
  })

  it('allows localhost dev (any port)', async () => {
    const res = await preflight('http://localhost:3000')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
  })

  it('rejects unknown origins (no ACAO header)', async () => {
    const res = await preflight('https://evil.example.com')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})
