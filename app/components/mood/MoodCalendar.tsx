'use client'

interface MoodCalendarProps {
  entries: { logged_at: string; mood_score: number }[]
  year: number
  month: number // 1-12
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function moodColor(score: number): string {
  if (score <= 2) return 'bg-red-200'
  if (score === 3) return 'bg-yellow-200'
  return 'bg-green-200'
}

export default function MoodCalendar({ entries, year, month }: MoodCalendarProps) {
  // Build a map: "YYYY-MM-DD" -> mood_score (last entry wins if multiple on same day)
  const scoreByDate: Record<string, number> = {}
  for (const entry of entries) {
    const dateKey = entry.logged_at.split('T')[0]
    // Only include entries for this month/year
    const [y, m] = dateKey.split('-').map(Number)
    if (y === year && m === month) {
      scoreByDate[dateKey] = entry.mood_score
    }
  }

  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()

  const todayStr = new Date().toISOString().split('T')[0]

  // Total cells needed: leading blanks + days, rounded up to full weeks
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(totalCells - firstDay - daysInMonth).fill(null),
  ]

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`blank-${idx}`}
                className="w-8 h-8 rounded bg-gray-50"
              />
            )
          }

          const mm = String(month).padStart(2, '0')
          const dd = String(day).padStart(2, '0')
          const dateKey = `${year}-${mm}-${dd}`
          const score = scoreByDate[dateKey]
          const isToday = dateKey === todayStr

          const colorClass = score !== undefined ? moodColor(score) : 'bg-gray-100'
          const ringClass = isToday ? 'ring-2 ring-blue-400' : ''

          return (
            <div
              key={dateKey}
              title={score !== undefined ? `Mood: ${score}/5` : undefined}
              className={`w-8 h-8 rounded flex items-center justify-center ${colorClass} ${ringClass}`}
            >
              <span className="text-xs text-gray-500 leading-none">{day}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
