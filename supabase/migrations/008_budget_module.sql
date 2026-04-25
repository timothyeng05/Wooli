-- Run this in the Supabase SQL editor

-- Categories (supports sub-categories via parent_id)
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  color      text not null default '#6366f1',
  icon       text,
  parent_id  uuid references public.categories(id) on delete cascade,
  is_income  boolean default false not null,
  sort_order int default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.categories enable row level security;

create policy "Users manage own categories"
  on public.categories for all
  using (user_id = auth.uid());

create trigger set_categories_updated_at
  before update on public.categories
  for each row execute procedure public.handle_updated_at();

-- Transactions
create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  category_id   uuid references public.categories(id) on delete set null,
  amount        numeric(12, 2) not null,
  description   text,
  merchant      text,
  transacted_at timestamptz not null,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

alter table public.transactions enable row level security;

create policy "Users manage own transactions"
  on public.transactions for all
  using (user_id = auth.uid());

create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute procedure public.handle_updated_at();
