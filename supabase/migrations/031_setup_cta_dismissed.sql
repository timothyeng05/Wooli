-- Per-user dismissal state for the budget "Next steps" CTA.
--
-- It used to live in localStorage (browser-global), so the CTA leaked across users on
-- a shared browser and the "reset onboarding" flow re-showed it for everyone. Move it
-- to a per-user, server-side column instead.
alter table public.profiles
  add column if not exists setup_cta_dismissed jsonb not null default '{}'::jsonb;

-- Existing users aren't "new" — mark everyone who has already onboarded as fully
-- dismissed so the CTA only appears for genuinely new (or freshly-reset) accounts.
update public.profiles
  set setup_cta_dismissed = '{"goals": true, "forecast": true}'::jsonb
  where onboarding_completed_at is not null;
