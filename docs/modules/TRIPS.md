# Module: Trips

**Status:** Active — fully built.
**Route:** `/trips`

## Purpose

Plan and view multi-day trip itineraries. Each trip has a list of days; each day has structured sections (flights, activities, meals, hotels, transit) stored as JSON. Days are navigable with a persistent sidebar.

## Routes

| Route | File | Type | Notes |
|---|---|---|---|
| `/trips` | `app/trips/page.tsx` | Server | List all trips for the user |
| `/trips/new` | `app/trips/new/page.tsx` | Server | Create a new trip |
| `/trips/[id]` | `app/trips/[id]/page.tsx` | Server | Trip overview — all days grouped by leg |
| `/trips/[id]/[date]` | `app/trips/[id]/[date]/page.tsx` | **Client** | Day detail — view + edit itinerary |
| `/share/[id]` | `app/share/[id]/page.tsx` | Server | Public share page for a trip |
| `/share/[id]/[date]` | `app/share/[id]/[date]/page.tsx` | Server | Public share for one day |

## API Routes

| Route | Purpose |
|---|---|
| `POST /api/trips/day-summary` | Groq AI one-line summary of a day's sections |

## Components (`app/components/trips/`)

| File | Purpose |
|---|---|
| `DayMap.tsx` | Leaflet map showing a single day's locations |
| `TripRouteMap.tsx` | Server wrapper for the full trip route map |
| `TripRouteMapClient.tsx` | Client Leaflet map for the whole trip route |
| `DayContextMap.tsx` | Contextual map for a day page |

## Lib (`lib/trips/`)

| File | Exports |
|---|---|
| `trip-sections.ts` | `SectionMeta`, `SectionData`, `ParsedSection`, `SECTIONS`, `findMeta()`, `sectionDataToDisplay()`, `parseSectionsFromNotes()`, `notesToSectionData()` |

`app/trips/legs-config.ts` — defines leg date ranges for a specific trip (not a shared lib; lives with the routes).

## Schema

```sql
-- trips: one row per trip
trips (id, user_id, name, start_date, end_date, created_at)

-- trip_days: one row per day per trip
trip_days (id, trip_id, user_id, date, title, notes, confirmed_sections, created_at)
```

**RLS:** `user_id = auth.uid()` on both tables.

## Section Data Format

`trip_days.notes` stores a `SectionData[]` JSON array:

```ts
type SectionData = {
  type: string       // e.g. 'ACTIVITY', 'MEAL', 'FLIGHT', 'HOTEL', 'SUBWAY'
  lines: string[]    // content lines; bullet items start with '-'
  timeOverride?: string   // e.g. '11:00 AM'
  duration?: string       // e.g. '3h'
  pinned?: boolean        // true = show ⭐ in view mode (important/appointment)
}
```

Legacy text format (section headers as plain lines) is also supported via `parseLegacyText()` — kept for backward compatibility. `notesToSectionData()` handles both.

## Section Types

Defined in `lib/trips/trip-sections.ts` → `SECTIONS` array. Key types:

| Type | Label | Notes |
|---|---|---|
| `FLIGHT`, `FAMILY FLIGHT` | Flight | `banner: true` — shown in TravelBanner |
| `TRANSPORT`, `TRAIN` | Train | `banner: true` |
| `SUBWAY`, `METRO` | Subway | `transit: true` |
| `DRIVE` | Drive | `drive: true` |
| `RENTAL CAR`, `TAXI`, `UBER` | Car | `transit: true`, `car: true` |
| `ACTIVITY` | Activity | Canonical (replaces legacy MORNING/AFTERNOON/NIGHT) |
| `MEAL` | Meal | Canonical (replaces legacy BREAKFAST/LUNCH/DINNER) |
| `HOTEL` | Hotel | `hotel: true` — shown as HotelCard with map embed |

Legacy types (MORNING, AFTERNOON, NIGHT, BREAKFAST, LUNCH, DINNER) are auto-canonicalized to ACTIVITY/MEAL by `notesToSectionData()`.

## confirmed_sections

`trip_days.confirmed_sections` stores a `string[]` of section **indices** (e.g. `["0", "3"]`), not labels. Null means "auto-init" (flights and hotels are pre-confirmed). Each index corresponds to the position in the `SectionData[]` array, so each section instance has independent planned state.

## Migrations

`016_trips.sql` (trips + trip_days tables), `020_trip_day_confirmed_sections.sql` (adds confirmed_sections column)
