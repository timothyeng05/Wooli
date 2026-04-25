# Module: Calendar / Journal

**Status:** Not yet built.
**Route:** `/calendar`

## Purpose

Track events and write journal entries. Calendar view for events, daily journal for reflections.

## Routes

| Route | Purpose |
|---|---|
| `/calendar` | Monthly calendar view of events |
| `/calendar/new` | Create an event |
| `/calendar/[id]` | View / edit an event |
| `/calendar/journal` | Journal entry list (newest first) |
| `/calendar/journal/new` | Write a journal entry |
| `/calendar/journal/[date]` | View / edit entry for a specific date |

## Schema

```sql
-- Calendar events
create table public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  title        text not null,
  description  text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  is_all_day   boolean default false not null,
  location     text,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

-- Journal entries (one per day)
create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  entry_date date not null,
  body       text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, entry_date)
);
```

**RLS:** Enable on both tables, policy: `user_id = auth.uid()` for all operations.

## Field Notes

- `ends_at` — nullable; single-moment events have no end time
- `is_all_day` — when true, times are ignored in display
- `entry_date` — `date` type (no time), unique per user per day (one entry per day enforced at DB level)
- Journal entries use upsert on (`user_id`, `entry_date`)

## Components

```
src/components/calendar/
  MonthGrid.tsx             ← monthly calendar grid with event dots
  EventCard.tsx             ← single event display
  EventForm.tsx             ← create/edit event
  JournalEntryCard.tsx      ← single journal entry (date + body preview)
  JournalEditor.tsx         ← textarea-based journal writing UI
```

## Dashboard Widget

Show upcoming events (next 7 days) and whether today's journal entry has been written.
Data source:
- `calendar_events` where `starts_at >= now()` order by `starts_at` limit 5
- `journal_entries` where `entry_date = current_date`

## Build Order

1. Migrations (calendar_events, journal_entries)
2. `/calendar/new` — event form
3. `/calendar` — month grid
4. `/calendar/[id]` — event detail/edit
5. `/calendar/journal/new` — journal editor
6. `/calendar/journal` — journal list
7. Dashboard widget
