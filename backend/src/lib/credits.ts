import { supabaseAdmin } from './supabase.js'

export type CreditSource = 'free' | 'paid' | 'subscription'

export type ReserveResult =
  | { ok: true; source: CreditSource }
  | { ok: false; reason: 'no_profile' | 'no_credits' | 'daily_limit' }

export type SubscriptionStatus = 'none' | 'active' | 'expired' | 'canceled'
export type SubscriptionType = 'weekly' | 'monthly' | null

export type CreditsMeta = {
  credits_remaining: number
  daily_usage_count: number
  subscription_status: SubscriptionStatus
  subscription_type: SubscriptionType
  subscription_expires_at: string | null
}

export async function checkAndReserveCredit(userId: string): Promise<ReserveResult> {
  const { data, error } = await supabaseAdmin.rpc('reserve_credit', { p_user_id: userId })
  if (error) {
    throw new Error(`reserve_credit rpc failed: ${error.message}`)
  }
  return data as ReserveResult
}

export async function refundCredit(userId: string, source: CreditSource): Promise<void> {
  const { error } = await supabaseAdmin.rpc('refund_credit', {
    p_user_id: userId,
    p_source: source,
  })
  if (error) {
    throw new Error(`refund_credit rpc failed: ${error.message}`)
  }
}

export async function finalizeUsage(args: {
  userId: string
  source: CreditSource
  success: boolean
  questionsCount?: number
  errorType?: string
}): Promise<void> {
  const { error } = await supabaseAdmin.from('usage_logs').insert({
    user_id: args.userId,
    source: args.source,
    success: args.success,
    questions_count: args.questionsCount ?? null,
    error_type: args.errorType ?? null,
  })
  if (error) {
    throw new Error(`usage_logs insert failed: ${error.message}`)
  }
}

type ProfileRow = {
  free_credits_remaining: number
  paid_credits_balance: number
  subscription_status: SubscriptionStatus
  subscription_type: SubscriptionType
  subscription_expires_at: string | null
  daily_usage_count: number
}

export async function getCreditsMeta(userId: string): Promise<CreditsMeta | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(
      'free_credits_remaining, paid_credits_balance, subscription_status, subscription_type, subscription_expires_at, daily_usage_count',
    )
    .eq('id', userId)
    .single()

  if (error || !data) return null

  const row = data as ProfileRow

  const hasActiveSubscription =
    row.subscription_status === 'active' &&
    row.subscription_expires_at !== null &&
    new Date(row.subscription_expires_at).getTime() > Date.now()

  return {
    credits_remaining: hasActiveSubscription
      ? -1
      : row.free_credits_remaining + row.paid_credits_balance,
    daily_usage_count: row.daily_usage_count,
    subscription_status: row.subscription_status,
    subscription_type: row.subscription_type,
    subscription_expires_at: row.subscription_expires_at,
  }
}
