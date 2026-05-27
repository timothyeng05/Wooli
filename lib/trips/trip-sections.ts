export type SectionMeta = {
  key: string[]
  time: string
  icon: string
  label: string
  bg: string
  border: string
  text: string
  dotColor: string
  travel?: true
  banner?: true
  hotel?: true
  transit?: true
  drive?: true
  car?: true
}

export const SECTIONS: SectionMeta[] = [
  { key: ['FLIGHT'],                                    time: 'Depart', icon: '✈️', label: 'Flight',           bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700',   dotColor: '#db2777', travel: true, banner: true },
  { key: ['FAMILY FLIGHT'],                             time: 'Arrive', icon: '✈️', label: 'Mom & Aunt Flight', bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700',   dotColor: '#db2777', travel: true, banner: true },
  { key: ['TRANSPORT', 'TRANSPORTATION', 'TRAIN', 'RAIL'], time: 'Train', icon: '🚄', label: 'Train',           bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dotColor: '#2563eb', travel: true, banner: true },
  { key: ['SUBWAY', 'METRO', 'TUBE'],                   time: 'Transit',icon: '🚇', label: 'Subway',            bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dotColor: '#4338ca', transit: true },
  { key: ['DRIVE', 'DRIVING'],                          time: 'Drive',  icon: '🚙', label: 'Drive',             bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dotColor: '#ea580c', drive: true },
  { key: ['RENTAL CAR', 'CAR RIDE', 'TAXI', 'UBER'],   time: 'Car',    icon: '🚗', label: 'Car',               bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dotColor: '#ea580c', transit: true, car: true },
  // Legacy time-of-day types (kept for parsing old data; new sections use ACTIVITY)
  { key: ['MORNING'],                                   time: '8 AM',   icon: '☀️', label: 'Morning',   bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-600',  dotColor: '#94a3b8' },
  { key: ['AFTERNOON'],                                 time: '2 PM',   icon: '🗺️', label: 'Afternoon', bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-600',  dotColor: '#94a3b8' },
  { key: ['NIGHT'],                                     time: '9 PM',   icon: '🌙', label: 'Night',     bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-600',  dotColor: '#94a3b8' },
  // Legacy food types (kept for parsing old data; new sections use MEAL)
  { key: ['BREAKFAST', 'BREAKFAST OPTIONS'],            time: '8 AM',   icon: '🥐', label: 'Breakfast', bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dotColor: '#d97706' },
  { key: ['LUNCH', 'LUNCH OPTIONS'],                    time: '12 PM',  icon: '🍜', label: 'Lunch',     bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dotColor: '#d97706' },
  { key: ['DINNER', 'DINNER OPTIONS'],                  time: '7 PM',   icon: '🍽️', label: 'Dinner',    bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dotColor: '#d97706' },
  // New canonical types
  { key: ['ACTIVITY'],                                  time: '',       icon: '📍', label: 'Activity',  bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-600',  dotColor: '#94a3b8' },
  { key: ['MEAL'],                                      time: '',       icon: '🍴', label: 'Meal',      bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dotColor: '#d97706' },
  { key: ['HOTEL'],                                     time: 'Stay',   icon: '🏨', label: 'Hotel',     bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dotColor: '#7c3aed', hotel: true },
]

export type SectionData = {
  type: string
  lines: string[]
  timeOverride?: string
  duration?: string
  pinned?: boolean
  coords?: string
  title?: string
}

export type ParsedSection = {
  meta: SectionMeta
  lines: string[]
  timeOverride?: string
  pinned?: boolean
}

export function findMeta(type: string): SectionMeta | undefined {
  const t = type.toUpperCase()
  return SECTIONS.find(s => s.key.includes(t))
}

export function sectionDataToDisplay(data: SectionData): ParsedSection | null {
  const meta = findMeta(data.type)
  if (!meta) return null
  const lines = [...data.lines]
  if (data.duration) lines.push(`~${data.duration}`)
  return { meta, lines, timeOverride: data.timeOverride, pinned: data.pinned }
}

// Parses notes from DB — handles both JSON (new format) and legacy text format
export function parseSectionsFromNotes(notes: string | null): ParsedSection[] {
  if (!notes) return []

  if (notes.trim().startsWith('[')) {
    try {
      const data: SectionData[] = JSON.parse(notes)
      return data.map(sectionDataToDisplay).filter((x): x is ParsedSection => x !== null)
    } catch {
      // fall through to legacy parser
    }
  }

  return parseLegacyText(notes)
}

function parseLegacyText(notes: string): ParsedSection[] {
  const lines = notes.split('\n')
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null

  for (const line of lines) {
    const h = line.trim().toUpperCase()
    const meta = SECTIONS.find(s => s.key.includes(h))
    if (meta) {
      if (current) sections.push(current)
      current = { meta, lines: [] }
    } else if (current) {
      if (line.trim().startsWith('@')) {
        current.timeOverride = line.trim().slice(1).trim()
      } else {
        current.lines.push(line)
      }
    }
  }
  if (current) sections.push(current)
  return sections
}

// Maps legacy section types to { canonical type, default time } for the editor
const LEGACY_CANONICAL: Record<string, { type: string; defaultTime?: string }> = {
  MORNING:            { type: 'ACTIVITY', defaultTime: '8:00 AM' },
  AFTERNOON:          { type: 'ACTIVITY', defaultTime: '2:00 PM' },
  NIGHT:              { type: 'ACTIVITY', defaultTime: '9:00 PM' },
  BREAKFAST:          { type: 'MEAL',     defaultTime: '8:00 AM' },
  'BREAKFAST OPTIONS':{ type: 'MEAL',     defaultTime: '8:00 AM' },
  LUNCH:              { type: 'MEAL',     defaultTime: '12:00 PM' },
  'LUNCH OPTIONS':    { type: 'MEAL',     defaultTime: '12:00 PM' },
  DINNER:             { type: 'MEAL',     defaultTime: '7:00 PM' },
  'DINNER OPTIONS':   { type: 'MEAL',     defaultTime: '7:00 PM' },
}

function canonicalize(type: string, existingTimeOverride?: string): { type: string; timeOverride?: string } {
  const entry = LEGACY_CANONICAL[type.toUpperCase()]
  if (!entry) return { type, timeOverride: existingTimeOverride }
  return {
    type: entry.type,
    // Only apply default time if there wasn't already an explicit one
    timeOverride: existingTimeOverride || entry.defaultTime,
  }
}

// Converts notes field (JSON or legacy text) to SectionData[] for the editor
export function notesToSectionData(notes: string | null): SectionData[] {
  if (!notes) return []

  if (notes.trim().startsWith('[')) {
    try {
      const data: SectionData[] = JSON.parse(notes)
      return data.map(s => {
        const { type, timeOverride } = canonicalize(s.type, s.timeOverride)
        return { ...s, type, timeOverride }
      })
    } catch {}
  }

  return parseLegacyText(notes).map(s => {
    const durationLine = s.lines.find(l => l.trim().startsWith('~'))
    const duration = durationLine?.trim().slice(1).trim()
    const lines = s.lines.filter(l => !l.trim().startsWith('~'))
    const { type, timeOverride } = canonicalize(s.meta.key[0], s.timeOverride)
    return { type, lines, timeOverride, duration }
  })
}
