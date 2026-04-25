'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface MoodEntry {
  id: string
  mood: number
  logged_at: string
}

const MOOD_BG: Record<number, string> = {
  1: 'bg-red-200',
  2: 'bg-orange-200',
  3: 'bg-yellow-200',
  4: 'bg-lime-200',
  5: 'bg-green-200',
}
const MOOD_EMOJI: Record<number, string> = { 1: '😢', 2: '😕', 3: '😐', 4: '😊', 5: '😄' }

export default function MoodCalendar({ initialEntries }: { initialEntries: MoodEntry[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [entries, setEntries] = useState<MoodEntry[]>(initialEntries)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const isCurrent = year === today.getFullYear() && month === today.getMonth()
    if (isCurrent) { setEntries(initialEntries); return }
    setLoading(true)
    fetch(`/api/mood?year=${year}&month=${month + 1}`)
      .then(r => r.json())
      .then(d => setEntries(d.entries || []))
      .finally(() => setLoading(false))
  }, [year, month])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = today.toISOString().split('T')[0]
  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  const entryByDate = new Map<string, MoodEntry>()
  entries.forEach(e => {
    entryByDate.set(e.logged_at.split('T')[0], e)
  })

  const cells: Array<null | { day: number; dateStr: string }> = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return { day: d, dateStr }
    })
  ]

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className={loading ? 'opacity-60 pointer-events-none' : ''}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-600 text-lg"
        >
          ‹
        </button>
        <span className="font-semibold text-gray-900">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-600 text-lg"
        >
          ›
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />

          const entry = entryByDate.get(cell.dateStr)
          const isToday = cell.dateStr === todayStr
          const isFuture = cell.dateStr > todayStr

          const base = 'relative flex flex-col items-center justify-center rounded-lg transition select-none'
          const size = 'aspect-square w-full'
          const color = entry
            ? MOOD_BG[entry.mood]
            : isFuture ? 'bg-gray-50' : 'bg-gray-100 hover:bg-gray-200'
          const ring = isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''
          const cursor = isFuture ? 'cursor-default' : 'cursor-pointer'

          const inner = (
            <div className={`${base} ${size} ${color} ${ring} ${cursor}`}>
              <span className="text-xs font-medium text-gray-700 leading-none">{cell.day}</span>
              {entry && <span className="text-sm leading-none mt-px">{MOOD_EMOJI[entry.mood]}</span>}
            </div>
          )

          if (entry) return <Link key={cell.dateStr} href={`/mood/${entry.id}`}>{inner}</Link>
          if (!isFuture) return <Link key={cell.dateStr} href={`/mood/new?date=${cell.dateStr}`}>{inner}</Link>
          return <div key={cell.dateStr}>{inner}</div>
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">Mood:</span>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} className="text-xs flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm ${MOOD_BG[n]}`} />
            {MOOD_EMOJI[n]}
          </span>
        ))}
        <span className="text-xs text-gray-400 ml-auto">Click empty day to log</span>
      </div>
    </div>
  )
}
