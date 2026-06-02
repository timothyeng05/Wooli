'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ACTIVITY_CONFIG, type ActivityName } from '@/lib/activity-config'
import { MOOD_BG, MOOD_LABELS, type MoodEntry } from '@/lib/mood-utils'
import {
  isActualPeriodDay,
  isPredictedPeriodDay,
  FLOW_COLORS,
  type PeriodEntry,
} from '@/lib/period-utils'
import type { GCalData } from '@/lib/google-calendar'

export default function LifeCalendar({
  initialMoodEntries,
  initialPeriodEntries,
  initialGCalData = { calendars: [], eventsByDate: {} },
}: {
  initialMoodEntries: MoodEntry[]
  initialPeriodEntries: PeriodEntry[]
  initialGCalData?: GCalData
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>(initialMoodEntries)
  const [periodEntries, setPeriodEntries] = useState<PeriodEntry[]>(initialPeriodEntries)
  const [gcalData, setGcalData] = useState<GCalData>(initialGCalData)
  const [enabledCalIds, setEnabledCalIds] = useState<Set<string>>(() => new Set(initialGCalData.calendars.map(c => c.id)))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const isCurrent = year === today.getFullYear() && month === today.getMonth()
    if (isCurrent) {
      setMoodEntries(initialMoodEntries)
      setPeriodEntries(initialPeriodEntries)
      return
    }
    setLoading(true)
    fetch(`/api/calendar?year=${year}&month=${month + 1}`)
      .then(r => r.json())
      .then(d => {
        setMoodEntries(d.moodEntries || [])
        setPeriodEntries(d.periodEntries || [])
        if (d.gcalData) {
          setGcalData(d.gcalData)
          setEnabledCalIds(new Set(d.gcalData.calendars.map((c: { id: string }) => c.id)))
        }
      })
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

  const moodByDate = new Map<string, MoodEntry>()
  moodEntries.forEach(e => moodByDate.set(e.logged_at.split('T')[0], e))

  const cells: Array<null | { day: number; dateStr: string; date: Date }> = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return { day: d, dateStr, date: new Date(year, month, d) }
    }),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className={loading ? 'opacity-60 pointer-events-none' : ''}>
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

      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />

          const mood = moodByDate.get(cell.dateStr)
          const periodToday = isActualPeriodDay(periodEntries, cell.date)
          const predicted = isPredictedPeriodDay(periodEntries, cell.date)
          const isToday = cell.dateStr === todayStr
          const isFuture = cell.dateStr > todayStr
          const hasNotes = !!(mood && (mood.note || mood.grateful_for))
          const activities = (mood?.activities || []).filter(a => a in ACTIVITY_CONFIG) as ActivityName[]

          const gcalEvents = (gcalData.eventsByDate[cell.dateStr] ?? []).filter(e => enabledCalIds.has(e.calendarId))
          const gcalTitles = gcalEvents.map(e => e.title)

          const bgColor = mood
            ? MOOD_BG[mood.mood]
            : isFuture ? 'bg-gray-50' : 'bg-gray-100 hover:bg-gray-200'

          const ring = isToday
            ? 'ring-2 ring-blue-500 ring-offset-1'
            : predicted
              ? 'border-2 border-dashed border-blue-400'
              : ''

          const cursor = isFuture ? 'cursor-default' : 'cursor-pointer'

          const flowColor = periodToday ? FLOW_COLORS[periodToday.flow_level || 'medium'] : null

          const gcalTooltip = gcalTitles.join(', ')
          const tooltip =
            mood
              ? `${MOOD_LABELS[mood.mood]}${mood.note ? ' — ' + mood.note.slice(0, 60) : ''}${gcalTooltip ? '\n' + gcalTooltip : ''}`
              : gcalTooltip || (periodToday ? 'Period day' : '')

          const inner = (
            <div
              className={`relative aspect-square w-full rounded-lg transition select-none overflow-hidden ${bgColor} ${ring} ${cursor}`}
              title={tooltip}
            >
              {/* Day number */}
              <span className="absolute top-1 left-1.5 text-xs font-medium text-gray-700 leading-none">
                {cell.day}
              </span>

              {/* Notes indicator */}
              {hasNotes && (
                <span className="absolute top-1 right-1 text-[8px] text-gray-600">✏️</span>
              )}

              {/* Activity emojis (spread full-width) */}
              {activities.length > 0 && (
                <div className="absolute left-1 right-1 bottom-1.5 flex justify-around items-center text-[10px] leading-none">
                  {activities.map(a => (
                    <span key={a} aria-label={a}>
                      {ACTIVITY_CONFIG[a].emoji}
                    </span>
                  ))}
                </div>
              )}

              {/* Google Calendar dots */}
              {gcalEvents.length > 0 && (
                <div className="absolute bottom-1 right-1 flex gap-0.5">
                  {gcalEvents.slice(0, 3).map((e, i) => {
                    const cal = gcalData.calendars.find(c => c.id === e.calendarId)
                    return <span key={i} className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: cal?.color ?? '#3b82f6' }} />
                  })}
                </div>
              )}

              {/* Period flow bar */}
              {flowColor && (
                <div
                  className="absolute left-0 right-0 bottom-0 h-[3px]"
                  style={{ backgroundColor: flowColor }}
                />
              )}
            </div>
          )

          if (mood) return <Link key={cell.dateStr} href={`/mood/${mood.id}`}>{inner}</Link>
          if (!isFuture) return <Link key={cell.dateStr} href={`/mood/new?date=${cell.dateStr}`}>{inner}</Link>
          return <div key={cell.dateStr}>{inner}</div>
        })}
      </div>

      {/* Calendar toggles */}
      {gcalData.calendars.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {gcalData.calendars.map(cal => {
            const enabled = enabledCalIds.has(cal.id)
            return (
              <button
                key={cal.id}
                onClick={() => setEnabledCalIds(prev => {
                  const next = new Set(prev)
                  if (next.has(cal.id)) next.delete(cal.id)
                  else next.add(cal.id)
                  return next
                })}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition ${enabled ? 'text-white' : 'border-gray-200 text-gray-400 bg-white'}`}
                style={enabled ? { backgroundColor: cal.color, borderColor: cal.color } : {}}
              >
                {cal.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400">Mood:</span>
          {([1, 2, 3, 4, 5] as const).map(n => (
            <span key={n} className="text-xs flex items-center gap-1">
              <span className={`inline-block w-3 h-3 rounded-sm ${MOOD_BG[n]}`} />
              <span className="text-gray-500">{MOOD_LABELS[n]}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400">Activity:</span>
          {(Object.keys(ACTIVITY_CONFIG) as ActivityName[]).map(a => (
            <span key={a} className="text-xs flex items-center gap-1">
              <span>{ACTIVITY_CONFIG[a].emoji}</span>
              <span className="text-gray-500">{a}</span>
            </span>
          ))}
          <span className="text-xs flex items-center gap-1">
            <span>✏️</span>
            <span className="text-gray-500">Has notes</span>
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400">Period:</span>
          <span className="text-xs flex items-center gap-1">
            <span className="inline-block w-3 h-1 rounded-sm" style={{ backgroundColor: FLOW_COLORS.medium }} />
            <span className="text-gray-500">Logged</span>
          </span>
          <span className="text-xs flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm border border-dashed border-blue-400" />
            <span className="text-gray-500">Predicted</span>
          </span>
        </div>
      </div>
    </div>
  )
}
