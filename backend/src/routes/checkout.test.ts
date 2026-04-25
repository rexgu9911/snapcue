import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocking env.ts directly (instead of poking process.env) sidesteps the
// dotenv .env-shadowing trap documented in CLAUDE.md > Backend env 配置约定.
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

const {
  mockGetUser,
  mockCustomersCreate,
  mockSessionsCreate,
  mockProfileSelectSingle,
  mockProfileUpdate,
  mockProfileUpdateEq,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCustomersCreate: vi.fn(),
  mockSessionsCreate: vi.fn(),
  mockProfileSelectSingle: vi.fn(),
  mockProfileUpdate: vi.fn(),
  mockProfileUpdateEq: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockSessionsCreate } },
    // unused here but the webhook plugin (registered globally) constructs a
    // Stripe instance too; provide the surface so its signature pre-check
    // works at construction time.
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
          update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            mockProfileUpdate(payload)
            return { eq: mockProfileUpdateEq }
          }),
        }
      }
      // webhook_events / usage_logs untouched in checkout tests.
      return {}
    }),
  },
}))

import { buildApp } from '../server.js'

function authedRequest(body: unknown) {
  return {
    method: 'POST' as const,
    url: '/checkout',
    headers: {
      authorization: 'Bearer fake-jwt',
      'content-type': 'application/json',
    },
    payload: JSON.stringify(body),
  }
}

describe('POST /checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProfileUpdateEq.mockResolvedValue({ error: null })
    // requireAuth uses supabase.auth.getUser; default to a valid user.
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-aaa', email: 'aaa@example.com' } },
      error: null,
    })
  })

  it('returns 401 when Authorization header is missing', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ product: 'monthly' }),
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'auth_required' })
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('returns 400 when product is invalid', async () => {
    const app = await buildApp()
    const res = await app.inject(authedRequest({ product: 'forever' }))
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: 'invalid_product' })
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('returns 400 when product is missing', async () => {
    const app = await buildApp()
    const res = await app.inject(authedRequest({}))
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: 'invalid_product' })
  })

  it('happy path: existing customer + pack_30 (payment mode, no subscription_data)', async () => {
    mockProfileSelectSingle.mockResolvedValueOnce({
      data: { stripe_customer_id: 'cus_existing' },
      error: null,
    })
    mockSessionsCreate.mockResolvedValueOnce({
      id: 'cs_test_pack',
      url: 'https://checkout.stripe.com/pay/cs_test_pack',
    })

    const app = await buildApp()
    const res = await app.inject(authedRequest({ product: 'pack_30' }))

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ url: 'https://checkout.stripe.com/pay/cs_test_pack' })

    // No customer creation, no profile writeback.
    expect(mockCustomersCreate).not.toHaveBeenCalled()
    expect(mockProfileUpdate).not.toHaveBeenCalled()

    // Session was created with correct shape.
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1)
    const args = mockSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(args).toMatchObject({
      customer: 'cus_existing',
      mode: 'payment',
      line_items: [{ price: 'price_pack30_fake', quantity: 1 }],
      metadata: { user_id: 'user-aaa', product: 'pack_30' },
    })
    // Payment mode must NOT include subscription_data.
    expect(args).not.toHaveProperty('subscription_data')
  })

  it('happy path: no customer + monthly subscription (creates customer, writes back, includes subscription_data.metadata)', async () => {
    mockProfileSelectSingle.mockResolvedValueOnce({
      data: { stripe_customer_id: null },
      error: null,
    })
    mockCustomersCreate.mockResolvedValueOnce({ id: 'cus_new' })
    mockSessionsCreate.mockResolvedValueOnce({
      id: 'cs_test_sub',
      url: 'https://checkout.stripe.com/pay/cs_test_sub',
    })

    const app = await buildApp()
    const res = await app.inject(authedRequest({ product: 'monthly' }))

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ url: 'https://checkout.stripe.com/pay/cs_test_sub' })

    // Customer was created with email + user_id metadata + idempotency key.
    expect(mockCustomersCreate).toHaveBeenCalledTimes(1)
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'aaa@example.com',
        metadata: { user_id: 'user-aaa' },
      }),
      expect.objectContaining({ idempotencyKey: 'customer-create-user-aaa' }),
    )

    // Profile was patched with the new customer id.
    expect(mockProfileUpdate).toHaveBeenCalledTimes(1)
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_customer_id: 'cus_new' }),
    )

    // Session created in subscription mode + carries subscription_data.metadata.
    const args = mockSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(args).toMatchObject({
      customer: 'cus_new',
      mode: 'subscription',
      line_items: [{ price: 'price_monthly_fake', quantity: 1 }],
      metadata: { user_id: 'user-aaa', product: 'monthly' },
      subscription_data: { metadata: { user_id: 'user-aaa' } },
    })
  })

  it('returns 500 if stripe.customers.create throws', async () => {
    mockProfileSelectSingle.mockResolvedValueOnce({
      data: { stripe_customer_id: null },
      error: null,
    })
    mockCustomersCreate.mockRejectedValueOnce(new Error('stripe down'))

    const app = await buildApp()
    const res = await app.inject(authedRequest({ product: 'weekly' }))
    expect(res.statusCode).toBe(500)
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })
})
