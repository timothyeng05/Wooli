-- Monthly budget targets per category
create table if not exists public.budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  category_id    uuid references public.categories(id) on delete cascade not null,
  month          date not null,
  target_amount  numeric(12, 2) not null default 0,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,
  unique(user_id, category_id, month)
);

alter table public.budgets enable row level security;

create policy "Users manage own budgets"
  on public.budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Per parent category: budget the group as a whole ('parent') or each sub-category ('sub')
alter table public.categories
  add column if not exists budget_level text default 'parent'
  check (budget_level in ('parent', 'sub'));
