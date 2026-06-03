-- Day-level retrospective fields: rating, mood, journal
alter table trip_days
  add column if not exists rating  smallint,
  add column if not exists mood    text,
  add column if not exists journal text;
