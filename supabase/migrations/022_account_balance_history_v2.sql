-- Rebuild account_balance_history keyed on account_id (text) instead of account_name
-- Works for both Plaid account IDs (strings) and manual account UUIDs

drop table if exists public.account_balance_history;

create table public.account_balance_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  account_id   text not null,          -- plaid_accounts.account_id OR accounts.id
  account_name text not null,          -- display name (denormalized for convenience)
  date         date not null,
  balance      numeric(14,2) not null,
  created_at   timestamptz default now() not null,
  unique(user_id, account_id, date)
);

alter table public.account_balance_history enable row level security;

create policy "Users manage own account balance history"
  on public.account_balance_history for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index account_balance_history_user_date_idx
  on public.account_balance_history (user_id, date desc);
create index account_balance_history_account_idx
  on public.account_balance_history (user_id, account_id, date desc);
