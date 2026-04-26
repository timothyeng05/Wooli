# Build Spec: Calendar v2 + Period Tracking + Groq AI

_Written by Opus 4.7 on 2026-04-25. Hand to Sonnet to implement._

This is a self-contained build spec. Sonnet can read this, ask clarifying questions, then implement in phases. Phases are independent — each can ship as its own PR.

---

## Goal

Make the mood calendar a richer daily-life dashboard. Add period tracking as a first-class data type. Layer in lightweight AI (via Groq) for journal prompts and weekly summaries.

---

## Phase 1 — Period tracking (schema + minimal UI)

### Schema migration

New file: `supabase/migrations/0XX_period_tracking.sql`

```sql
create table public.period_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  start_date  date not null,
  end_date    date,                              -- null while period is ongoing
  flow_level  text check (flow_level in ('light', 'medium', 'heavy')),
  symptoms    text[],                            -- e.g. ['cramps', 'headache', 'fatigue']
  notes       text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table public.period_entries enable row level security;

create policy "Users manage own period entries"
  on public.period_entries for all
  using (user_id = auth.uid());

create trigger handle_updated_at_period
  before update on public.period_entries
  for each row execute function handle_updated_at();

create index period_entries_user_date_idx on public.period_entries (user_id, start_date desc);
```

**Why a separate table** (instead of extending mood_entries): periods span multiple days, have their own attributes (flow, symptoms), and need cycle-prediction queries. Keeping them separate keeps mood_entries clean.

### UI: log/edit period

- New route: `/period/new` — form: start date, end date (optional), flow level, symptoms checkboxes, notes
- New route: `/period/[id]` — edit existing entry
- Symptoms list (hardcoded for v1): `['cramps', 'headache', 'fatigue', 'bloating', 'mood swings', 'nausea', 'breast tenderness', 'acne']`
- Mark "Period" activity tag in mood form as deprecated — don't remove yet, but add a note pointing to `/period/new`. Migrate later.

### Cycle prediction helper

New file: `lib/period-utils.ts`:
```ts
// Given past period_entries, return predicted next start date
export function predictNextPeriod(entries: PeriodEntry[]): Date | null {
  if (entries.length < 2) return null
  // Compute cycle lengths from start_date to next start_date
  // Average last 6 cycles
  // Add average to most recent start_date
}

export function currentCycleDay(entries: PeriodEntry[], today: Date): number | null
export function isInPredictedPeriod(entries: PeriodEntry[], date: Date): boolean
```

---

## Phase 2 — Calendar v2 (UI overhaul)

File: `app/components/dashboard/MoodCalendar.tsx` (rename to `LifeCalendar.tsx` since it's no longer just mood).

### Data layers per cell (in z-order, bottom to top)

1. **Background color** — mood color (existing) OR predicted-period light pink dashed border if no mood logged
2. **Period bar** — bottom 3px strip in red intensity matching flow_level (light = pink, medium = red, heavy = dark red)
3. **Day number** — top-left, slightly bigger
4. **Activity dots** — bottom row, max 4 small (4px) colored dots; one per activity
5. **Notes indicator** — top-right corner pencil icon (4×4) if `note` or `grateful_for` present
6. **Today ring** — blue 2px ring (existing)

### Activity color mapping

In a new `lib/activity-config.ts`:
```ts
export const ACTIVITY_CONFIG = {
  Exercised:    { color: '#10b981', icon: '🏃' },  // green
  Read:         { color: '#8b5cf6', icon: '📖' },  // purple
  'Good sleep': { color: '#3b82f6', icon: '😴' },  // blue
  Meditated:    { color: '#f59e0b', icon: '🧘' },  // amber
  Period:       null, // moved to its own data layer
} as const
```

### Insights strip (above calendar)

New component: `app/components/dashboard/CalendarInsights.tsx`
Shows three pills, separated by `·`:
- **Streak**: "🔥 5-day journal streak" (consecutive days with mood entry, ending today or yesterday)
- **Mood avg**: "Avg mood 3.8 last 30d"
- **Cycle**: "Cycle day 14 · next expected May 18" (only render if user has period entries)

Helper functions in `lib/mood-utils.ts`:
```ts
export function loggingStreak(entries: MoodEntry[], today: Date): number
export function avgMood(entries: MoodEntry[], days: number): number | null
```

### Hover preview (desktop only)

On `:hover` of a calendar cell with an entry, show a small floating tooltip:
- Mood label
- First line of `note` (truncated to 80 chars)
- "Click to view"

Use Tailwind `group` + `group-hover:` — no library needed. Hidden on touch devices via `@media (hover: hover)`.

### Legend update

Replace existing legend with two rows:
- Row 1: mood color squares (existing)
- Row 2: activity dots + period marker swatch + "✏️ has notes" key

---

## Phase 3 — Year heatmap view (toggle)

Add a "View" toggle in the calendar header: `Month | Year`

Year view component: `app/components/dashboard/YearHeatmap.tsx`
- 53 columns × 7 rows = whole year, GitHub-contribution style
- Each cell = mood color (or gray if no entry)
- Click any cell → navigate to that date's entry or `/mood/new?date=…`
- Tooltip on hover: date + mood label

Keep month view as default. Persist toggle in localStorage.

---

## Phase 4 — Groq AI integration

### Setup

- Add env var `GROQ_API_KEY` (server-side only, never client)
- Install `groq-sdk` (`npm i groq-sdk`)
- New file: `lib/groq.ts` exporting a configured client + helper for streaming

### Feature 4a: Smart journal prompts

When user opens `/mood/new`, generate 2–3 personalized reflection questions based on:
- Their last 7 days of mood + activities
- Today's day of week / time of day
- Recent grateful_for / note themes

API route: `app/api/journal-prompts/route.ts`
- Reads last 7 mood_entries for the user
- Sends a tight prompt to `llama-3.3-70b-versatile` on Groq (fast, cheap, good reasoning)
- Returns 3 short questions (e.g., "You logged exercising 4x this week — how does your body feel?")
- Display as clickable chips above the textarea; clicking inserts the question into the note field

**Caching:** cache prompts per user per day (prompts shouldn't change throughout the day). Use Supabase `ai_prompts_cache` table or just compute on first load and store in localStorage with date key.

### Feature 4b: Weekly summary

On Sundays (or first dashboard load of a new week), generate a 2–3 sentence summary of the past week.

API route: `app/api/weekly-summary/route.ts`
- Reads past 7 days of mood + activities + period + transactions (top categories)
- Asks Groq for: one-sentence highlight, one-sentence pattern, one suggestion
- Returns markdown

Show on dashboard as a dismissible card above the calendar. Cache to `weekly_summaries` table:
```sql
create table public.weekly_summaries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  week_start   date not null,
  summary      text not null,
  created_at   timestamptz default now() not null,
  unique(user_id, week_start)
);
```

### Feature 4c: Auto-tag activities from notes (optional, defer)

When user writes a note like "went for a long run after work", Groq extracts activity tags and offers to add them. Small button: "AI suggests: + Exercised". User taps to confirm.

**Defer this** until 4a and 4b ship and prove value. Easy to add later.

### Groq usage budget

Free tier: 30 req/min, 14,400 req/day. Plenty for personal use. Set up `process.env.GROQ_API_KEY` and forget about cost for now.

### Prompt design notes

Keep prompts short. Use system prompts for tone. Example for 4a:
```
You are a thoughtful journal companion. Based on the user's recent mood entries
and activities, suggest 3 short reflection questions (under 12 words each)
that feel personal and specific. Return ONLY a JSON array of strings.
```

Use Groq's JSON mode (`response_format: { type: 'json_object' }`) for structured output. Wrap the array in `{ questions: [...] }`.

---

## Phase 5 — Cleanup

After Phase 1 ships:
- Remove "Period" from the activities list in `MoodFormClient.tsx:7`
- Migration: copy any historical `mood_entries` with `'Period' in activities` to `period_entries` (single-day periods, flow=null)

---

## Suggested ship order

1. **Phase 1** — period schema + minimal log/edit UI (1 session)
2. **Phase 2** — calendar v2 with all data layers (1–2 sessions; biggest visual change)
3. **Phase 4a** — Groq journal prompts (1 session; `GROQ_API_KEY` already set up)
4. **Phase 4b** — weekly summary, auto on Sunday (1 session)
5. **Phase 5** — migrate Period out of activities (cleanup, 30 min)

Phase 3 (year heatmap) is punted.

---

## Decisions (locked in by user 2026-04-25)

1. **Symptoms list** — keep as-is: cramps, headache, fatigue, bloating, mood swings, nausea, breast tenderness, acne
2. **Period prediction visual** — pink dashed border around predicted days
3. **Groq model** — `llama-3.3-70b-versatile`
4. **Weekly summary** — auto-generate on Sunday (first dashboard load of new week). No manual button needed
5. **Year heatmap** — **PUNTED**. Skip Phase 3. Sonnet, do not build the year view

---

## Files touched (summary)

**New:**
- `supabase/migrations/0XX_period_tracking.sql`
- `app/period/new/page.tsx`
- `app/period/[id]/page.tsx`
- `app/components/period/PeriodForm.tsx`
- `app/components/dashboard/CalendarInsights.tsx`
- `app/components/dashboard/YearHeatmap.tsx` (Phase 3)
- `lib/period-utils.ts`
- `lib/mood-utils.ts`
- `lib/activity-config.ts`
- `lib/groq.ts` (Phase 4)
- `app/api/journal-prompts/route.ts` (Phase 4a)
- `app/api/weekly-summary/route.ts` (Phase 4b)

**Renamed:**
- `app/components/dashboard/MoodCalendar.tsx` → `LifeCalendar.tsx`

**Modified:**
- `app/page.tsx` (insights strip, weekly summary card)
- `app/components/mood/MoodFormClient.tsx` (deprecate Period activity, add prompt chips)
- `app/api/mood/route.ts` (likely needs activities/note in response for calendar layers)
- `app/components/Nav.tsx` (add `/period` link? or keep period under journal?)

**Env:**
- `.env.local` and Vercel: add `GROQ_API_KEY`
