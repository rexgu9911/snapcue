import type { FastifyPluginAsync } from 'fastify'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are an exam question analysis assistant. The user sends a screenshot and you return the most likely answers.

Output rules:
- Return a JSON array and nothing else. No markdown, no code fences, no explanation outside the array.
- Each element: {"q": <number>, "answer": "<A|B|C|D or T|F or —>", "confidence": "high|mid|low", "reason": "<1-2 concise sentences>"}
- Multiple-choice answers must be A, B, C, or D. True/false answers must be T or F.
- For question types other than multiple choice and true/false (such as fill-in-the-blank, short answer, ordering), return answer as "—", confidence as "low", and reason explaining this question type is not supported.
- confidence: "high" if certain, "mid" if likely, "low" if guessing.
- reason: provide a concise reason in 1-2 sentences, in the same language as the question.
- The screenshot may include browser chrome, toolbars, sidebars, or other UI elements. Ignore these — only analyze exam questions in the main content area.
- If the image contains no questions, return [].`

interface AnalyzeBody {
  image: string // base64-encoded image (no data URI prefix)
}

interface AnswerItem {
  q: number
  answer: string
  confidence: 'high' | 'mid' | 'low'
  reason: string
}

export const analyzeRoute: FastifyPluginAsync = async (app) => {
  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const client = new OpenAI({ apiKey })

  app.post<{ Body: AnalyzeBody }>('/analyze', async (request, reply) => {
    const { image } = request.body

    if (!image || typeof image !== 'string') {
      return reply.status(400).send({ error: 'Missing or invalid "image" field (base64 string)' })
    }

    // Detect media type from base64 header or default to png
    const mediaType = detectMediaType(image)
    // Strip data URI prefix if present
    const rawBase64 = image.replace(/^data:image\/\w+;base64,/, '')
    const dataUri = `data:${mediaType};base64,${rawBase64}`

    const imageBytes = Buffer.from(rawBase64, 'base64').length
    request.log.info(`[analyze] image size: ${imageBytes} bytes, media: ${mediaType}`)

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-5-mini',
        max_completion_tokens: 4096,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: dataUri, detail: 'high' },
              },
              {
                type: 'text',
                text: 'Analyze the quiz questions in this image.',
              },
            ],
          },
        ],
      })

      const text = response.choices[0]?.message?.content
      request.log.info(`[analyze] AI raw response: ${text}`)

      if (!text) {
        return reply.status(502).send({ error: 'No text response from AI' })
      }

      // Parse and validate JSON
      const answers = parseAnswers(text)
      request.log.info(`[analyze] parsed ${answers.length} answers`)

      return {
        answers,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens ?? 0,
          completion_tokens: response.usage?.completion_tokens ?? 0,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      request.log.error({ err }, 'OpenAI API call failed')

      if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
        return reply.status(504).send({ error: 'AI analysis timed out' })
      }

      return reply.status(502).send({ error: `AI analysis failed: ${message}` })
    }
  })
}

function detectMediaType(base64: string): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
  if (base64.startsWith('data:image/jpeg') || base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('data:image/gif') || base64.startsWith('R0lGOD')) return 'image/gif'
  if (base64.startsWith('data:image/webp') || base64.startsWith('UklGR')) return 'image/webp'
  return 'image/png'
}

function parseAnswers(text: string): AnswerItem[] {
  // Try to extract JSON from markdown code blocks or raw text
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/)
  const jsonStr = jsonMatch ? jsonMatch[1]!.trim() : text.trim()

  const parsed: unknown = JSON.parse(jsonStr)

  if (!Array.isArray(parsed)) {
    throw new Error('Response is not a JSON array')
  }

  return parsed as AnswerItem[]
}
