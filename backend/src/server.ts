// env import MUST come first — it loads dotenv and validates all vars before
// any other module reaches for them. Fail-fast on misconfiguration.
import { env } from './lib/env.js'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { analyzeRoute } from './routes/analyze.js'
import { healthRoute } from './routes/health.js'
import { meRoute } from './routes/me.js'
import { stripeWebhookRoute } from './routes/stripe-webhook.js'
import { registerAuth } from './middleware/auth.js'

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB — base64 screenshots can be large
  })

  await app.register(cors, {
    origin: [/^http:\/\/localhost(:\d+)?$/],
  })

  // Anti-abuse API key (orthogonal to user auth). Skip when SNAPCUE_API_KEY
  // is unset for local dev parity.
  const snapcueApiKey = env.SNAPCUE_API_KEY
  if (snapcueApiKey) {
    app.addHook('onRequest', async (request, reply) => {
      if (request.method === 'GET' && request.url === '/health') return
      // Stripe webhooks authenticate via Stripe-Signature, not x-api-key.
      if (request.method === 'POST' && request.url === '/webhooks/stripe') return
      if (request.headers['x-api-key'] !== snapcueApiKey) {
        return reply.status(401).send({ error: 'unauthorized' })
      }
    })
  }

  // Must run before any route that uses `app.requireAuth`.
  registerAuth(app)

  app.register(analyzeRoute)
  app.register(meRoute)
  app.register(healthRoute)
  app.register(stripeWebhookRoute)

  return app
}

async function start() {
  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    console.log(`SnapCue backend listening on :${env.PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

const isTest = env.NODE_ENV === 'test' || process.env['VITEST'] !== undefined
if (!isTest) {
  start()
}
