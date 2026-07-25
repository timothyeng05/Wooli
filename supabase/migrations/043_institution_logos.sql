-- Centralized, per-institution custom logos (uploaded photo, not a pasted
-- URL) — one logo per institution name, reused across every account under
-- that institution instead of being set per-account.

create table if not exists public.institution_logos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  institution_name text not null,
  logo_url         text not null,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null,
  unique (user_id, institution_name)
);

alter table public.institution_logos enable row level security;

create policy "Users manage own institution logos"
  on public.institution_logos for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger handle_updated_at_institution_logos
  before update on public.institution_logos
  for each row execute function handle_updated_at();

-- Storage bucket for the uploaded logo images. Public read (logos aren't
-- sensitive) so <img> tags can load them directly; writes are restricted to
-- the owning user via the policies below.
insert into storage.buckets (id, name, public)
values ('institution-logos', 'institution-logos', true)
on conflict (id) do nothing;

create policy "Anyone can view institution logos"
  on storage.objects for select
  using (bucket_id = 'institution-logos');

create policy "Users upload own institution logos"
  on storage.objects for insert
  with check (bucket_id = 'institution-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own institution logos"
  on storage.objects for update
  using (bucket_id = 'institution-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own institution logos"
  on storage.objects for delete
  using (bucket_id = 'institution-logos' and (storage.foldername(name))[1] = auth.uid()::text);
