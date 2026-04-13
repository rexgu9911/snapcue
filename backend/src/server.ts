import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { analyzeRoute } from './routes/analyze.js'
import { healthRoute } from './routes/health.js'

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB — base64 screenshots can be large
  })

  await app.register(cors, {
    origin: [/^http:\/\/localhost(:\d+)?$/],
  })

  app.register(analyzeRoute)
  app.register(healthRoute)

  return app
}

async function start() {
  const app = await buildApp()
  const port = Number(process.env['PORT'] ?? 3001)

  try {
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`SnapCue backend listening on :${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Only start the server when run directly (not when imported by tests)
const isTest = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] !== undefined
if (!isTest) {
  start()
}
