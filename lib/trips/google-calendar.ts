import type { SectionData } from './trip-sections'

export type GCalEvent = {
  summary: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

export function mapGCalToSection(event: GCalEvent): SectionData {
  const time = event.start.dateTime 
    ? new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : undefined

  const lines = [event.summary]
  if (event.location) lines.push(event.location)
  if (event.description) {
    // Basic cleanup of HTML descriptions if any
    const cleanDesc = event.description.replace(/<[^>]*>?/gm, '').split('\n').filter(Boolean)
    lines.push(...cleanDesc)
  }

  // Determine type based on keywords
  let type = 'ACTIVITY'
  const summary = event.summary.toUpperCase()
  if (summary.includes('FLIGHT') || summary.includes('UA ') || summary.includes('AA ')) type = 'FLIGHT'
  else if (summary.includes('TRAIN') || summary.includes('RAIL')) type = 'TRAIN'
  else if (summary.includes('HOTEL') || summary.includes('STAY') || summary.includes('CHECK IN')) type = 'HOTEL'
  else if (summary.includes('LUNCH') || summary.includes('DINNER') || summary.includes('RESTAURANT')) type = 'MEAL'

  return {
    type,
    lines,
    timeOverride: time,
    place: event.location,
  }
}
