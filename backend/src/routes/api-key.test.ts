import { describe, it, expect, vi } from 'vitest'

// Pins the SNAPCUE_API_KEY allowlist behavior in server.ts. The bypass list
// guards against three failure modes:
//   1. accidentally adding a route to the bypass that should require x-api-key
//      (e.g., someone "cleans up" the conditions and lets /analyze through)
//   2. removing a route that legitimately can't carry x-api-key (Stripe
//      webhook, browser-initiated /checkout)
//   3. silent breakage if the route path/method match changes shape

vi.mock('../lib/env.js', () => ({
  env: {
    OPENAI_API_KEY: 'sk-test-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    // KEY IS SET — distinguishes this suite from cors/checkout/analyze tests
    // which use undefined to skip the hook entirely.
    SNAPCUE_API_KEY: 'test-api-key',
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

describe('SNAPCUE_API_KEY hook', () => {
  it('bypasses key check on GET /health', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
  })

  it('bypasses key check on POST /webhooks/stripe (signature is the gate)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    })
    // No x-api-key — must not get 401 from the api-key hook. Status will be
    // 400 because Stripe signature is missing, which is the *correct* gate.
    expect(res.statusCode).not.toBe(401)
  })

  it('bypasses key check on POST /webhooks/stripe/ (trailing slash)', async () => {
    // Caught a 401 in prod because the dashboard URL had a trailing slash that
    // the strict `===` rejected. Lock in the normalization so it doesn't regress.
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe/',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    })
    expect(res.statusCode).not.toBe(401)
  })

  it('bypasses key check on POST /checkout (JWT is the gate)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ product: 'monthly' }),
    })
    // No x-api-key — must not 401 from the api-key hook. Status will be 401
    // from requireAuth (no Bearer token), which is the *correct* gate.
    // Both paths return 401 so we instead assert the body shape: api-key
    // hook returns { error: 'unauthorized' } whereas requireAuth returns
    // its own JSON shape.
    const body = res.json() as { error?: string }
    expect(body.error).not.toBe('unauthorized')
  })

  it('enforces x-api-key on POST /analyze', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ image: 'data:image/png;base64,xx' }),
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'unauthorized' })
  })

  it('enforces x-api-key on GET /me', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/me' })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'unauthorized' })
  })

  it('enforces x-api-key on POST /billing-portal', async () => {
    // Unlike /checkout (called from browser, hence bypassed), /billing-portal
    // is only ever called from Electron main where the API key is available.
    // Pin the enforcement so a future "make billing-portal browser-callable"
    // attempt fails this test and forces an explicit security review.
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/billing-portal',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'unauthorized' })
  })

  it('lets request through when x-api-key matches', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { 'x-api-key': 'test-api-key' },
    })
    // Past the api-key hook — requireAuth then 401s for missing Bearer.
    // Body shape is what distinguishes which hook 401'd.
    expect(res.statusCode).toBe(401)
    const body = res.json() as { error?: string }
    expect(body.error).not.toBe('unauthorized')
  })
})
