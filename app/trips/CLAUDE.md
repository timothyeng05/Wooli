# Trips Module

**Read `docs/modules/TRIPS.md` first** — it has the schema, routes, and component overview.

## Module boundary (only touch these paths)

| Area | Paths |
|------|-------|
| Routes | `app/trips/**` |
| Components | `app/components/trips/**` |
| API | `app/api/trips/**` |
| Lib | `lib/trips/**` |
| Share | `app/share/**` (read-only sharing pages + machine-readable export) |
| DB | `trips`, `trip_days`, `trip_hotels` |
| Migrations | `supabase/migrations/016_*`, `020_*`, `031_trip_days_location*`, `035_*`, `036_*`, `038_*` |

## Shared infrastructure (read-only — do not modify)

- `lib/supabase-client.ts`, `lib/supabase-server.ts` — Supabase clients
- `lib/groq.ts` — Groq AI SDK (used by `day-summary` and `section-title` routes)
- `app/layout.tsx`, `app/components/Nav.tsx` — top-level shell
- `proxy.ts` — note: trips IS in the matcher; `/share/*` and `/preview-*` are not

## DO NOT read or modify

- `app/budget/**`, `app/components/budget/**`, `lib/budget/**`
- `app/mood/**`, `app/cards/**`, `app/lists/**`, `app/period/**`
- `app/page.tsx` (dashboard hub — trips widget reads from `trips` table)

## Key conventions

- `lib/trips/trip-sections.ts` is the single source of truth for section types, parsing, and display logic. All section rendering in the editor, share page, and export flows through it.
- Section data is stored as JSON (`SectionData[]`) in `trip_days.notes`. Legacy text format is also supported by `parseSectionsFromNotes` / `notesToSectionData`.
- **Migration-fallback rule:** fetch `trips`/`trip_days` with `select('*')` and read newer columns (`legs`, `rating`, `journal`) optionally — never name a new column in a select, and give writes that touch them their own call so a missing column degrades to a toast instead of breaking saves.
- Legs are per-trip data: `trips.legs` jsonb, resolved via `resolveLegs()` in `lib/trips/trip-legs.ts` (hardcoded fallback for pre-038 trips), edited on `/trips/[id]/settings`.
- Retro fields (`rating`/`journal`, migration 035) are written ONLY by the day page's "Looking back" card through a targeted upsert — keep them out of the section editor's `save()` path.
- `confirmed_sections` in `trip_days` is vestigial — no UI reads/writes it; it's preserved during day swaps for data safety.
- The day editor (`app/trips/[id]/[date]/page.tsx`) is a client component; `app/trips/[id]/page.tsx` is just a redirect to the right day.
- Hotels are trip-level rows (`trip_hotels`, managed in the sidebar panel), not per-day sections.
- `trip_days` upserts rely on the unique `(trip_id, date)` constraint — always pass `{ onConflict: 'trip_id,date' }`.
