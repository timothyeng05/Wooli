create table if not exists forecast_income_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  owner text,
  monthly_amount numeric not null default 0,
  growth_type text not null default 'flat',
  growth_rate numeric not null default 3,
  yearly_amounts jsonb not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table forecast_income_streams enable row level security;
create policy "Users manage own income streams"
  on forecast_income_streams for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists forecast_settings (
  user_id uuid primary key references auth.users,
  expense_monthly numeric not null default 0,
  expense_growth_rate numeric not null default 3,
  investment_growth_rate numeric not null default 7,
  updated_at timestamptz not null default now()
);
alter table forecast_settings enable row level security;
create policy "Users manage own forecast settings"
  on forecast_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
