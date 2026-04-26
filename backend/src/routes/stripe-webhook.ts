import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'
import { env } from '../lib/env.js'
import { supabaseAdmin } from '../lib/supabase.js'

// Stripe webhook receiver.
//
// Idempotency model:
//   1. On entry we attempt `insert ... on conflict do nothing` into
//      public.webhook_events keyed on Stripe event.id.
//   2. If 0 rows were inserted, the event has already been processed — we ack
//      with 200 and return immediately.
//   3. Otherwise we run the per-type handler, then return 200.
//
// Trade-off: if a handler throws *after* the row is committed, the row stays
// and Stripe's "Resend webhook" from the dashboard will hit our dedup and
// short-circuit. Recovery path: delete the webhook_events row, then resend.
// This is an explicit choice — the alternative (delete row on handler failure)
// has a worse race where partial DB writes can be replayed and double-applied.
// Handlers SHOULD aim to be idempotent on their own where possible.

type ProductCode = 'weekly' | 'monthly' | 'pack_30' | 'pack_100'

const PACK_CREDITS: Record<'pack_30' | 'pack_100', number> = {
  pack_30: 30,
  pack_100: 100,
}

function parseProduct(raw: string | undefined): ProductCode | null {
  if (raw === 'weekly' || raw === 'monthly' || raw === 'pack_30' || raw === 'pack_100') {
    return raw
  }
  return null
}

// Map Stripe subscription.status → our profiles.subscription_status enum.
// Anything that grants access maps to 'active'; anything terminal-but-restorable
// maps to 'expired'; explicit cancellation → 'canceled'.
function mapSubscriptionStatus(s: Stripe.Subscription.Status): 'active' | 'expired' | 'canceled' {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'canceled':
      return 'canceled'
    default:
      // past_due / unpaid / incomplete / incomplete_expired / paused
      return 'expired'
  }
}

function priceIdToType(priceId: string | undefined): 'weekly' | 'monthly' | null {
  if (!priceId) return null
  if (priceId === env.STRIPE_PRICE_WEEKLY) return 'weekly'
  if (priceId === env.STRIPE_PRICE_MONTHLY) return 'monthly'
  return null
}

function customerIdOf(
  ref: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (typeof ref === 'string') return ref
  if (ref && 'id' in ref) return ref.id
  return null
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  log: FastifyBaseLogger,
): Promise<void> {
  const userId = session.metadata?.['user_id']
  const product = parseProduct(session.metadata?.['product'])
  const customerId = customerIdOf(session.customer)

  if (!userId) {
    log.error({ sessionId: session.id }, 'checkout.session.completed missing metadata.user_id')
    return
  }
  if (!product) {
    log.error(
      { sessionId: session.id, raw: session.metadata?.['product'] },
      'checkout.session.completed missing or invalid metadata.product',
    )
    return
  }

  // Always writeback stripe_customer_id (so future subscription.* events can
  // locate the profile by customer_id). updated_at touched explicitly because
  // we are not going through an RPC.
  if (customerId) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) {
      throw new Error(`profile customer_id writeback failed: ${error.message}`)
    }
  }

  // Subscription products are settled by customer.subscription.updated — the
  // status / period_end live on the subscription object, not the session.
  if (product === 'weekly' || product === 'monthly') {
    log.info(
      { userId, product, sessionId: session.id },
      'checkout.session.completed for subscription — deferring to subscription.updated',
    )
    return
  }

  // Credit packs: increment paid_credits_balance. Re-application is prevented
  // by the webhook_events dedup at the route entry — we never get here twice
  // for the same event.id.
  const credits = PACK_CREDITS[product]
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('paid_credits_balance')
    .eq('id', userId)
    .single()
  if (error || !data) {
    throw new Error(`profile lookup for credit pack failed: ${error?.message ?? 'no row'}`)
  }
  const next = (data as { paid_credits_balance: number }).paid_credits_balance + credits
  const { error: updErr } = await supabaseAdmin
    .from('profiles')
    .update({ paid_credits_balance: next, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (updErr) {
    throw new Error(`paid_credits increment failed: ${updErr.message}`)
  }

  log.info(
    { userId, product, credits, newBalance: next, sessionId: session.id },
    'credit pack applied',
  )
}

async function findProfileIdForSubscription(
  sub: Stripe.Subscription,
  log: FastifyBaseLogger,
): Promise<string | null> {
  const customerId = customerIdOf(sub.customer)
  if (customerId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (error) {
      throw new Error(`profile lookup by customer_id failed: ${error.message}`)
    }
    if (data) return (data as { id: string }).id
  }

  // Fallback: subscription metadata.user_id (set by checkout via
  // subscription_data.metadata in task 6).
  const fallbackUserId = sub.metadata?.['user_id']
  if (fallbackUserId) {
    log.warn(
      { subscriptionId: sub.id, customerId, fallbackUserId },
      'profile not found by customer_id — falling back to subscription metadata',
    )
    return fallbackUserId
  }

  log.error(
    { subscriptionId: sub.id, customerId },
    'cannot map subscription to profile — neither customer_id nor metadata matched',
  )
  return null
}

async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  log: FastifyBaseLogger,
): Promise<void> {
  const profileId = await findProfileIdForSubscription(sub, log)
  if (!profileId) return

  const status = mapSubscriptionStatus(sub.status)
  const firstItem = sub.items.data[0]
  const priceId = firstItem?.price.id
  const subType = priceIdToType(priceId)
  if (!subType) {
    log.warn(
      { subscriptionId: sub.id, priceId },
      'subscription price did not match STRIPE_PRICE_WEEKLY/MONTHLY — type left untouched',
    )
  }
  // current_period_end lives on the subscription item in Stripe API 2025+.
  // For our single-item subscriptions the first item's value is authoritative.
  const periodEnd = firstItem?.current_period_end
  const expiresAt = typeof periodEnd === 'number' ? new Date(periodEnd * 1000).toISOString() : null

  const patch: Record<string, unknown> = {
    subscription_status: status,
    subscription_expires_at: expiresAt,
    // sub.cancel_at_period_end flips to true when the user cancels via
    // billing portal, false when they re-activate. Mirror it so the UI
    // can render "Cancels MMM dd" instead of "Renews MMM dd".
    subscription_cancel_at_period_end: sub.cancel_at_period_end === true,
    updated_at: new Date().toISOString(),
  }
  if (subType) patch['subscription_type'] = subType

  const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', profileId)
  if (error) {
    throw new Error(`subscription_updated patch failed: ${error.message}`)
  }

  log.info(
    { profileId, subscriptionId: sub.id, status, subType, expiresAt },
    'subscription state synced',
  )
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  log: FastifyBaseLogger,
): Promise<void> {
  const profileId = await findProfileIdForSubscription(sub, log)
  if (!profileId) return

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      // Period has elapsed — there's no future "cancels on" date to show.
      // Reset the flag so the UI doesn't carry stale "Cancels …" wording
      // after the sub is fully gone.
      subscription_cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
  if (error) {
    throw new Error(`subscription_deleted patch failed: ${error.message}`)
  }

  log.info({ profileId, subscriptionId: sub.id }, 'subscription canceled')
}

export const stripeWebhookRoute: FastifyPluginAsync = async (fastify) => {
  // Stripe signature verification needs the raw request bytes; the default
  // Fastify JSON parser would consume them. Override with a buffer parser
  // scoped to this encapsulated plugin only — other routes keep JSON parsing.
  fastify.removeContentTypeParser('application/json')
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) =>
    done(null, body),
  )

  const stripe = new Stripe(env.STRIPE_SECRET_KEY)
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET

  fastify.post('/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature']
    if (typeof signature !== 'string' || signature.length === 0) {
      return reply.status(400).send({ error: 'missing stripe-signature header' })
    }

    const rawBody = request.body as Buffer
    if (!Buffer.isBuffer(rawBody)) {
      return reply.status(400).send({ error: 'expected raw body' })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      fastify.log.warn({ msg }, 'stripe webhook signature verification failed')
      return reply.status(400).send({ error: `signature verification failed: ${msg}` })
    }

    // Dedup: insert event.id; ignoreDuplicates returns 0 rows when conflict.
    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from('webhook_events')
      .upsert(
        {
          id: event.id,
          type: event.type,
          payload: event as unknown as Record<string, unknown>,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      .select('id')

    if (insertError) {
      fastify.log.error({ err: insertError, eventId: event.id }, 'webhook_events insert failed')
      return reply.status(500).send({ error: 'webhook persistence failed' })
    }

    if (!insertedRows || insertedRows.length === 0) {
      fastify.log.info(
        { eventId: event.id, type: event.type },
        'stripe webhook duplicate, skipping',
      )
      return reply.status(200).send({ ok: true, deduped: true })
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, fastify.log)
          break
        // Stripe fires `created` on first subscription activation (via Checkout)
        // and `updated` on subsequent state changes (renewal, plan change, etc).
        // Payload shape is identical — both deliver a Stripe.Subscription — and
        // our handler is fully data-driven (status / price / period_end), so we
        // route both to the same code path. Missing the `created` case was the
        // bug that left subscription_status='none' after first checkout.
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, fastify.log)
          break
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, fastify.log)
          break
        default:
          fastify.log.info(
            { type: event.type, eventId: event.id },
            'stripe webhook event type ignored',
          )
      }
    } catch (err) {
      // Handler exception. The webhook_events row is already committed; Stripe
      // will give up after its retry window. Manual recovery: inspect logs +
      // delete the row + resend from dashboard.
      fastify.log.error({ err, eventId: event.id }, 'stripe webhook handler threw')
      return reply.status(500).send({ error: 'handler failed' })
    }

    return reply.status(200).send({ ok: true })
  })
}
