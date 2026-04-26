-- Run this in the Supabase SQL editor

create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  type            text not null check (type in ('checking', 'savings', 'credit', 'investment', 'cash', 'loan', 'other')),
  institution     text,
  current_balance numeric(14, 2) default 0 not null,
  is_active       boolean default true not null,
  is_asset        boolean default true not null,
  notes           text,
  sort_order      int default 0,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create table public.account_balance_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  account_id    uuid references public.accounts(id) on delete cascade not null,
  balance       numeric(14, 2) not null,
  recorded_on   date not null,
  created_at    timestamptz default now() not null,
  unique(account_id, recorded_on)
);

alter table public.accounts enable row level security;
alter table public.account_balance_snapshots enable row level security;

create policy "Users manage own accounts"
  on public.accounts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own balance snapshots"
  on public.account_balance_snapshots for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger handle_updated_at_accounts
  before update on public.accounts
  for each row execute function handle_updated_at();

create index accounts_user_idx on public.accounts (user_id, is_active, sort_order);
create index balance_snapshots_account_idx on public.account_balance_snapshots (account_id, recorded_on desc);

alter table public.transactions
  add column account_id uuid references public.accounts(id) on delete set null,
  add column notes text,
  add column is_recurring boolean default false not null,
  add column recurring_id uuid;
