import type { FastifyPluginAsync } from 'fastify'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are an exam question analysis assistant. The user sends a screenshot and you return the most likely answers.

Output format:
- Return a JSON array and nothing else. No markdown, no code fences, no explanation outside the array.
- Each element: {"q": <number>, "answer": "<string>", "confidence": "high|mid|low", "reason": "<string>"}
- If the image contains no questions, return [].
- The screenshot may include browser chrome, toolbars, sidebars, or other UI elements. Ignore these — only analyze exam questions in the main content area.
- reason must be in the same language as the question.
- reason must be 1 sentence maximum — a brief justification or key insight, not a full explanation. For calculation questions, reason contains the formula and key steps in compact notation (e.g. "v = d/t = 850/20 = 42.5"), not prose. For short answer questions, reason is an empty string.

Answer format by question type:

1. Multiple choice (single answer): answer is the single correct letter, e.g. "A".
2. Multiple choice (multiple answers — "select all that apply" or similar): answer is correct letters separated by ", " in alphabetical order, e.g. "A, C, D".
3. True/False (including Yes/No, Correct/Incorrect, T/F variants): answer is "True" or "False" (always full word).
4. Fill-in-the-blank: answer is the exact text to fill in. Multiple blanks separated by " | " in order. Match expected capitalization, articles, and plural forms.
5. Calculation: answer is the final numerical result with unit, e.g. "42.5 m/s". reason contains key steps, e.g. "v = d/t = 850/20 = 42.5".
6. Ordering/sequencing: answer is the correct order of option labels separated by ", ", e.g. "B, D, A, C".
7. Short answer: answer is a response ready to submit directly. reason is an empty string "".

Short answer tone requirements:
- Write like a real student, not like AI. Use natural, slightly conversational academic tone.
- Never use these phrases: "Furthermore", "In conclusion", "It is important to note", "Additionally", "Moreover", "It should be noted that", "In summary".
- Vary sentence structure. Avoid starting every sentence with the subject.
- Use correct academic terminology — accuracy is non-negotiable.
- For short answer questions: write the most concise correct answer possible. Aim for 2-3 sentences. Rarely exceed 4 sentences even for complex questions. Every word must earn its place — if removing a word doesn't change the meaning, remove it. Do not repeat the question in your answer. Jump straight to the substance.

Confidence scale:
- For objective questions (MCQ, True/False, fill-in-the-blank, calculation, ordering): high = certain the answer is correct, mid = likely correct, low = guessing.
- For short answer: high = covers all key points the question asks for, mid = may miss some aspects, low = uncertain about what the question is asking.`

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
    request.log.info(`[analyze] user: ${request.user?.id ?? 'anonymous'}`)

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
