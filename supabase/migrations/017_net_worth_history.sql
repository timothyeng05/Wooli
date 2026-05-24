-- Net worth history: one row per user per day
-- Auto-upserted whenever the networth page loads or Plaid balances refresh

create table public.net_worth_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  recorded_on   date not null,
  assets        numeric(14, 2) not null default 0,
  liabilities   numeric(14, 2) not null default 0,
  net_worth     numeric(14, 2) not null default 0,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null,
  unique(user_id, recorded_on)
);

alter table public.net_worth_history enable row level security;

create policy "Users manage own net worth history"
  on public.net_worth_history for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger handle_updated_at_net_worth_history
  before update on public.net_worth_history
  for each row execute function handle_updated_at();

create index net_worth_history_user_idx on public.net_worth_history (user_id, recorded_on desc);
