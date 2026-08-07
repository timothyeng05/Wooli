-- Fund-level holdings snapshots for investment accounts (401k statements etc.)
-- One row per fund per statement period; routine re-uploads of the same
-- period upsert via the unique constraint instead of duplicating.

create table public.account_holdings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  account_id        uuid references public.accounts(id) on delete cascade not null,
  fund_name         text not null,
  asset_class       text,
  current_mix_pct   numeric(6, 2),
  future_mix_pct    numeric(6, 2),
  statement_start   date,
  statement_end     date not null,
  opening_balance   numeric(14, 2),
  gains_losses      numeric(14, 2),
  other_activity    numeric(14, 2),
  closing_balance   numeric(14, 2) not null,
  units             numeric(16, 6),
  fund_price        numeric(12, 4),
  fund_return_pct   numeric(6, 2),
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null,
  unique (account_id, fund_name, statement_end)
);

alter table public.account_holdings enable row level security;

create policy "Users manage own account holdings"
  on public.account_holdings for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger handle_updated_at_account_holdings
  before update on public.account_holdings
  for each row execute function handle_updated_at();

create index account_holdings_account_idx on public.account_holdings (account_id, statement_end desc);
