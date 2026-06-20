import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { notesToSectionData, findMeta, SectionMeta } from '@/lib/trips/trip-sections'
import { MEAL_TYPES } from '@/lib/trips/trip-utils'
import { TRIP_LEGS, LEG_COLORS, type Leg } from '@/app/trips/legs-config'
import ShareDayPicker from '@/app/components/trips/ShareDayPicker'

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function generateDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const cur = new Date(startDate + 'T00:00:00'); const end = new Date(endDate + 'T00:00:00')
  while (cur <= end) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1) }
  return days
}
function groupByLegs(allDays: string[], legs: Leg[]) {
  if (!legs.length) return [{ leg: null as Leg | null, days: allDays }]
  return legs.map(leg => ({ leg, days: allDays.filter(d => d >= leg.from && d <= leg.to) })).filter(g => g.days.length > 0)
}
function fmt(date: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

function LocationCard({ meta, lines }: { meta: SectionMeta; lines: string[] }) {
  const content = lines.map(l => l.trim()).filter(Boolean)
  const name = content[0]; const location = content[1]
  if (!name) return null
  const query = encodeURIComponent([name, location].filter(Boolean).join(', '))
  return (
    <div className={`rounded-xl border ${meta.bg} ${meta.border}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-lg">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${meta.text}`}>{name}</p>
          {location && <p className="text-xs text-gray-500">{location}</p>}
        </div>
        <a href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noopener noreferrer"
          className={`text-xs font-semibold ${meta.text} hover:underline flex-shrink-0`}>Maps →</a>
      </div>
    </div>
  )
}

function SectionCard({ meta, lines, title, place }: { meta: SectionMeta; lines: string[]; title?: string; place?: string }) {
  const allContent = lines.map(l => l.trim()).filter(Boolean)
  let duration: string | null = null
  let content = allContent
  const dl = allContent.find(l => l.startsWith('~'))
  if (dl) { duration = dl.slice(1).trim(); content = allContent.filter(l => !l.startsWith('~')) }
  const headerText = title || content.find(l => !l.startsWith('-')) || meta.label
  const body = title ? content : content.filter(l => l !== headerText)
  if (!body.length && !duration && !place) return null
  return (
    <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 font-semibold text-sm ${meta.text}`}><span>{meta.icon}</span><span>{headerText}</span></div>
        {duration && <span className="text-xs font-semibold bg-teal-100 text-teal-700 rounded-full px-2.5 py-1 flex items-center gap-1"><span>⏱</span> {duration}</span>}
      </div>
      {place && <p className="text-sm text-gray-500 mb-1.5 flex items-center gap-1"><span className="text-xs">📍</span>{place}</p>}
      {body.length > 0 && (
        <ul className="space-y-1.5">
          {body.map((line, i) => {
            const isBullet = line.startsWith('-')
            return (
              <li key={i} className={`text-sm text-gray-700 flex gap-2 ${isBullet ? 'items-start' : 'items-center'}`}>
                {isBullet && <span className="text-gray-300 mt-0.5 flex-shrink-0">•</span>}
                <span>{isBullet ? line.slice(1).trim() : line}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default async function ShareDayPage({ params }: { params: Promise<{ id: string; date: string }> }) {
  const { id, date } = await params
  const supabase = serviceClient()

  const [{ data: trip }, { data: dayRows }, { data: hotels }] = await Promise.all([
    supabase.from('trips').select('name, start_date, end_date').eq('id', id).single(),
    supabase.from('trip_days').select('date, title, notes').eq('trip_id', id).order('date'),
    supabase.from('trip_hotels').select('name, check_in, check_out').eq('trip_id', id).order('check_in'),
  ])
  if (!trip) notFound()

  const allDates = generateDays(trip.start_date, trip.end_date)
  const titleMap = new Map((dayRows ?? []).map(d => [d.date, d.title]))
  const groups = groupByLegs(allDates, TRIP_LEGS[id] ?? [])
  const dayData = (dayRows ?? []).find(d => d.date === date)

  const currentIdx = allDates.indexOf(date)
  const prevDate = allDates[currentIdx - 1] ?? null
  const nextDate = allDates[currentIdx + 1] ?? null
  const dayNumber = currentIdx + 1
  const dateLabel = fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // What we ate (past meals, ranked)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const ate: { name: string; rating?: number }[] = []
  for (const d of dayRows ?? []) {
    if (new Date(d.date + 'T00:00:00') >= today || !d.notes) continue
    for (const s of notesToSectionData(d.notes)) {
      if (!MEAL_TYPES.has(s.type.toUpperCase())) continue
      const name = s.lines.find(l => l.trim() && !l.trim().startsWith('-'))?.trim()
      if (name) ate.push({ name, rating: s.rating })
    }
  }
  ate.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))

  const sections = notesToSectionData(dayData?.notes ?? null)
    .map(s => ({ ...s, meta: findMeta(s.type) }))
    .filter((s): s is typeof s & { meta: SectionMeta } => !!s.meta)

  return (
    <div className="min-h-screen bg-white flex">
      {/* Read-only sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-gray-100 bg-gray-50 fixed top-0 left-0 h-screen z-20">
        <div className="px-5 py-3 border-b border-gray-200">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">👁 View only</span>
          <h1 className="text-base font-bold text-gray-900 mt-1 leading-tight">{trip.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{fmt(trip.start_date)} – {fmt(trip.end_date)}</p>
        </div>

        <div className="px-3 py-2.5 space-y-1.5 border-b border-gray-200">
          <details className="rounded-lg border border-gray-200 bg-white">
            <summary className="flex items-center gap-2.5 px-3 py-2 cursor-pointer list-none"><span>🏨</span><span className="flex-1 text-sm font-semibold text-gray-700">Hotels</span><span className="text-xs text-gray-400">{hotels?.length ?? 0}</span></summary>
            <div className="px-3 pb-2 space-y-1">
              {(hotels ?? []).map((h, i) => (
                <div key={i} className="text-xs"><span className="font-medium text-gray-700">{h.name}</span><span className="text-gray-400"> · {fmt(h.check_in)}–{fmt(h.check_out)}</span></div>
              ))}
              {!hotels?.length && <p className="text-xs text-gray-400">No hotels</p>}
            </div>
          </details>
          <details className="rounded-lg border border-gray-200 bg-white">
            <summary className="flex items-center gap-2.5 px-3 py-2 cursor-pointer list-none"><span>🍴</span><span className="flex-1 text-sm font-semibold text-gray-700">What we ate</span><span className="text-xs text-gray-400">{ate.length}</span></summary>
            <div className="px-3 pb-2 space-y-1">
              {ate.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs"><span className="flex-1 text-gray-700 truncate">{m.name}</span>{m.rating != null && <span className="text-gray-400">{m.rating}/10</span>}</div>
              ))}
              {!ate.length && <p className="text-xs text-gray-400">Nothing yet</p>}
            </div>
          </details>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {groups.map((g, gi) => {
            const c = LEG_COLORS[gi % LEG_COLORS.length]
            return (
              <div key={gi}>
                {g.leg && (
                  <div className={`flex items-center gap-2 px-4 py-1.5 ${c.bg} border-y ${c.border}`}>
                    <span className="text-sm">{g.leg.emoji}</span><span className={`text-xs font-bold ${c.text}`}>{g.leg.name}</span>
                  </div>
                )}
                {g.days.map(d => {
                  const isActive = d === date
                  return (
                    <Link key={d} href={`/share/${id}/${d}`} className={`flex items-center gap-2 px-5 py-2.5 ${isActive ? 'bg-blue-600' : 'hover:bg-gray-100'}`}>
                      <span className={`text-xs font-bold w-10 flex-shrink-0 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>Day {allDates.indexOf(d) + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{fmt(d)}</p>
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : titleMap.get(d) ? 'text-gray-800' : 'text-gray-400'}`}>{titleMap.get(d) ?? '—'}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-72">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-6 py-6 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="hidden lg:inline-block text-xs font-bold bg-blue-600 text-white rounded-full px-3 py-1">Day {dayNumber}</span>
                <ShareDayPicker
                  id={id}
                  days={allDates.map(d => ({ date: d, title: titleMap.get(d) ?? null }))}
                  activeDate={date}
                  dayNumber={dayNumber}
                  total={allDates.length}
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{dayData?.title || dateLabel}</h1>
              <p className="text-sm text-gray-400 mt-1">{dateLabel}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {prevDate && <Link href={`/share/${id}/${prevDate}`} aria-label="Previous day" className="border border-gray-300 text-gray-600 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition text-sm">←</Link>}
              {nextDate && <Link href={`/share/${id}/${nextDate}`} aria-label="Next day" className="border border-gray-300 text-gray-600 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition text-sm">→</Link>}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-5 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-10">
          {sections.length > 0 ? (
            <div>
              {sections.map((s, i) => {
                const isLast = i === sections.length - 1
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-end flex-shrink-0 w-14 pt-3.5">
                      <span className="text-xs font-semibold text-gray-400 leading-none">{s.timeOverride || s.meta.time}</span>
                    </div>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-3 h-3 rounded-full mt-3 flex-shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: s.meta.dotColor }} />
                      {!isLast && <div className="flex-1 mt-1" style={{ width: '2px', minHeight: '24px', background: s.meta.travel ? `repeating-linear-gradient(to bottom, ${s.meta.dotColor} 0, ${s.meta.dotColor} 5px, transparent 5px, transparent 10px)` : '#e2e8f0' }} />}
                    </div>
                    <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                      {(s.meta.hotel || s.meta.car) ? <LocationCard meta={s.meta} lines={s.lines} /> : <SectionCard meta={s.meta} lines={s.lines} title={s.title} place={s.place} />}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">📋</p><p className="text-sm">No plans for this day yet</p></div>
          )}
        </div>
      </div>
    </div>
  )
}
