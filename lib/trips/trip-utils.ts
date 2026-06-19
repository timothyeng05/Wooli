import type { SectionData } from './trip-sections'

export type EditorSection = SectionData & { _id: string }

export const ACTIVITY_TYPES = new Set(['MORNING', 'AFTERNOON', 'NIGHT', 'ACTIVITY'])
export const MEAL_TYPES = new Set(['BREAKFAST', 'LUNCH', 'DINNER', 'MEAL'])
export const HIDE_TITLE_TYPES = new Set(['ACTIVITY', 'MORNING', 'AFTERNOON', 'NIGHT', 'MEAL', 'BREAKFAST', 'LUNCH', 'DINNER', 'HOTEL'])

export const ADD_SECTION_GROUPS = [
  { label: 'Travel', types: ['FLIGHT', 'TRAIN', 'DRIVE', 'RENTAL CAR', 'SUBWAY'] },
  { label: 'Plan',   types: ['ACTIVITY', 'MEAL'] },
  // Hotels are managed at the trip level (sidebar), not as per-day sections.
]
export const ALL_SECTION_TYPES = ADD_SECTION_GROUPS.flatMap(g => g.types)

export function ratingStyle(r: number): string {
  if (r >= 8) return 'bg-green-500 text-white'
  if (r >= 5) return 'bg-amber-400 text-white'
  return 'bg-red-400 text-white'
}

export function parseDuration(raw: string): { hours: number; minutes: number } {
  const h = raw.match(/(\d+)\s*h/i)
  const m = raw.match(/(\d+)\s*m(?:in)?/i)
  const col = !h && !m ? raw.match(/^(\d+):(\d{2})$/) : null
  let hours = h ? parseInt(h[1]) : col ? parseInt(col[1]) : 0
  let minutes = m ? parseInt(m[1]) : col ? parseInt(col[2]) : 0
  if (minutes >= 60) { hours += Math.floor(minutes / 60); minutes %= 60 }
  return { hours, minutes }
}

export function formatDuration(h: number, m: number): string {
  if (!h && !m) return ''
  if (!h) return `${m}m`
  if (!m) return `${h}h`
  return `${h}h ${m}m`
}

export function parseCoords(raw: string | undefined): { lat: number; lng: number } | null {
  if (!raw) return null
  // Google Maps URL → pull coords out of the link (most accurate pattern first)
  if (/https?:\/\//i.test(raw)) {
    let m = raw.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)         // place pin
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    m = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)                  // map center
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    m = raw.match(/[?&](?:q|ll|query|destination|center)=(?:loc:)?(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    return null
  }
  // Legacy "lat, lng" string
  const parts = raw.split(',').map(s => parseFloat(s.trim()))
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat: parts[0], lng: parts[1] }
  return null
}

// Extract a Google place ID from a stored Maps URL (query_place_id=… or
// place_id:…). Identifies the real business listing for a richer embed/link.
export function parsePlaceId(raw: string | undefined): string | null {
  if (!raw) return null
  const m = raw.match(/[?&]query_place_id=([^&]+)/) || raw.match(/place_id:([A-Za-z0-9_-]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export const MOOD_OPTIONS: { emoji: string; label: string; value: string }[] = [
  { emoji: '😩', label: 'Rough',   value: 'rough' },
  { emoji: '😐', label: 'Okay',    value: 'okay' },
  { emoji: '🙂', label: 'Good',    value: 'good' },
  { emoji: '😄', label: 'Great',   value: 'great' },
  { emoji: '🤩', label: 'Amazing', value: 'amazing' },
]

export const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white'
export const labelCls = 'block text-xs text-gray-500 mb-1'
