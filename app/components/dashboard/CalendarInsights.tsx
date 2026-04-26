import { loggingStreak, avgMood, type MoodEntry } from '@/lib/mood-utils'
import { currentCycleDay, predictNextPeriodStart, type PeriodEntry } from '@/lib/period-utils'

export default function CalendarInsights({
  moodEntries,
  periodEntries,
}: {
  moodEntries: MoodEntry[]
  periodEntries: PeriodEntry[]
}) {
  const today = new Date()
  const streak = loggingStreak(moodEntries, today)
  const avg = avgMood(moodEntries, 30, today)
  const cycleDay = currentCycleDay(periodEntries, today)
  const nextStart = predictNextPeriodStart(periodEntries)

  const pills: string[] = []
  if (streak > 0) pills.push(`🔥 ${streak}-day streak`)
  if (avg !== null) pills.push(`Avg mood ${avg.toFixed(1)} (30d)`)
  if (cycleDay !== null) {
    let cyclePill = `Cycle day ${cycleDay}`
    if (nextStart) {
      const next = nextStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      cyclePill += ` · next ${next}`
    }
    pills.push(cyclePill)
  }

  if (pills.length === 0) return null

  return (
    <div className="text-xs text-gray-500 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      {pills.map((p, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-gray-300">·</span>}
          {p}
        </span>
      ))}
    </div>
  )
}
