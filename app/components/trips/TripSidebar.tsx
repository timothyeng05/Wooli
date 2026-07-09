'use client'
import { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ShareButton from '@/app/components/ShareButton'
import AiShareButton from '@/app/components/trips/AiShareButton'
import { LEG_COLORS, type Leg } from '@/lib/trips/trip-legs'
import { searchDays, MIN_QUERY_LENGTH } from '@/lib/trips/trip-search'

// rating is optional — the column arrives with migration 035 and callers read it off select('*').
export type DayRow = { date: string; title: string | null; notes: string | null; rating?: number | null }
export type SidePanel = 'hotels' | 'ate' | null

function fmt(date: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

// Small search input with a clear (✕ / Esc) affordance, shared look for the
// sidebar and the mobile day-picker sheet.
export function SidebarSearch({ query, onChange, placeholder }: {
  query: string; onChange: (q: string) => void; placeholder?: string
}) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">🔍</span>
      <input
        type="text"
        value={query}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onChange('') }}
        placeholder={placeholder ?? 'Search this trip'}
        aria-label="Search this trip"
        className="w-full border border-gray-200 rounded-lg bg-white pl-8 pr-7 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {query && (
        <button onClick={() => onChange('')} aria-label="Clear search"
          className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 text-gray-400 hover:text-gray-700 text-sm leading-none">✕</button>
      )}
    </div>
  )
}

function DayItem({ date, index, activeDate, todayLocal, title, rating, tripId, cardOver, dropLine }: {
  date: string; index: number; activeDate: string; todayLocal: string; title: string | null; rating: number | null; tripId: string; cardOver: boolean; dropLine: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: date, data: { type: 'day' } })
  const isActive = date === activeDate
  const isToday = date === todayLocal
  return (
    <div
      ref={setNodeRef}
      data-day={date}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-center ${isDragging ? 'opacity-60' : ''} ${cardOver ? 'ring-2 ring-inset ring-blue-500 bg-blue-50' : isActive ? 'bg-blue-600' : isToday ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
    >
      {dropLine && <div className="absolute left-0 right-0 -top-px h-0.5 bg-blue-500 z-10 rounded-full" />}
      <button {...attributes} {...listeners} title="Drag to swap days"
        className={`px-2 py-3 cursor-grab active:cursor-grabbing flex-shrink-0 ${isActive ? 'text-blue-200' : 'text-gray-300 hover:text-gray-500'}`}>⠿</button>
      <Link href={`/trips/${tripId}/${date}`} className="flex items-center gap-2 flex-1 min-w-0 pr-4 py-2.5">
        <span className={`text-xs font-bold flex-shrink-0 w-10 ${isActive ? 'text-blue-200' : isToday ? 'text-blue-500' : 'text-gray-400'}`}>Day {index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-xs ${isActive ? 'text-blue-200' : isToday ? 'text-blue-400' : 'text-gray-400'}`}>{fmt(date)}{isToday && !isActive ? ' · today' : ''}</p>
          <p className={`text-sm font-medium leading-snug truncate ${isActive ? 'text-white' : title ? 'text-gray-800' : 'text-gray-400'}`}>{title ?? '—'}</p>
        </div>
        {rating != null && (
          <span className={`text-[10px] font-semibold flex-shrink-0 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{rating}/10</span>
        )}
      </Link>
    </div>
  )
}

export default function TripSidebar({
  tripId, tripName, startDate, endDate, allDates, days, legs, activeDate, todayLocal, shareUrl,
  hotelCount, ateCount, activePanel, onOpenPanel, dragType, overDate, overDayDate, mobileOpen, onMobileClose,
}: {
  tripId: string; tripName: string; startDate: string; endDate: string
  allDates: string[]; days: DayRow[]; legs: Leg[]
  activeDate: string; todayLocal: string; shareUrl: string
  hotelCount: number; ateCount: number
  activePanel: SidePanel
  onOpenPanel: (p: SidePanel) => void
  dragType: 'day' | 'card' | null
  overDate: string | null
  overDayDate: string | null
  mobileOpen: boolean
  onMobileClose: () => void
}) {
  const titleMap = useMemo(() => new Map(days.map(d => [d.date, d.title])), [days])
  const ratingMap = useMemo(() => new Map(days.map(d => [d.date, d.rating ?? null])), [days])
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const searching = query.trim().length >= MIN_QUERY_LENGTH
  const matches = useMemo(
    // Guard against day rows outside the trip's date range (hidden by a date change).
    () => searchDays(days, query).filter(m => allDates.includes(m.date)),
    [days, query, allDates],
  )

  // Center the active day in the sidebar so neighbours are easy to reach.
  useEffect(() => {
    const c = scrollRef.current
    const el = c?.querySelector(`[data-day="${activeDate}"]`) as HTMLElement | null
    if (c && el) {
      const er = el.getBoundingClientRect(), cr = c.getBoundingClientRect()
      c.scrollTop += (er.top - cr.top) - (c.clientHeight / 2 - el.clientHeight / 2)
    }
  }, [activeDate, collapsed])

  const { label, progressPct } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const s = new Date(startDate + 'T00:00:00'); const e = new Date(endDate + 'T00:00:00')
    const day = 86400000
    if (today < s) {
      const d = Math.round((s.getTime() - today.getTime()) / day)
      return { label: `${d} day${d !== 1 ? 's' : ''} until departure`, progressPct: 0 as number | null }
    }
    if (today <= e) {
      const n = Math.round((today.getTime() - s.getTime()) / day) + 1
      return { label: `In progress · Day ${n} of ${allDates.length}`, progressPct: Math.min(100, Math.round(((today.getTime() - s.getTime()) / (e.getTime() - s.getTime())) * 100)) }
    }
    const d = Math.round((today.getTime() - e.getTime()) / day)
    return { label: `Completed · ${d} day${d !== 1 ? 's' : ''} ago`, progressPct: null as number | null }
  }, [startDate, endDate, allDates.length])

  const groups = legs.length
    ? legs.map(leg => ({ leg, dates: allDates.filter(d => d >= leg.from && d <= leg.to) })).filter(g => g.dates.length > 0)
    : [{ leg: null as null | { name: string; emoji: string }, dates: allDates }]
  const visibleDates = groups.flatMap((g, gi) => collapsed.has(gi) ? [] : g.dates)
  const toggleLeg = (gi: number) => setCollapsed(prev => {
    const next = new Set(prev); next.has(gi) ? next.delete(gi) : next.add(gi); return next
  })

  const summaryCard = (key: 'hotels' | 'ate', icon: string, title: string, count: number) => (
    <button
      onClick={() => onOpenPanel(activePanel === key ? null : key)}
      className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${activePanel === key ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1 text-sm font-semibold text-gray-700">{title}</span>
      <span className="text-xs font-semibold text-gray-400">{count}</span>
      <span className="text-gray-300 text-xs">›</span>
    </button>
  )

  return (
    <>
    {/* Mobile backdrop */}
    <div
      className={`fixed inset-0 top-[49px] bg-black/30 z-30 lg:hidden transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={onMobileClose}
    />
    <aside className={`flex flex-col w-72 border-r border-gray-100 bg-gray-50 fixed top-[49px] left-0 h-[calc(100vh-49px)] z-40 lg:z-20 transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Header: back, name, progress, share */}
      <div className="px-5 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <Link href="/trips" className="text-xs font-semibold text-gray-400 hover:text-blue-600 transition">← Trips</Link>
          <div className="flex items-center gap-2">
            <ShareButton url={shareUrl} />
            <Link href={`/trips/${tripId}/settings`} title="Trip settings" aria-label="Trip settings"
              className="text-gray-400 hover:text-gray-700 text-base leading-none px-0.5 transition">⚙</Link>
            <button onClick={onMobileClose} className="lg:hidden text-gray-400 hover:text-gray-700 text-lg leading-none px-1" aria-label="Close menu">✕</button>
          </div>
        </div>
        <h1 className="text-base font-bold text-gray-900 mt-1 leading-tight">{tripName}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {progressPct !== null && (
          <div className="w-full h-1 bg-gray-200 rounded mt-1.5 overflow-hidden">
            <div className="h-full bg-blue-500 rounded transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        )}
        {/* Own row — the header row is too tight for a second chip at w-72 */}
        <div className="mt-2">
          <AiShareButton path={`/share/${tripId}/export?format=md`} />
        </div>
      </div>

      {/* Hotels + What we ate cards */}
      <div className="px-3 py-2.5 space-y-1.5 border-b border-gray-200">
        {summaryCard('hotels', '🏨', 'Hotels', hotelCount)}
        {summaryCard('ate', '🍴', 'What we ate', ateCount)}
      </div>

      {/* Trip-wide search over day titles + section content */}
      <div className="px-3 py-2 border-b border-gray-200">
        <SidebarSearch query={query} onChange={setQuery} />
      </div>

      {/* Days (legs-grouped & collapsible, drag to swap) */}
      <div className="flex-1 overflow-y-auto pb-24 lg:pb-3" ref={scrollRef}>
        {searching ? (
          /* Flat results — plain links, deliberately outside the SortableContext
             so an active search can't interfere with drag-to-swap. */
          <div>
            {matches.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">No matches</p>}
            {matches.map(m => (
              <Link key={m.date} href={`/trips/${tripId}/${m.date}`} onClick={() => setQuery('')}
                className={`flex items-center gap-2 px-4 py-2.5 ${m.date === activeDate ? 'bg-blue-600' : 'hover:bg-gray-100'}`}>
                <span className={`text-xs font-bold w-10 flex-shrink-0 ${m.date === activeDate ? 'text-blue-200' : 'text-gray-400'}`}>Day {allDates.indexOf(m.date) + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs ${m.date === activeDate ? 'text-blue-200' : 'text-gray-400'}`}>{fmt(m.date)}</p>
                  <p className={`text-sm font-medium leading-snug truncate ${m.date === activeDate ? 'text-white' : 'text-gray-800'}`}>{m.snippet}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
        <SortableContext items={visibleDates} strategy={verticalListSortingStrategy}>
          {groups.map((g, gi) => {
            const c = LEG_COLORS[gi % LEG_COLORS.length]
            const isCollapsed = collapsed.has(gi)
            return (
              <div key={gi}>
                {g.leg && (
                  <button
                    onClick={() => toggleLeg(gi)}
                    className={`w-full flex items-center gap-2 px-4 py-1.5 ${c.bg} border-y ${c.border} sticky top-0 z-10`}
                  >
                    <span className={`text-gray-400 text-[10px] transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▼</span>
                    <span className="text-sm">{g.leg.emoji}</span>
                    <span className={`text-xs font-bold ${c.text}`}>{g.leg.name}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{g.dates.length}d</span>
                  </button>
                )}
                {!isCollapsed && g.dates.map(date => (
                  <DayItem key={date} date={date} index={allDates.indexOf(date)} activeDate={activeDate}
                    todayLocal={todayLocal} title={titleMap.get(date) ?? null} rating={ratingMap.get(date) ?? null} tripId={tripId}
                    cardOver={dragType === 'card' && overDate === date}
                    dropLine={dragType === 'day' && overDayDate === date} />
                ))}
              </div>
            )
          })}
        </SortableContext>
        )}
      </div>
    </aside>
    </>
  )
}
