import { describe, it, expect, vi } from 'vitest'

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
  })),
}))

process.env['OPENAI_API_KEY'] = 'sk-test-key'

import { buildApp } from '../server.js'

describe('GET /health', () => {
  it('returns { status: "ok" }', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
