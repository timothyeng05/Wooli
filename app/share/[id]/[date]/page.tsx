import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { parseSectionsFromNotes, ParsedSection, SectionMeta } from '@/lib/trip-sections'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function TravelBanner({ sections }: { sections: ParsedSection[] }) {
  const travel = sections.filter(s => s.meta.banner)
  if (!travel.length) return null
  return (
    <div className="space-y-2">
      {travel.map((s, i) => {
        const lines = s.lines.map(l => l.trim()).filter(Boolean)
        const duration = lines.find(l => l.startsWith('~'))?.slice(1).trim()
        const content = lines.filter(l => !l.startsWith('~')).map(l => l.replace(/^-\s*/, ''))
        const route = content.find(l => l.includes('→'))
        const detail = content.find(l => l !== route)
        return (
          <div key={i} className={`rounded-xl border px-5 py-4 ${s.meta.bg} ${s.meta.border} flex items-center gap-4`}>
            <span className="text-2xl flex-shrink-0">{s.meta.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-wide ${s.meta.text} mb-0.5`}>{s.meta.label}</p>
              {route && <p className="text-base font-bold text-gray-900 leading-snug">{route}</p>}
              {detail && <p className="text-xs text-gray-500 mt-0.5 truncate">{detail}</p>}
            </div>
            {duration && <span className={`text-sm font-bold ${s.meta.text} flex-shrink-0`}>⏱ {duration}</span>}
          </div>
        )
      })}
    </div>
  )
}

function LocationCard({ meta, lines }: { meta: SectionMeta; lines: string[] }) {
  const content = lines.map(l => l.trim()).filter(Boolean)
  const name = content[0]
  const location = content[1]
  if (!name) return null
  const query = encodeURIComponent([name, location].filter(Boolean).join(', '))
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`
  return (
    <div className={`rounded-xl border ${meta.bg} ${meta.border}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-lg">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${meta.text}`}>{name}</p>
          {location && <p className="text-xs text-gray-500">{location}</p>}
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs font-semibold ${meta.text} hover:underline flex-shrink-0`}
        >
          Maps →
        </a>
      </div>
    </div>
  )
}

function SectionCard({ meta, lines }: { meta: SectionMeta; lines: string[] }) {
  const allContent = lines.map(l => l.trim()).filter(Boolean)
  let duration: string | null = null
  let content = allContent
  if (meta.travel) {
    const dl = allContent.find(l => l.startsWith('~'))
    if (dl) { duration = dl.slice(1).trim(); content = allContent.filter(l => !l.startsWith('~')) }
  }
  if (!content.length && !duration) return null
  return (
    <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 font-semibold text-sm ${meta.text}`}>
          <span>{meta.icon}</span><span>{meta.label}</span>
        </div>
        {duration && (
          <span className="text-xs font-semibold bg-teal-100 text-teal-700 rounded-full px-2.5 py-1 flex items-center gap-1">
            <span>⏱</span> {duration}
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {content.map((line, i) => {
          const isBullet = line.startsWith('-')
          const text = isBullet ? line.slice(1).trim() : line
          return (
            <li key={i} className={`text-sm text-gray-700 flex gap-2 ${isBullet ? 'items-start' : 'items-center'}`}>
              {isBullet && <span className="text-gray-300 mt-0.5 flex-shrink-0">•</span>}
              <span>{text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default async function ShareDayPage({ params }: { params: Promise<{ id: string; date: string }> }) {
  const { id, date } = await params
  const supabase = serviceClient()

  const [{ data: trip }, { data: allDays }, { data: dayData }] = await Promise.all([
    supabase.from('trips').select('name, start_date').eq('id', id).single(),
    supabase.from('trip_days').select('date').eq('trip_id', id).order('date'),
    supabase.from('trip_days').select('title, notes').eq('trip_id', id).eq('date', date).single(),
  ])

  if (!trip) notFound()

  const dates = allDays?.map(d => d.date) ?? []
  const currentIdx = dates.indexOf(date)
  const prevDate = dates[currentIdx - 1] ?? null
  const nextDate = dates[currentIdx + 1] ?? null
  const dayNumber = Math.round(
    (new Date(date + 'T00:00:00').getTime() - new Date(trip.start_date + 'T00:00:00').getTime()) / 86400000
  ) + 1
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const sections = parseSectionsFromNotes(dayData?.notes ?? null)

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Link href={`/share/${id}`} className="text-sm text-blue-600 hover:underline">
              ← {trip.name}
            </Link>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-white border border-gray-200 rounded-full px-3 py-1">
              <span>👁</span> View only
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block text-xs font-bold bg-blue-600 text-white rounded-full px-3 py-1 mb-2">Day {dayNumber}</span>
              <h1 className="text-3xl font-bold text-gray-900">{dayData?.title || dateLabel}</h1>
              <p className="text-sm text-gray-400 mt-1">{dateLabel}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {prevDate && (
                <Link href={`/share/${id}/${prevDate}`} className="border border-gray-300 text-gray-600 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition text-sm">
                  ← Prev
                </Link>
              )}
              {nextDate && (
                <Link href={`/share/${id}/${nextDate}`} className="border border-gray-300 text-gray-600 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition text-sm">
                  Next →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {sections.length > 0 && <TravelBanner sections={sections} />}

        {sections.length > 0 ? (
          <div>
            {sections.map((s, i) => {
              const isLast = i === sections.length - 1
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-end flex-shrink-0 w-14 pt-3.5">
                    <span className="text-xs font-semibold text-gray-400 leading-none">{s.meta.time}</span>
                  </div>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-3 h-3 rounded-full mt-3 flex-shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: s.meta.dotColor }} />
                    {!isLast && (
                      <div className="flex-1 mt-1" style={{
                        width: '2px', minHeight: '24px',
                        background: s.meta.travel
                          ? `repeating-linear-gradient(to bottom, ${s.meta.dotColor} 0, ${s.meta.dotColor} 5px, transparent 5px, transparent 10px)`
                          : '#e2e8f0',
                      }} />
                    )}
                  </div>
                  <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                    {(s.meta.hotel || s.meta.car)
                      ? <LocationCard meta={s.meta} lines={s.lines} />
                      : <SectionCard meta={s.meta} lines={s.lines} />
                    }
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">No plans for this day yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
