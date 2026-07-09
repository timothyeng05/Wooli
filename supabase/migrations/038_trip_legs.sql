-- Per-trip leg groupings (name, emoji, from, to)[] — replaces the hardcoded
-- TRIP_LEGS map in lib/trips/trip-legs.ts, which remains as a fallback for
-- trips with no stored legs.
alter table public.trips
  add column if not exists legs jsonb;
