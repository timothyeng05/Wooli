-- Run this in the Supabase SQL editor

create table public.period_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  start_date  date not null,
  end_date    date,
  flow_level  text check (flow_level in ('light', 'medium', 'heavy')),
  symptoms    text[],
  notes       text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table public.period_entries enable row level security;

create policy "Users manage own period entries"
  on public.period_entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger handle_updated_at_period
  before update on public.period_entries
  for each row execute function handle_updated_at();

create index period_entries_user_date_idx on public.period_entries (user_id, start_date desc);
