create table public.trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  destination text,
  start_date  date not null,
  end_date    date not null,
  description text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create table public.trip_days (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid references public.trips(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        date not null,
  title       text,
  notes       text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null,
  constraint trip_days_trip_date_unique unique (trip_id, date)
);

alter table public.trips enable row level security;
alter table public.trip_days enable row level security;

create policy "Users manage own trips"
  on public.trips for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own trip days"
  on public.trip_days for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger handle_updated_at_trips
  before update on public.trips
  for each row execute function handle_updated_at();

create trigger handle_updated_at_trip_days
  before update on public.trip_days
  for each row execute function handle_updated_at();

create index trips_user_idx on public.trips (user_id, start_date desc);
create index trip_days_trip_idx on public.trip_days (trip_id, date);
