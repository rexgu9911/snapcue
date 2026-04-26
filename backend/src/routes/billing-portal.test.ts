import { describe, it, expect, vi, beforeEach } from 'vitest'

// Same env-mock approach as checkout/cors/api-key tests — vi.mock the env
// module directly so our test values aren't shadowed by backend/.env via
// dotenv (the real .env's STRIPE_SECRET_KEY etc. would otherwise leak in).

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

const { mockGetUser, mockPortalCreate, mockProfileSelectSingle } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockPortalCreate: vi.fn(),
  mockProfileSelectSingle: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: mockPortalCreate } },
    webhooks: { constructEvent: vi.fn() },
  })),
}))

vi.mock('../lib/supabase.js', () => ({
  supabaseAdmin: {
    auth: { getUser: mockGetUser },
    rpc: vi.fn(),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockProfileSelectSingle }),
          }),
        }
      }
      return {}
    }),
  },
}))

import { buildApp } from '../server.js'

const authedRequest = () => ({
  method: 'POST' as const,
  url: '/billing-portal',
  headers: {
    authorization: 'Bearer fake-jwt',
    'content-type': 'application/json',
  },
  payload: '{}',
})

describe('POST /billing-portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-aaa', email: 'aaa@example.com' } },
      error: null,
    })
  })

  it('401 when missing Authorization header', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/billing-portal',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    })
    expect(res.statusCode).toBe(401)
    expect(mockPortalCreate).not.toHaveBeenCalled()
  })

  it('400 no_customer when profile has no stripe_customer_id', async () => {
    mockProfileSelectSingle.mockResolvedValue({
      data: { stripe_customer_id: null },
      error: null,
    })
    const app = await buildApp()
    const res = await app.inject(authedRequest())
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'no_customer' })
    expect(mockPortalCreate).not.toHaveBeenCalled()
  })

  it('happy path: returns Stripe portal URL', async () => {
    mockProfileSelectSingle.mockResolvedValue({
      data: { stripe_customer_id: 'cus_test_123' },
      error: null,
    })
    mockPortalCreate.mockResolvedValue({
      id: 'bps_test_1',
      url: 'https://billing.stripe.com/session/test',
    })
    const app = await buildApp()
    const res = await app.inject(authedRequest())
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ url: 'https://billing.stripe.com/session/test' })
    expect(mockPortalCreate).toHaveBeenCalledTimes(1)
    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_test_123',
        return_url: expect.stringContaining('snapcue.io'),
      }),
    )
  })

  it('500 when stripe.billingPortal.sessions.create throws', async () => {
    mockProfileSelectSingle.mockResolvedValue({
      data: { stripe_customer_id: 'cus_test_123' },
      error: null,
    })
    mockPortalCreate.mockRejectedValue(new Error('stripe down'))
    const app = await buildApp()
    const res = await app.inject(authedRequest())
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'billing portal creation failed' })
  })

  it('500 when profile lookup fails', async () => {
    mockProfileSelectSingle.mockResolvedValue({
      data: null,
      error: { message: 'db down' },
    })
    const app = await buildApp()
    const res = await app.inject(authedRequest())
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'profile lookup failed' })
    expect(mockPortalCreate).not.toHaveBeenCalled()
  })
})
