import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock OpenAI SDK before importing the app
vi.mock('openai', () => {
  const mockCreate = vi.fn()
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  }
})

// Set API key before importing server
process.env['OPENAI_API_KEY'] = 'sk-test-key'

import { buildApp } from '../server.js'
import * as OpenAIModule from 'openai'

const mockCreate = (OpenAIModule as unknown as { __mockCreate: ReturnType<typeof vi.fn> })
  .__mockCreate

describe('POST /analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when image is missing', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('error')
  })

  it('returns parsed answers from GPT-5 mini', async () => {
    const mockAnswers = [
      { q: 1, answer: 'B', confidence: 'high', reason: 'Explanation here' },
    ]

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(mockAnswers) } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { image: 'iVBORw0KGgoAAAANSUhEUg==' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.answers).toEqual(mockAnswers)
    expect(body.usage).toEqual({ prompt_tokens: 100, completion_tokens: 50 })
  })

  it('handles OpenAI API errors gracefully', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'))

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { image: 'iVBORw0KGgoAAAANSUhEUg==' },
    })

    expect(res.statusCode).toBe(502)
    expect(res.json().error).toContain('Rate limit exceeded')
  })
})
