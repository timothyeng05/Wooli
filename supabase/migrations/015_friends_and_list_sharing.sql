-- Run in Supabase SQL editor

-- ── Profiles: add email for friend lookup / display ────────────────────────
alter table public.profiles
  add column if not exists email text;

-- Backfill from auth.users for existing accounts
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id;

-- Keep email in sync for new signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Allow reading friend profiles once friendship is accepted
create policy "Users see friend profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = public.profiles.id)
          or (f.addressee_id = auth.uid() and f.requester_id = public.profiles.id)
        )
    )
  );

-- ── Friendships ────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete cascade not null,
  addressee_id uuid references auth.users(id) on delete cascade not null,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'rejected')),
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table public.friendships enable row level security;

create policy "Users see own friendships"
  on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "Users send friend requests"
  on public.friendships for insert
  with check (requester_id = auth.uid());

create policy "Addressee updates status"
  on public.friendships for update
  using (addressee_id = auth.uid());

create policy "Either party deletes friendship"
  on public.friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create index if not exists friendships_requester_idx on public.friendships (requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);

create trigger handle_updated_at_friendships
  before update on public.friendships
  for each row execute function handle_updated_at();

-- ── List shares ────────────────────────────────────────────────────────────
create table if not exists public.list_shares (
  id                  uuid primary key default gen_random_uuid(),
  list_id             uuid references public.lists(id) on delete cascade not null,
  shared_by_user_id   uuid references auth.users(id) on delete cascade not null,
  shared_with_user_id uuid references auth.users(id) on delete cascade not null,
  can_edit            boolean default false not null,
  created_at          timestamptz default now() not null,
  unique (list_id, shared_with_user_id),
  check (shared_by_user_id <> shared_with_user_id)
);

alter table public.list_shares enable row level security;

create policy "List owners manage shares"
  on public.list_shares for all
  using (shared_by_user_id = auth.uid())
  with check (shared_by_user_id = auth.uid());

create policy "Shared-with users see own shares"
  on public.list_shares for select
  using (shared_with_user_id = auth.uid());

create index if not exists list_shares_list_idx on public.list_shares (list_id);
create index if not exists list_shares_with_idx on public.list_shares (shared_with_user_id);

-- ── Lists RLS: split "all" into per-operation so we can add a shared-select ─
drop policy if exists "Users manage own lists" on public.lists;

create policy "Owners select own lists"
  on public.lists for select
  using (user_id = auth.uid());

create policy "Owners insert lists"
  on public.lists for insert
  with check (user_id = auth.uid());

create policy "Owners update lists"
  on public.lists for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Owners delete lists"
  on public.lists for delete
  using (user_id = auth.uid());

create policy "Shared users select lists"
  on public.lists for select
  using (
    exists (
      select 1 from public.list_shares ls
      where ls.list_id = public.lists.id
        and ls.shared_with_user_id = auth.uid()
    )
  );

-- ── List items RLS: accessible by owner or shared user ─────────────────────
drop policy if exists "Users manage items in own lists" on public.list_items;

-- SELECT: owner of the list, or anyone the list is shared with
create policy "Accessible list items select"
  on public.list_items for select
  using (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
    or exists (select 1 from public.list_shares ls where ls.list_id = list_id and ls.shared_with_user_id = auth.uid())
  );

-- INSERT: must set own user_id; allowed in own list or shared-with-edit list
create policy "Accessible list items insert"
  on public.list_items for insert
  with check (
    user_id = auth.uid()
    and (
      exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
      or exists (select 1 from public.list_shares ls where ls.list_id = list_id and ls.shared_with_user_id = auth.uid() and ls.can_edit = true)
    )
  );

-- UPDATE: owner can update any item; editors can update any item (covers is_done toggling)
create policy "Accessible list items update"
  on public.list_items for update
  using (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
    or exists (select 1 from public.list_shares ls where ls.list_id = list_items.list_id and ls.shared_with_user_id = auth.uid() and ls.can_edit = true)
  );

-- DELETE: owner can delete any item; editors can delete items they added
create policy "Accessible list items delete"
  on public.list_items for delete
  using (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
    or (
      user_id = auth.uid()
      and exists (select 1 from public.list_shares ls where ls.list_id = list_items.list_id and ls.shared_with_user_id = auth.uid() and ls.can_edit = true)
    )
  );
