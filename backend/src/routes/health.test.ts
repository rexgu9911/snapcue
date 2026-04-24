import { describe, it, expect, vi } from 'vitest'

process.env['OPENAI_API_KEY'] = 'sk-test-key'
process.env['SUPABASE_URL'] = 'https://test.supabase.co'
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key'

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
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

describe('GET /health', () => {
  it('returns { status: "ok" }', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
