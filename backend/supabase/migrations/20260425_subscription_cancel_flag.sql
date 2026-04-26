-- Phase 6.3 task 7 — UX polish for "Cancels vs Renews" wording.
--
-- When a user cancels their subscription via the Stripe billing portal, the
-- default Stripe behavior is "cancel at period end": status stays 'active'
-- until the paid period elapses. Our existing schema mirrored only `status`
-- and `expires_at`, which left the UI saying "Renews May 26" even when the
-- user had explicitly cancelled — confusing.
--
-- Adding `subscription_cancel_at_period_end` so the webhook handler can
-- distinguish "active and renewing" from "active but canceling on date X",
-- and Settings can render the correct label.

alter table public.profiles
  add column if not exists subscription_cancel_at_period_end boolean not null default false;
