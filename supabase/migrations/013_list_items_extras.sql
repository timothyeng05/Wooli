-- Run this in the Supabase SQL editor

alter table public.list_items
  add column due_date date,
  add column importance smallint check (importance between 1 and 3);
