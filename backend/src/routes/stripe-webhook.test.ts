import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocking env.ts directly (instead of poking process.env) sidesteps two traps:
//   1. dotenv loads backend/.env before env.ts validates, and won't overwrite
//      already-set process.env vars — so a real STRIPE_PRICE_MONTHLY in .env
//      would mask a test override and break price-id matching.
//   2. ESM imports are hoisted; top-level process.env assignments may run
//      after env.ts has already parsed.
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
    STRIPE_PRICE_PACK_30: undefined,
    STRIPE_PRICE_PACK_100: undefined,
  },
}))

const {
  mockConstructEvent,
  mockUpsertSelect,
  mockProfileSelectChain,
  mockProfileSingle,
  mockProfileMaybeSingle,
  mockProfileUpdate,
  mockProfileUpdateEq,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockUpsertSelect: vi.fn(),
  mockProfileSelectChain: vi.fn(),
  mockProfileSingle: vi.fn(),
  mockProfileMaybeSingle: vi.fn(),
  mockProfileUpdate: vi.fn(),
  mockProfileUpdateEq: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}))

vi.mock('../lib/supabase.js', () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() }, // unused here but keeps the shape
    rpc: vi.fn(),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'webhook_events') {
        return {
          upsert: vi.fn().mockReturnValue({ select: mockUpsertSelect }),
        }
      }
      if (table === 'profiles') {
        // We expose update as a captured fn so we can assert payloads;
        // its return shape mimics the real client (.eq() ⟶ awaited result).
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            mockProfileSelectChain(cols)
            return {
              eq: vi.fn().mockReturnValue({
                single: mockProfileSingle,
                maybeSingle: mockProfileMaybeSingle,
              }),
            }
          }),
          update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            mockProfileUpdate(payload)
            return { eq: mockProfileUpdateEq }
          }),
        }
      }
      return {}
    }),
  },
}))

import { buildApp } from '../server.js'

// Helper: build a Fastify-injectable webhook request. Body content is
// irrelevant because constructEvent is mocked to return a hand-built event.
// Pass `signature: null` to omit the header entirely (testing the missing-sig
// path). Plain `undefined` would trigger the default — common JS gotcha.
function injectArgs(body = '{}', signature: string | null = 't=1,v1=fake') {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signature !== null) headers['stripe-signature'] = signature
  return {
    method: 'POST' as const,
    url: '/webhooks/stripe',
    headers,
    payload: body,
  }
}

describe('POST /webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: webhook_events upsert succeeds (1 row inserted = first time).
    mockUpsertSelect.mockResolvedValue({ data: [{ id: 'evt_default' }], error: null })
    // Default: profile update success.
    mockProfileUpdateEq.mockResolvedValue({ error: null })
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const app = await buildApp()
    const res = await app.inject(injectArgs('{}', null))
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'missing stripe-signature header' })
    expect(mockConstructEvent).not.toHaveBeenCalled()
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature')
    })
    const app = await buildApp()
    const res = await app.inject(injectArgs())
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/signature verification failed/)
    expect(mockUpsertSelect).not.toHaveBeenCalled()
  })

  it('applies a credit pack on checkout.session.completed (happy path)', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_pack_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_pack',
          customer: 'cus_test_123',
          metadata: { user_id: 'user-aaa', product: 'pack_30' },
        },
      },
    })
    // profile select for paid_credits_balance
    mockProfileSingle.mockResolvedValueOnce({
      data: { paid_credits_balance: 7 },
      error: null,
    })

    const app = await buildApp()
    const res = await app.inject(injectArgs())

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })

    // Two profile updates: (1) writeback stripe_customer_id, (2) credit pack increment.
    expect(mockProfileUpdate).toHaveBeenCalledTimes(2)
    expect(mockProfileUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ stripe_customer_id: 'cus_test_123' }),
    )
    expect(mockProfileUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ paid_credits_balance: 7 + 30 }),
    )
  })

  it('short-circuits on duplicate event (idempotency)', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_dup_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_dup',
          customer: 'cus_test_123',
          metadata: { user_id: 'user-aaa', product: 'pack_30' },
        },
      },
    })
    // upsert returns empty array → already processed
    mockUpsertSelect.mockResolvedValueOnce({ data: [], error: null })

    const app = await buildApp()
    const res = await app.inject(injectArgs())

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, deduped: true })

    // Handler must NOT have run — no profile reads or writes.
    expect(mockProfileSingle).not.toHaveBeenCalled()
    expect(mockProfileUpdate).not.toHaveBeenCalled()
  })

  it('syncs profile on customer.subscription.updated', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_sub_upd_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_1',
          customer: 'cus_test_123',
          status: 'active',
          cancel_at_period_end: false,
          metadata: {},
          items: {
            data: [
              {
                id: 'si_test_1',
                price: { id: 'price_monthly_fake' },
                current_period_end: 1_800_000_000, // 2027-01-15
              },
            ],
          },
        },
      },
    })
    // profile lookup by stripe_customer_id (maybeSingle path)
    mockProfileMaybeSingle.mockResolvedValueOnce({
      data: { id: 'user-aaa' },
      error: null,
    })

    const app = await buildApp()
    const res = await app.inject(injectArgs())

    expect(res.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledTimes(1)
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: 'active',
        subscription_type: 'monthly',
        subscription_expires_at: new Date(1_800_000_000 * 1000).toISOString(),
        subscription_cancel_at_period_end: false,
      }),
    )
  })

  it('records cancel_at_period_end when user cancels via billing portal', async () => {
    // Stripe billing portal default: cancel takes effect at period end. The
    // sub stays status='active' but cancel_at_period_end flips to true. UI
    // depends on this flag to show "Cancels MMM dd" instead of "Renews".
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_sub_cancel_at_period_end',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_3',
          customer: 'cus_test_789',
          status: 'active',
          cancel_at_period_end: true,
          metadata: {},
          items: {
            data: [
              {
                id: 'si_test_3',
                price: { id: 'price_monthly_fake' },
                current_period_end: 1_800_000_000,
              },
            ],
          },
        },
      },
    })
    mockProfileMaybeSingle.mockResolvedValueOnce({
      data: { id: 'user-ccc' },
      error: null,
    })

    const app = await buildApp()
    const res = await app.inject(injectArgs())

    expect(res.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: 'active',
        subscription_cancel_at_period_end: true,
      }),
    )
  })

  it('syncs profile on customer.subscription.created (initial activation)', async () => {
    // Stripe Checkout fires `created` (not `updated`) on first subscription
    // activation. Pin that we route both events to the same handler — without
    // this the user's plan stays 'none' after a successful Checkout.
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_sub_created_1',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_test_2',
          customer: 'cus_test_456',
          status: 'active',
          cancel_at_period_end: false,
          metadata: {},
          items: {
            data: [
              {
                id: 'si_test_2',
                price: { id: 'price_monthly_fake' },
                current_period_end: 1_800_000_000,
              },
            ],
          },
        },
      },
    })
    mockProfileMaybeSingle.mockResolvedValueOnce({
      data: { id: 'user-bbb' },
      error: null,
    })

    const app = await buildApp()
    const res = await app.inject(injectArgs())

    expect(res.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledTimes(1)
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: 'active',
        subscription_type: 'monthly',
      }),
    )
  })

  it('marks subscription canceled on customer.subscription.deleted', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_sub_del_1',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test_2',
          customer: 'cus_test_123',
          status: 'canceled',
          metadata: {},
          items: { data: [] },
        },
      },
    })
    mockProfileMaybeSingle.mockResolvedValueOnce({
      data: { id: 'user-aaa' },
      error: null,
    })

    const app = await buildApp()
    const res = await app.inject(injectArgs())

    expect(res.statusCode).toBe(200)
    expect(mockProfileUpdate).toHaveBeenCalledTimes(1)
    const patch = mockProfileUpdate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch['subscription_status']).toBe('canceled')
    // Period elapsed — clear the cancel_at_period_end flag so stale
    // "Cancels MMM dd" text doesn't linger on the Free plan UI.
    expect(patch['subscription_cancel_at_period_end']).toBe(false)
    // Must not touch subscription_expires_at on delete.
    expect(patch).not.toHaveProperty('subscription_expires_at')
  })
})
