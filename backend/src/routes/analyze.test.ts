import { describe, it, expect, vi, beforeEach } from 'vitest'

// Env must be populated before any module that reads it at import time.
process.env['OPENAI_API_KEY'] = 'sk-test-key'
process.env['SUPABASE_URL'] = 'https://test.supabase.co'
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key'

const {
  mockOpenAICreate,
  mockGetUser,
  mockRpc,
  mockProfileSingle,
  mockUsageLogsInsert,
} = vi.hoisted(() => ({
  mockOpenAICreate: vi.fn(),
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
  mockProfileSingle: vi.fn(),
  mockUsageLogsInsert: vi.fn(),
}))

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  })),
}))

vi.mock('../lib/supabase.js', () => ({
  supabaseAdmin: {
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockProfileSingle }),
          }),
        }
      }
      if (table === 'usage_logs') {
        return { insert: mockUsageLogsInsert }
      }
      return {}
    }),
  },
}))

import { buildApp } from '../server.js'

describe('POST /analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { image: 'iVBORw0KGgo=' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'auth_required' })
  })

  it('reserves credit, calls AI, returns answers + meta on happy path', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
    mockRpc.mockResolvedValueOnce({ data: { ok: true, source: 'free' }, error: null })
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { q: 1, answer: 'B', confidence: 'high', reason: 'because B' },
            ]),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    })
    mockUsageLogsInsert.mockResolvedValue({ error: null })
    mockProfileSingle.mockResolvedValue({
      data: {
        free_credits_remaining: 4,
        paid_credits_balance: 0,
        subscription_status: 'none',
        subscription_type: null,
        subscription_expires_at: null,
        daily_usage_count: 0,
      },
      error: null,
    })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      headers: { authorization: 'Bearer fake-jwt' },
      payload: { image: 'iVBORw0KGgoAAAANSUhEUg==' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.answers).toHaveLength(1)
    expect(body.meta).toMatchObject({
      credits_remaining: 4,
      subscription_status: 'none',
      source: 'free',
    })
    expect(mockRpc).toHaveBeenCalledWith('reserve_credit', { p_user_id: 'user-123' })
    expect(mockUsageLogsInsert).toHaveBeenCalled()
  })

  it('returns 402 when reserve_credit reports no_credits', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-456', email: 'out@example.com' } },
      error: null,
    })
    mockRpc.mockResolvedValueOnce({ data: { ok: false, reason: 'no_credits' }, error: null })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      headers: { authorization: 'Bearer fake-jwt' },
      payload: { image: 'iVBORw0KGgo=' },
    })

    expect(res.statusCode).toBe(402)
    expect(res.json()).toEqual({ error: 'no_credits' })
    expect(mockOpenAICreate).not.toHaveBeenCalled()
  })

  it('refunds credit when OpenAI call throws network error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-789', email: 'net@example.com' } },
      error: null,
    })
    mockRpc
      .mockResolvedValueOnce({ data: { ok: true, source: 'free' }, error: null })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
    mockOpenAICreate.mockRejectedValueOnce(new Error('ETIMEDOUT'))

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      headers: { authorization: 'Bearer fake-jwt' },
      payload: { image: 'iVBORw0KGgo=' },
    })

    expect(res.statusCode).toBe(504)
    expect(res.json()).toMatchObject({ error: 'ai_unavailable' })
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'refund_credit', {
      p_user_id: 'user-789',
      p_source: 'free',
    })
  })
})
