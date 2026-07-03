import { notesToSectionData, findMeta } from './trip-sections'

// Trip-wide day search: case-insensitive substring match over a day's title and
// each section's title/lines/place/type-label. All day data is already loaded
// client-side, so this is pure computation — no schema, no API.

export type SearchableDay = { date: string; title: string | null; notes: string | null }
export type DayMatch = { date: string; snippet: string }

// Queries shorter than this return no matches (enforced here, not by callers,
// so the sidebar and the mobile sheet can't drift apart).
export const MIN_QUERY_LENGTH = 2

export function searchDays(days: SearchableDay[], query: string): DayMatch[] {
  const q = query.trim().toLowerCase()
  if (q.length < MIN_QUERY_LENGTH) return []
  const matches: DayMatch[] = []
  for (const day of days) {
    const snippet = daySnippet(day, q)
    if (snippet !== null) matches.push({ date: day.date, snippet })
  }
  return matches
}

// First matching line for a day, bullet dash stripped — or the day title when
// that's what matched. Null when nothing matches.
function daySnippet(day: SearchableDay, q: string): string | null {
  if (day.title && day.title.toLowerCase().includes(q)) return day.title
  for (const s of notesToSectionData(day.notes)) {
    const contentHit = [s.title, ...s.lines, s.place].find(c => c && c.toLowerCase().includes(q))
    if (contentHit) return contentHit.trim().replace(/^-\s*/, '')
    const label = findMeta(s.type)?.label ?? s.type
    if (label.toLowerCase().includes(q)) {
      // Type-label match (e.g. "meal") — show the section's name, not the label.
      const name = s.title || s.lines.find(l => l.trim() && !l.trim().startsWith('-'))
      return (name ?? label).trim()
    }
  }
  return null
}
