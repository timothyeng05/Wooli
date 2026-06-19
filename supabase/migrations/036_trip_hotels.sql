-- Trip-level hotels: one row per hotel stay, spanning a check-in/check-out date range.
-- Each itinerary day within [check_in, check_out] derives a read-only hotel card.

create table if not exists public.trip_hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,            -- free-text address/area (optional)
  coords text,              -- Google Maps URL or "lat,lng" (same format as SectionData.coords)
  check_in date not null,
  check_out date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists trip_hotels_trip_id_idx on public.trip_hotels (trip_id);

alter table public.trip_hotels enable row level security;

create policy "Users manage their own trip hotels (select)"
  on public.trip_hotels for select using (auth.uid() = user_id);
create policy "Users manage their own trip hotels (insert)"
  on public.trip_hotels for insert with check (auth.uid() = user_id);
create policy "Users manage their own trip hotels (update)"
  on public.trip_hotels for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own trip hotels (delete)"
  on public.trip_hotels for delete using (auth.uid() = user_id);
