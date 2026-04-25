# Module: Mood Tracker

**Status:** Not yet built — first module to build after auth flow is complete.
**Route:** `/mood`

## Purpose

Log daily mood with optional notes. Simple entry form, calendar-style history view.

## Routes

| Route | Purpose |
|---|---|
| `/mood` | List view — recent entries, calendar heatmap |
| `/mood/new` | Log a new mood entry |
| `/mood/[id]` | View / edit a single entry |

## Schema

```sql
create table public.mood_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  mood       smallint not null check (mood between 1 and 5),
  note       text,
  logged_at  timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.mood_entries enable row level security;

create policy "Users manage own mood entries"
  on public.mood_entries for all
  using (user_id = auth.uid());
```

**Trigger:** Apply `handle_updated_at()` trigger (already defined globally).

## Field Notes

- `mood` — integer 1–5 scale (1 = very bad, 5 = very good)
- `note` — optional free text, no length limit
- `logged_at` — the time the mood applies to (user-editable), distinct from `created_at`

## Components

```
src/components/mood/
  MoodEntryCard.tsx       ← display a single entry (mood score + note + date)
  MoodForm.tsx            ← create/edit form (mood picker + note textarea)
  MoodCalendar.tsx        ← calendar heatmap of mood scores
```

## Dashboard Widget

Show last 7 days of mood as a small sparkline or colored dots.
Data source: query `mood_entries` ordered by `logged_at desc` limit 7.

## Build Order

1. Run migration (create table + RLS)
2. `src/app/mood/new/page.tsx` — form to create entry (Server Action)
3. `src/app/mood/page.tsx` — list recent entries
4. `src/app/mood/[id]/page.tsx` — edit entry
5. Dashboard widget
