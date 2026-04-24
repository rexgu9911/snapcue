import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '../lib/supabase.js'

export type AuthUser = { id: string; email: string | null }

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''

  if (!token) {
    reply.code(401).send({ error: 'auth_required' })
    return
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    reply.code(401).send({ error: 'auth_required' })
    return
  }

  request.user = { id: data.user.id, email: data.user.email ?? null }
}

export function registerAuth(app: FastifyInstance): void {
  app.decorateRequest('user', null)
  app.decorate('requireAuth', requireAuth)
}
