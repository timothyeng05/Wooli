-- Run this in the Supabase SQL editor

create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  description text,
  is_archived boolean default false not null,
  sort_order  int default 0,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create table public.list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid references public.lists(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  notes       text,
  url         text,
  is_done     boolean default false not null,
  sort_order  int default 0,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy "Users manage own lists"
  on public.lists for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage items in own lists"
  on public.list_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger handle_updated_at_lists
  before update on public.lists
  for each row execute function handle_updated_at();

create trigger handle_updated_at_list_items
  before update on public.list_items
  for each row execute function handle_updated_at();

create index lists_user_idx on public.lists (user_id, sort_order);
create index list_items_list_idx on public.list_items (list_id, sort_order);
