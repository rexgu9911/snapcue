import type { FastifyPluginAsync } from 'fastify'
import { getCreditsMeta } from '../lib/credits.js'

export const meRoute: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: app.requireAuth }, async (request, reply) => {
    const user = request.user
    if (!user) {
      return reply.code(401).send({ error: 'auth_required' })
    }

    const meta = await getCreditsMeta(user.id)
    if (!meta) {
      return reply.code(404).send({ error: 'no_profile' })
    }

    return {
      user: { id: user.id, email: user.email },
      meta,
    }
  })
}
