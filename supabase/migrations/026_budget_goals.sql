create table if not exists budget_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  icon text,
  color text not null default '#6366f1',
  target_amount numeric not null,
  target_date date,
  current_amount numeric not null default 0,
  linked_account_ids text[] not null default '{}',
  notes text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table budget_goals enable row level security;

create policy "Users manage own goals"
  on budget_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
