# Trips Module

**Read `docs/modules/TRIPS.md` first** — it has the schema, routes, and component overview.

## Module boundary (only touch these paths)

| Area | Paths |
|------|-------|
| Routes | `app/trips/**` |
| Components | `app/components/trips/**` |
| API | `app/api/trips/**` |
| Lib | `lib/trips/**` (`trip-sections.ts`) |
| Share | `app/share/**` (read-only trip sharing pages, depend on `lib/trips/trip-sections.ts`) |
| DB | `trips`, `trip_days` |
| Migrations | `supabase/migrations/016_*`, `020_*` |

## Shared infrastructure (read-only — do not modify)

- `lib/supabase-client.ts`, `lib/supabase-server.ts` — Supabase clients
- `lib/groq.ts` — Groq AI SDK (used by `app/api/trips/day-summary/route.ts`)
- `app/layout.tsx`, `app/components/Nav.tsx` — top-level shell
- `middleware.ts` — note: trips IS in the middleware matcher now

## DO NOT read or modify

- `app/budget/**`, `app/components/budget/**`, `lib/budget/**`
- `app/mood/**`, `app/cards/**`, `app/lists/**`, `app/period/**`
- `app/page.tsx` (dashboard hub — trips widget reads from `trips` table)

## Key conventions

- `lib/trips/trip-sections.ts` is the single source of truth for section types, parsing, and display logic. All section rendering in both the editor and the share page flows through it.
- Section data is stored as JSON (`SectionData[]`) in `trip_days.notes`. Legacy text format is also supported by `parseSectionsFromNotes`.
- `confirmed_sections` in `trip_days` stores a `string[]` of section indices (not labels) marking planned items.
- The day editor (`app/trips/[id]/[date]/page.tsx`) is a client component; the trip overview (`app/trips/[id]/page.tsx`) is a server component.
- `app/trips/legs-config.ts` defines per-trip leg groupings — only one trip ID is configured there currently.
