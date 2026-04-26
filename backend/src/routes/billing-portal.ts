import type { FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'
import { env } from '../lib/env.js'
import { supabaseAdmin } from '../lib/supabase.js'

// Stripe Billing Portal session creator.
//
// Flow:
//   1. requireAuth → user.id
//   2. Lookup profile.stripe_customer_id. Missing customer means the user
//      has never checked out, so there is literally no portal session to
//      create — return 400 'no_customer' so the client can route them to
//      /pricing for a first purchase instead.
//   3. stripe.billingPortal.sessions.create({ customer, return_url })
//   4. Return { url } for the Electron main process to openExternal()
//
// Unlike /checkout, this route is NOT in the api-key bypass list — it's
// only ever called from Electron main, where SNAPCUE_API_KEY lives in
// the bundle. Web should never hit /billing-portal directly because the
// app is the canonical entry point for "Manage subscription"; if a future
// web /account page wants to call it, we'll add the bypass at that point.

const RETURN_URL = 'https://snapcue.io/pricing'

export const billingPortalRoute: FastifyPluginAsync = async (fastify) => {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY)

  fastify.post('/billing-portal', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.user
    if (!user) {
      return reply.code(401).send({ error: 'auth_required' })
    }

    const { data: profile, error: lookupErr } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()
    if (lookupErr || !profile) {
      fastify.log.error({ err: lookupErr, userId: user.id }, 'profile lookup failed')
      return reply.code(500).send({ error: 'profile lookup failed' })
    }

    const customerId = (profile as { stripe_customer_id: string | null }).stripe_customer_id
    if (!customerId) {
      return reply.code(400).send({ error: 'no_customer' })
    }

    let session: Stripe.BillingPortal.Session
    try {
      session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: RETURN_URL,
      })
    } catch (err) {
      fastify.log.error({ err, userId: user.id }, 'stripe.billingPortal.sessions.create failed')
      return reply.code(500).send({ error: 'billing portal creation failed' })
    }

    return reply.code(200).send({ url: session.url })
  })
}
