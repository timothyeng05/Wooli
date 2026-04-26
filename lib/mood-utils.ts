export interface MoodEntry {
  id: string
  mood: number
  note?: string | null
  grateful_for?: string | null
  activities?: string[] | null
  logged_at: string
}

export const MOOD_LABELS: Record<number, string> = {
  1: 'Bad',
  2: 'Stressed',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
}

export const MOOD_BG: Record<number, string> = {
  1: 'bg-red-200',
  2: 'bg-orange-200',
  3: 'bg-yellow-200',
  4: 'bg-lime-200',
  5: 'bg-green-200',
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function toDateOnly(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY)
}

export function loggingStreak(entries: MoodEntry[], today: Date): number {
  if (entries.length === 0) return 0
  const days = new Set(entries.map(e => e.logged_at.split('T')[0]))
  let streak = 0
  let cursor = days.has(toDateOnly(today)) ? today : addDays(today, -1)
  while (days.has(toDateOnly(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function avgMood(entries: MoodEntry[], days: number, today: Date): number | null {
  const cutoff = addDays(today, -days)
  const recent = entries.filter(e => new Date(e.logged_at) >= cutoff)
  if (recent.length === 0) return null
  return recent.reduce((s, e) => s + e.mood, 0) / recent.length
}
