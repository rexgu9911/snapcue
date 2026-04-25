-- SnapCue Phase 6.3 task 4 — Stripe webhook idempotency
--
-- Single-table dedup keyed on Stripe event.id. The webhook handler attempts
-- `insert ... on conflict do nothing` on entry; if no row was inserted the
-- event has already been processed and the handler returns 200 immediately.
--
-- We persist the full payload as jsonb for forensic value (replaying a
-- subscription's history, debugging out-of-order events) — Stripe payloads
-- are small and storage is cheap.

create table if not exists public.webhook_events (
  id          text        primary key,             -- Stripe event.id (evt_...)
  type        text        not null,                -- e.g. 'checkout.session.completed'
  received_at timestamptz not null default now(),
  payload     jsonb       not null
);

create index if not exists webhook_events_type_received_at_idx
  on public.webhook_events (type, received_at desc);

-- RLS: nobody reads this except service_role. No policies = locked down.
alter table public.webhook_events enable row level security;
