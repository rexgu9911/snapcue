import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '../lib/supabase.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null
  }
}

/**
 * Non-blocking auth middleware.
 *
 * Reads `Authorization: Bearer <jwt>` and populates `request.user`. A missing
 * or invalid header simply leaves `request.user = null` — requests still
 * continue. Routes that require auth enforce it themselves.
 */
export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('user', null)

  app.addHook('preHandler', async (request: FastifyRequest) => {
    request.user = null

    if (!supabaseAdmin) return

    const header = request.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return

    const jwt = header.slice('Bearer '.length).trim()
    if (!jwt) return

    const { data, error } = await supabaseAdmin.auth.getUser(jwt)
    if (error || !data.user) return

    request.user = data.user
  })
}
