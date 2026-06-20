import { notesToSectionData, findMeta, type SectionData } from './trip-sections'
import { TRIP_LEGS, type Leg } from '@/app/trips/legs-config'

// Machine-readable export of a whole trip itinerary. Used by the share export
// route so a shared link can be fed to an LLM (e.g. Claude) to understand the
// plan and design a similar trip.

export type TripRow = { name: string; start_date: string; end_date: string }
export type DayRow = { date: string; title: string | null; notes: string | null }
export type HotelRow = { name: string; check_in: string; check_out: string; location?: string | null }

export type ItineraryItem = {
  type: string
  category: string
  name: string
  time: string | null
  duration: string | null
  place: string | null
  rating: number | null
  important: boolean
  skipped: boolean
  notes: string[]
}

export type ItineraryDay = {
  day: number
  date: string
  weekday: string
  leg: string | null
  title: string | null
  items: ItineraryItem[]
}

export type TripItinerary = {
  type: 'trip-itinerary'
  source: 'Wooli'
  description: string
  trip: { name: string; startDate: string; endDate: string; days: number }
  hotels: { name: string; checkIn: string; checkOut: string; location: string | null }[]
  days: ItineraryDay[]
}

function generateDays(startDate: string, endDate: string): string[] {
  const out: string[] = []
  const cur = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (cur <= end) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
    )
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function legFor(date: string, legs: Leg[]): string | null {
  const leg = legs.find(l => date >= l.from && date <= l.to)
  return leg ? leg.name : null
}

function fmtWeekday(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
}

function fmtLongDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

// Turn a stored section into a clean, structured item: a single name, the rest
// as notes (bullets stripped of their leading dash).
function itemFromSection(s: SectionData): ItineraryItem {
  const meta = findMeta(s.type)
  const content = s.lines.map(l => l.trim()).filter(Boolean)
  let name: string | undefined
  const notes: string[] = []
  for (const l of content) {
    if (l.startsWith('-')) notes.push(l.replace(/^-\s*/, ''))
    else if (name === undefined) name = l
    else notes.push(l)
  }
  return {
    type: s.type.toUpperCase(),
    category: meta?.label ?? s.type,
    name: name ?? meta?.label ?? s.type,
    // meta.time values like "Depart"/"Stay" are labels, not real times — only
    // surface an explicit user-set time.
    time: s.timeOverride?.trim() || null,
    duration: s.duration?.trim() || null,
    place: s.place?.trim() || null,
    rating: typeof s.rating === 'number' ? s.rating : null,
    important: !!s.pinned,
    skipped: !!s.skipped,
    notes,
  }
}

export function buildTripItinerary(
  tripId: string,
  trip: TripRow,
  dayRows: DayRow[],
  hotels: HotelRow[],
): TripItinerary {
  const allDates = generateDays(trip.start_date, trip.end_date)
  const legs = TRIP_LEGS[tripId] ?? []
  const byDate = new Map(dayRows.map(d => [d.date, d]))

  const days: ItineraryDay[] = allDates.map((date, i) => {
    const row = byDate.get(date)
    return {
      day: i + 1,
      date,
      weekday: fmtWeekday(date),
      leg: legFor(date, legs),
      title: row?.title ?? null,
      items: notesToSectionData(row?.notes ?? null).map(itemFromSection),
    }
  })

  return {
    type: 'trip-itinerary',
    source: 'Wooli',
    description:
      'A day-by-day travel itinerary. Each day lists items (activities, meals, transit, hotels) with optional times, durations, places, ratings, and notes. Feed this to an AI assistant to understand the trip or plan a similar one.',
    trip: {
      name: trip.name,
      startDate: trip.start_date,
      endDate: trip.end_date,
      days: allDates.length,
    },
    hotels: hotels.map(h => ({
      name: h.name,
      checkIn: h.check_in,
      checkOut: h.check_out,
      location: h.location ?? null,
    })),
    days,
  }
}

// Compact, LLM-friendly Markdown rendering of the same data.
export function tripItineraryToMarkdown(it: TripItinerary): string {
  const out: string[] = []
  out.push(`# ${it.trip.name}`)
  out.push(`${fmtLongDate(it.trip.startDate)} – ${fmtLongDate(it.trip.endDate)} · ${it.trip.days} days`)
  out.push(`_Shared from Wooli. ${it.description}_`)
  out.push('')

  if (it.hotels.length) {
    out.push('## Hotels')
    for (const h of it.hotels) {
      out.push(`- ${h.name}${h.location ? ` (${h.location})` : ''} — ${h.checkIn} → ${h.checkOut}`)
    }
    out.push('')
  }

  for (const d of it.days) {
    const legPart = d.leg ? ` · ${d.leg}` : ''
    out.push(`## Day ${d.day} — ${fmtLongDate(d.date)}${legPart}`)
    if (d.title) out.push(`**${d.title}**`)
    if (!d.items.length) {
      out.push('_No plans for this day._')
      out.push('')
      continue
    }
    for (const item of d.items) {
      const bits: string[] = []
      if (item.time) bits.push(item.time)
      bits.push(`${item.category}: ${item.name}`)
      const tags: string[] = []
      if (item.duration) tags.push(item.duration)
      if (item.place) tags.push(`📍 ${item.place}`)
      if (item.rating != null) tags.push(`${item.rating}/10`)
      if (item.important) tags.push('important')
      if (item.skipped) tags.push('skipped')
      const tagPart = tags.length ? ` (${tags.join(', ')})` : ''
      out.push(`- **${bits.join(' · ')}**${tagPart}`)
      for (const n of item.notes) out.push(`  - ${n}`)
    }
    out.push('')
  }

  return out.join('\n').trim() + '\n'
}
