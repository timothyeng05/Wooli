-- Run this in the Supabase SQL editor

create table public.weekly_summaries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  week_start   date not null,
  summary      text not null,
  created_at   timestamptz default now() not null,
  unique(user_id, week_start)
);

alter table public.weekly_summaries enable row level security;

create policy "Users manage own weekly summaries"
  on public.weekly_summaries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index weekly_summaries_user_week_idx on public.weekly_summaries (user_id, week_start desc);
