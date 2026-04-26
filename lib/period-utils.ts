export interface PeriodEntry {
  id: string
  start_date: string
  end_date: string | null
  flow_level: 'light' | 'medium' | 'heavy' | null
  symptoms: string[] | null
  notes: string | null
}

export const SYMPTOMS = [
  'cramps',
  'headache',
  'fatigue',
  'bloating',
  'mood swings',
  'nausea',
  'breast tenderness',
  'acne',
] as const

export const FLOW_COLORS: Record<'light' | 'medium' | 'heavy', string> = {
  light: '#fda4af',
  medium: '#ef4444',
  heavy: '#991b1b',
}

const MS_PER_DAY = 1000 * 60 * 60 * 24
const DEFAULT_CYCLE_LENGTH = 28
const DEFAULT_PERIOD_LENGTH = 5

function toDate(s: string): Date {
  return new Date(s + 'T12:00:00')
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export function averageCycleLength(entries: PeriodEntry[]): number {
  if (entries.length < 2) return DEFAULT_CYCLE_LENGTH
  const sorted = [...entries].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const recent = sorted.slice(-7)
  const lengths: number[] = []
  for (let i = 1; i < recent.length; i++) {
    lengths.push(daysBetween(toDate(recent[i - 1].start_date), toDate(recent[i].start_date)))
  }
  if (lengths.length === 0) return DEFAULT_CYCLE_LENGTH
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
}

export function averagePeriodLength(entries: PeriodEntry[]): number {
  const completed = entries.filter(e => e.end_date)
  if (completed.length === 0) return DEFAULT_PERIOD_LENGTH
  const lengths = completed.map(e => daysBetween(toDate(e.start_date), toDate(e.end_date!)) + 1)
  return Math.max(1, Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length))
}

export function predictNextPeriodStart(entries: PeriodEntry[]): Date | null {
  if (entries.length === 0) return null
  const latest = [...entries].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
  const cycle = averageCycleLength(entries)
  const start = toDate(latest.start_date)
  return new Date(start.getTime() + cycle * MS_PER_DAY)
}

export function currentCycleDay(entries: PeriodEntry[], today: Date): number | null {
  if (entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => b.start_date.localeCompare(a.start_date))
  const latestStart = toDate(sorted[0].start_date)
  const days = daysBetween(latestStart, today) + 1
  return days > 0 ? days : null
}

export function isActualPeriodDay(entries: PeriodEntry[], date: Date): PeriodEntry | null {
  const dateStr = date.toISOString().split('T')[0]
  for (const e of entries) {
    const start = e.start_date
    const end = e.end_date ?? start
    if (dateStr >= start && dateStr <= end) return e
  }
  return null
}

export function isPredictedPeriodDay(entries: PeriodEntry[], date: Date): boolean {
  if (entries.length < 2) return false
  if (isActualPeriodDay(entries, date)) return false
  const nextStart = predictNextPeriodStart(entries)
  if (!nextStart) return false
  const periodLen = averagePeriodLength(entries)
  const dateMs = date.getTime()
  const startMs = nextStart.getTime()
  const endMs = startMs + (periodLen - 1) * MS_PER_DAY
  return dateMs >= startMs && dateMs <= endMs
}
