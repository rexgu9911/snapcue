-- SnapCue Phase 6.2 — credits system
--
-- Single source of truth for the credit/usage schema. Fully idempotent: safe
-- to run on a fresh project, on a project carrying the aborted PR 2 first
-- attempt (user_credits + half-built rpcs), or repeatedly during development.
--
-- Touches:
--   public.profiles               — per-user credit balances + subscription
--   public.usage_logs             — per-call audit trail
--   public.handle_new_user()      — trigger fn: seed profile with 5 free credits
--   public.reserve_credit(uuid)   — atomic priority debit (sub > paid > free)
--   public.refund_credit(uuid, text) — atomic refund (AI network failure path)
--   trigger on_auth_user_created on auth.users

-- ---------------------------------------------------------------------------
-- 0. Clean up legacy artifacts from the aborted PR 2 first attempt.
-- ---------------------------------------------------------------------------
-- The trigger must go before the function it references, and the legacy
-- user_credits table is replaced wholesale by profiles.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.refund_credit(uuid, text) cascade;
drop function if exists public.refund_credit(uuid) cascade;
drop function if exists public.reserve_credit(uuid) cascade;
drop table if exists public.user_credits cascade;

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                       uuid        primary key references auth.users(id) on delete cascade,
  free_credits_remaining   int         not null default 5
                                       check (free_credits_remaining >= 0),
  paid_credits_balance     int         not null default 0
                                       check (paid_credits_balance >= 0),
  subscription_status      text        not null default 'none'
                                       check (subscription_status in ('none','active','expired','canceled')),
  subscription_type        text        check (subscription_type in ('weekly','monthly')),
  subscription_expires_at  timestamptz,
  daily_usage_count        int         not null default 0
                                       check (daily_usage_count >= 0),
  daily_usage_reset_at     date        not null default (now() at time zone 'utc')::date,
  stripe_customer_id       text        unique,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. usage_logs
-- ---------------------------------------------------------------------------
create table if not exists public.usage_logs (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  source          text        not null check (source in ('free','paid','subscription')),
  questions_count int,
  success         boolean     not null,
  error_type      text
);

create index if not exists usage_logs_user_id_created_at_idx
  on public.usage_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. RLS — users read their own rows, all writes go through service_role.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.usage_logs enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "usage_logs: read own" on public.usage_logs;

create policy "profiles: read own"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "usage_logs: read own"
  on public.usage_logs
  for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. handle_new_user — seed a profile row whenever a new auth user appears.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. reserve_credit — atomic debit with priority subscription > paid > free.
--
-- Returns jsonb:
--   { ok: true,  source: 'subscription' | 'paid' | 'free' }
--   { ok: false, reason: 'no_profile' | 'no_credits' | 'daily_limit' }
--
-- Lazy daily reset happens here (the single write point for daily counters).
-- ---------------------------------------------------------------------------
create or replace function public.reserve_credit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_today   date := (now() at time zone 'utc')::date;
begin
  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  -- Lazy daily reset.
  if v_profile.daily_usage_reset_at < v_today then
    update public.profiles
       set daily_usage_count    = 0,
           daily_usage_reset_at = v_today,
           updated_at           = now()
     where id = p_user_id;
    v_profile.daily_usage_count    := 0;
    v_profile.daily_usage_reset_at := v_today;
  end if;

  -- Priority 1: active subscription.
  if v_profile.subscription_status = 'active'
     and v_profile.subscription_expires_at is not null
     and v_profile.subscription_expires_at > now() then
    if v_profile.daily_usage_count >= 50 then
      return jsonb_build_object('ok', false, 'reason', 'daily_limit');
    end if;
    update public.profiles
       set daily_usage_count = daily_usage_count + 1,
           updated_at        = now()
     where id = p_user_id;
    return jsonb_build_object('ok', true, 'source', 'subscription');
  end if;

  -- Priority 2: paid credit balance.
  if v_profile.paid_credits_balance > 0 then
    update public.profiles
       set paid_credits_balance = paid_credits_balance - 1,
           updated_at           = now()
     where id = p_user_id;
    return jsonb_build_object('ok', true, 'source', 'paid');
  end if;

  -- Priority 3: free credits.
  if v_profile.free_credits_remaining > 0 then
    update public.profiles
       set free_credits_remaining = free_credits_remaining - 1,
           updated_at             = now()
     where id = p_user_id;
    return jsonb_build_object('ok', true, 'source', 'free');
  end if;

  return jsonb_build_object('ok', false, 'reason', 'no_credits');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. refund_credit — undo a reservation when AI network/timeout failed.
--
-- subscription: decrement daily_usage_count (no credit field touched).
-- paid:         increment paid_credits_balance.
-- free:         increment free_credits_remaining.
--
-- Idempotent enough: callers are expected to call exactly once per failed
-- reservation. We do not track a "reservation id" — the contract is that the
-- backend route only refunds in the narrow window between a successful
-- reserve_credit and the AI call returning a network/timeout error.
--
-- Returns jsonb:
--   { ok: true }
--   { ok: false, reason: 'no_profile' | 'invalid_source' }
-- ---------------------------------------------------------------------------
create or replace function public.refund_credit(p_user_id uuid, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  select true into v_exists
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  case p_source
    when 'subscription' then
      update public.profiles
         set daily_usage_count = greatest(daily_usage_count - 1, 0),
             updated_at        = now()
       where id = p_user_id;
    when 'paid' then
      update public.profiles
         set paid_credits_balance = paid_credits_balance + 1,
             updated_at           = now()
       where id = p_user_id;
    when 'free' then
      update public.profiles
         set free_credits_remaining = free_credits_remaining + 1,
             updated_at             = now()
       where id = p_user_id;
    else
      return jsonb_build_object('ok', false, 'reason', 'invalid_source');
  end case;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Backfill profiles for any auth.users that pre-date this migration.
--    Each backfilled user gets the default 5 free credits via column defaults.
-- ---------------------------------------------------------------------------
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
