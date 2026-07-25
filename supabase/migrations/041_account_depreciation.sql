-- Straight-line depreciation for the new 'vehicle' account type (e.g. a car):
-- value declines linearly from purchase_price to residual_value over
-- depreciation_months, starting at purchase_date. current_balance is kept in
-- sync by recomputing on every accounts-page visit and in the daily cron, so
-- other features (Goals, Forecast) that read current_balance directly stay
-- accurate without knowing about depreciation. Gated on type = 'vehicle'
-- rather than a separate enabled flag — the type itself implies the behavior.

alter table public.accounts add column if not exists purchase_price numeric;
alter table public.accounts add column if not exists purchase_date date;
alter table public.accounts add column if not exists depreciation_months integer;
alter table public.accounts add column if not exists residual_value numeric not null default 0;

-- accounts.type had a check constraint (from migration 014) that didn't
-- include 'vehicle' — inserts fail at the DB level even with correct app
-- code until this is widened.
alter table public.accounts drop constraint if exists accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('checking', 'savings', 'credit', 'investment', 'cash', 'loan', 'other', 'vehicle'));
