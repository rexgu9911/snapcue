import type { FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'
import { env } from '../lib/env.js'
import { supabaseAdmin } from '../lib/supabase.js'

// Stripe Checkout session creator.
//
// Flow:
//   1. requireAuth → user.id (and email when present)
//   2. Validate product code from body
//   3. Lookup profile.stripe_customer_id
//   4. If no customer, stripe.customers.create + writeback to profile
//      (writeback failures are logged but non-fatal — the webhook performs
//      the same writeback on checkout.session.completed as a safety net)
//   5. stripe.checkout.sessions.create with metadata.user_id + metadata.product
//      (subscription mode also injects subscription_data.metadata.user_id so
//      future subscription.* events can be mapped back to the profile)
//   6. Return { url } for the client to openExternal()

type ProductCode = 'weekly' | 'monthly' | 'pack_30' | 'pack_100'

interface CheckoutBody {
  product?: string
}

const SUCCESS_URL =
  'https://snapcue.io/checkout-success?session_id={CHECKOUT_SESSION_ID}'
const CANCEL_URL = 'https://snapcue.io/checkout-cancel'

function isProductCode(s: string | undefined): s is ProductCode {
  return s === 'weekly' || s === 'monthly' || s === 'pack_30' || s === 'pack_100'
}

function productConfig(p: ProductCode): {
  mode: 'subscription' | 'payment'
  priceId: string | undefined
} {
  switch (p) {
    case 'weekly':
      return { mode: 'subscription', priceId: env.STRIPE_PRICE_WEEKLY }
    case 'monthly':
      return { mode: 'subscription', priceId: env.STRIPE_PRICE_MONTHLY }
    case 'pack_30':
      return { mode: 'payment', priceId: env.STRIPE_PRICE_PACK_30 }
    case 'pack_100':
      return { mode: 'payment', priceId: env.STRIPE_PRICE_PACK_100 }
  }
}

export const checkoutRoute: FastifyPluginAsync = async (fastify) => {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY)

  fastify.post<{ Body: CheckoutBody }>(
    '/checkout',
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = request.user
      if (!user) {
        // Defensive: requireAuth should have already returned 401.
        return reply.code(401).send({ error: 'auth_required' })
      }

      const product = request.body?.product
      if (!isProductCode(product)) {
        return reply.code(400).send({
          error: 'invalid_product',
          message: 'product must be one of: weekly, monthly, pack_30, pack_100',
        })
      }

      const config = productConfig(product)
      if (!config.priceId) {
        // Unreachable post-tightening (env.ts now requires STRIPE_PRICE_*).
        // Kept as a typed guard.
        fastify.log.error({ product }, 'STRIPE_PRICE_* not configured')
        return reply.code(500).send({ error: 'pricing not configured' })
      }

      // 3. Lookup profile.
      const { data: profile, error: lookupErr } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()
      if (lookupErr || !profile) {
        fastify.log.error(
          { err: lookupErr, userId: user.id },
          'profile lookup failed',
        )
        return reply.code(500).send({ error: 'profile lookup failed' })
      }

      let customerId = (profile as { stripe_customer_id: string | null }).stripe_customer_id

      // 4. Create Stripe customer if missing.
      if (!customerId) {
        try {
          const customer = await stripe.customers.create(
            {
              ...(user.email ? { email: user.email } : {}),
              metadata: { user_id: user.id },
            },
            // Idempotency: a double-click won't create two customers for the
            // same user. Stripe returns the original on retry.
            { idempotencyKey: `customer-create-${user.id}` },
          )
          customerId = customer.id
        } catch (err) {
          fastify.log.error(
            { err, userId: user.id },
            'stripe.customers.create failed',
          )
          return reply.code(500).send({ error: 'customer creation failed' })
        }

        const { error: writebackErr } = await supabaseAdmin
          .from('profiles')
          .update({
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        if (writebackErr) {
          // Non-fatal: the webhook checkout.session.completed handler also
          // writes stripe_customer_id back as a safety net. Log + continue.
          fastify.log.error(
            { err: writebackErr, userId: user.id, customerId },
            'stripe_customer_id writeback failed; webhook will retry',
          )
        }
      }

      // 5. Create checkout session.
      let session: Stripe.Checkout.Session
      try {
        session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: config.mode,
          line_items: [{ price: config.priceId, quantity: 1 }],
          metadata: { user_id: user.id, product },
          ...(config.mode === 'subscription'
            ? { subscription_data: { metadata: { user_id: user.id } } }
            : {}),
          success_url: SUCCESS_URL,
          cancel_url: CANCEL_URL,
        })
      } catch (err) {
        fastify.log.error(
          { err, userId: user.id, product },
          'stripe.checkout.sessions.create failed',
        )
        return reply.code(500).send({ error: 'checkout creation failed' })
      }

      if (!session.url) {
        fastify.log.error({ sessionId: session.id }, 'session.url missing')
        return reply.code(500).send({ error: 'checkout url missing' })
      }

      return reply.code(200).send({ url: session.url })
    },
  )
}
