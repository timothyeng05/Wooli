alter table public.trip_days add column if not exists confirmed_sections text[] default '{}';
