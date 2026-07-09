# Module: Trips

**Status:** Active — fully built.
**Route:** `/trips`

## Purpose

Plan, live-edit, and look back on multi-day trip itineraries. Each trip has a list of days; each day has structured sections (transit, activities, meals) stored as JSON, plus retrospective fields (rating, journal). Days are navigable with a persistent sidebar (legs-grouped, searchable). Trips can be shared read-only and exported in machine-readable form for AI assistants.

## Routes

| Route | File | Type | Notes |
|---|---|---|---|
| `/trips` | `app/trips/page.tsx` | Server | Upcoming/past trip cards |
| `/trips/new` | `app/trips/new/page.tsx` | Client | Create form; redirects straight to Day 1 |
| `/trips/[id]` | `app/trips/[id]/page.tsx` | Server | **Redirect only** — to today's day (or the first day) |
| `/trips/[id]/settings` | `app/trips/[id]/settings/page.tsx` | Client | Edit name/dates/description, legs editor, delete trip |
| `/trips/[id]/[date]` | `app/trips/[id]/[date]/page.tsx` | Client | Day editor — timeline, sidebar, drag-and-drop, "Looking back" retro |
| `/share/[id]` | `app/share/[id]/page.tsx` | Server | Public share — redirects to the first day |
| `/share/[id]/[date]` | `app/share/[id]/[date]/page.tsx` | Server | Public read-only day view (service-role read, no auth) |
| `/share/[id]/export` | `app/share/[id]/export/route.ts` | Route handler | Machine-readable itinerary — JSON, or Markdown with `?format=md` |

## API Routes (`app/api/trips/`)

| Route | Purpose |
|---|---|
| `POST /api/trips/day-summary` | Groq summary of a day's sections. Default: 15-word preview line. `isPast: true`: 2–3 sentence past-tense recap (used by the "Looking back" card) |
| `POST /api/trips/section-title` | Groq-generated short titles for sections |
| `POST /api/trips/sync-calendar` | Imports the day's Google Calendar events as sections (needs Google provider token) |
| `GET /api/trips/places` | Google Places autocomplete + details (server-side key; falls back to disabled) |
| `GET /api/trips/geocode` | Resolve free text / Maps short links to coords (Google or Nominatim) |

## Components (`app/components/trips/`)

| File | Purpose |
|---|---|
| `TripSidebar.tsx` | Day list (legs-grouped, collapsible, drag-to-swap), trip search, hotels/ate panels, share + AI-export + ⚙ settings links. Exports `SidebarSearch` |
| `SectionCards.tsx` | Read-mode cards: `SectionCard`, `HotelCard`, `DayMapCollapsible`, `LocationPreview` |
| `SectionEditorCard.tsx` | Section editor + `AddSectionPicker` |
| `SectionEditors.tsx` | Field editors used by the section editor |
| `EditPanel.tsx` | Slide-out edit drawer (bottom sheet on mobile, right panel on desktop) |
| `TripHotels.tsx` | Trip-level hotel CRUD (check-in/check-out ranges) |
| `AiShareButton.tsx` | Copies the `/share/[id]/export?format=md` link (paste into an AI assistant) |
| `ShareDayPicker.tsx` | Day dropdown on the share page |
| `CoordsInput.tsx` | Location input (Places autocomplete / paste-a-link) |
| `DayLocationMap(Client).tsx`, `DayMap.tsx`, `DayContextMap.tsx`, `TripRouteMap(Client).tsx` | Leaflet maps (day pins, trip route) |

## Lib (`lib/trips/`)

| File | Exports |
|---|---|
| `trip-sections.ts` | Single source of truth for section types/parsing/display: `SECTIONS`, `findMeta()`, `sectionDataToDisplay()`, `parseSectionsFromNotes()`, `notesToSectionData()` |
| `trip-utils.ts` | `EditorSection`, type sets, `RATING_SCALE`, `ratingStyle/ratingLabel`, `parseCoords`, `inputCls/labelCls` |
| `trip-legs.ts` | `Leg`, `LEG_COLORS`, `resolveLegs(tripId, tripRow)` — DB `trips.legs` with hardcoded `TRIP_LEGS` fallback |
| `trip-search.ts` | `searchDays(days, query)` — trip-wide day search (title + section content), 2-char minimum. Unit-tested |
| `trip-export.ts` | `buildTripItinerary()`, `tripItineraryToMarkdown()` — machine-readable export |
| `maps-url.ts` | `coordsFromText`, `placeNameFromText` (Google Maps link parsing). Unit-tested |
| `google-calendar.ts` | `mapGCalToSection` for calendar sync |

## Schema

```sql
-- trips: one row per trip
trips (id, user_id, name, destination, start_date, end_date, description,
       legs,        -- jsonb Leg[] {name, emoji, from, to} — added in 038
       created_at)

-- trip_days: one row per day per trip (unique on trip_id,date — upserts rely on it)
trip_days (id, trip_id, user_id, date, title, notes, confirmed_sections, location,
           rating, mood, journal,   -- retrospective fields — added in 035
           created_at)

-- trip_hotels: trip-level stays; each day in [check_in, check_out] derives a hotel card
trip_hotels (id, trip_id, user_id, name, location, coords, check_in, check_out, notes, created_at)
```

**RLS:** `user_id = auth.uid()` on all three tables. Share pages/export use the service-role client (public read by link).

### Legs

`trips.legs` stores `Leg[]` (`{name, emoji, from, to}`), edited on the settings page. `resolveLegs(tripId, tripRow)` in `lib/trips/trip-legs.ts` returns the DB value when present, otherwise a hardcoded fallback map (pre-038 trips). Always fetch trips with `select('*')` so the column stays optional pre-migration.

### Retrospective (rating / journal)

Migration 035 added `rating`, `mood`, `journal` to `trip_days`. The day page's "Looking back" card (past days only) writes `rating`/`journal` via its own targeted upsert — isolated from the section editor's `save()` so a missing column can never break itinerary saves. The sidebar shows a muted `n/10` chip for rated days; the share page renders `journal` as a quote block. `mood` is currently unused.

## Section Data Format

`trip_days.notes` stores a `SectionData[]` JSON array:

```ts
type SectionData = {
  type: string       // canonical: 'TRANSIT' | 'ACTIVITY' | 'MEAL' (legacy types auto-canonicalized)
  lines: string[]    // content lines; bullet items start with '-'
  timeOverride?: string   // e.g. '11:00 AM'
  duration?: string       // e.g. '3h'
  pinned?: boolean        // true = show ⭐ (important/appointment)
  skipped?: boolean       // struck through in view mode
  coords?: string         // Google Maps URL or "lat,lng"
  title?: string          // explicit display title
  rating?: number         // 1–10 (meals — feeds "What we ate")
  place?: string          // free-text place/area
}
```

Legacy text format (section headers as plain lines) is still parsed by `parseLegacyText()`. `notesToSectionData()` handles both and canonicalizes legacy types (MORNING/AFTERNOON/NIGHT → ACTIVITY, BREAKFAST/LUNCH/DINNER → MEAL, all transport variants → TRANSIT).

## confirmed_sections

Vestigial column — no UI reads or writes it; it is only copied verbatim during day swaps for data safety.

## Migrations

`016_trips.sql` (trips + trip_days), `020_trip_day_confirmed_sections.sql` (vestigial), `031_trip_days_location.sql` (location), `035_trip_days_retrospective.sql` (rating/mood/journal), `036_trip_hotels.sql` (trip_hotels), `038_trip_legs.sql` (trips.legs).

**Migration-fallback rule:** code must run before the owner applies a migration. Fetch with `select('*')` and read new columns optionally; never name a new column in a select. Writes that touch new columns get their own call and degrade with a toast.
