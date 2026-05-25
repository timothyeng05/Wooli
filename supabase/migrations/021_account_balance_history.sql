-- Per-account daily balance history (imported from Monarch CSV export)
create table if not exists public.account_balance_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  account_name text not null,
  date         date not null,
  balance      numeric(14,2) not null,
  created_at   timestamptz default now() not null,
  unique(user_id, account_name, date)
);

alter table public.account_balance_history enable row level security;

create policy "Users manage own account balance history"
  on public.account_balance_history for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists account_balance_history_user_date_idx
  on public.account_balance_history (user_id, date desc);
create index if not exists account_balance_history_account_idx
  on public.account_balance_history (user_id, account_name, date desc);

-- Add is_pending to transactions (Plaid sets this; CSV imports are not pending)
alter table public.transactions
  add column if not exists is_pending boolean not null default false;
