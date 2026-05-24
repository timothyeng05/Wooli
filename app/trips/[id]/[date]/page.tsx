'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type DayData = { title: string | null; notes: string | null; date: string }

const SECTIONS: {
  key: string[]; icon: string; label: string
  bg: string; border: string; text: string
  dotColor: string; time: string; travel?: boolean; hotel?: boolean; car?: boolean
}[] = [
  { key: ['FLIGHT'],                    time: 'Depart', icon: '✈️', label: 'Flight',           bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700',   dotColor: '#0d9488', travel: true },
  { key: ['FAMILY FLIGHT'],             time: 'Arrive', icon: '✈️', label: 'Mom & Aunt Flight', bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-600',   dotColor: '#e11d48', travel: true },
  { key: ['TRANSPORT','TRANSPORTATION'],time: 'Travel',  icon: '🚄', label: 'Transport',        bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700',   dotColor: '#0d9488', travel: true },
  { key: ['RENTAL CAR'],                time: 'Car',    icon: '🚗', label: 'Rental Car',        bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dotColor: '#ea580c', car: true },
  { key: ['MORNING'],                   time: '8 AM',   icon: '☀️', label: 'Morning',   bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dotColor: '#94a3b8' },
  { key: ['AFTERNOON'],                 time: '2 PM',   icon: '🗺️', label: 'Afternoon', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dotColor: '#94a3b8' },
  { key: ['NIGHT'],                     time: '9 PM',   icon: '🌙', label: 'Night',     bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dotColor: '#94a3b8' },
  { key: ['LUNCH','LUNCH OPTIONS'],     time: '12 PM',  icon: '🍜', label: 'Lunch',     bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dotColor: '#d97706' },
  { key: ['DINNER','DINNER OPTIONS'],   time: '7 PM',   icon: '🍽️', label: 'Dinner',    bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dotColor: '#d97706' },
  { key: ['HOTEL'],                     time: 'Stay',   icon: '🏨', label: 'Hotel',     bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dotColor: '#7c3aed', hotel: true },
]

function matchSection(header: string) {
  const h = header.trim().toUpperCase()
  return SECTIONS.find(s => s.key.includes(h))
}

function parseSections(notes: string) {
  const lines = notes.split('\n')
  const sections: { meta: typeof SECTIONS[0]; lines: string[] }[] = []
  let current: { meta: typeof SECTIONS[0]; lines: string[] } | null = null

  for (const line of lines) {
    const meta = matchSection(line)
    if (meta) {
      if (current) sections.push(current)
      current = { meta, lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sections.push(current)
  return sections
}

function SectionCard({ meta, lines }: { meta: typeof SECTIONS[0]; lines: string[] }) {
  const allContent = lines.map(l => l.trim()).filter(Boolean)

  let duration: string | null = null
  let content = allContent
  if (meta.travel) {
    const dl = allContent.find(l => l.startsWith('~'))
    if (dl) {
      duration = dl.slice(1).trim()
      content = allContent.filter(l => !l.startsWith('~'))
    }
  }

  if (!content.length && !duration) return null
  return (
    <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 font-semibold text-sm ${meta.text}`}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
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

function HotelCard({ meta, lines }: { meta: typeof SECTIONS[0]; lines: string[] }) {
  const [open, setOpen] = useState(false)
  const content = lines.map(l => l.trim()).filter(Boolean)
  const name = content[0]
  const location = content[1]
  if (!name) return null
  const query = encodeURIComponent([name, location].filter(Boolean).join(', '))
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`
  const embedUrl = `https://maps.google.com/maps?q=${query}&output=embed&z=15`
  return (
    <div
      className={`rounded-xl border ${meta.bg} ${meta.border} overflow-hidden select-none`}
      onDoubleClick={() => setOpen(o => !o)}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-lg">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${meta.text}`}>{name}</p>
          {location && <p className="text-xs text-gray-500">{location}</p>}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{open ? 'double-tap to close' : 'double-tap for map'}</span>
      </div>
      {open && (
        <>
          <iframe
            src={embedUrl}
            className="w-full border-t border-gray-100"
            style={{ height: 220 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className={`px-4 py-2.5 border-t border-gray-100 ${meta.bg}`}>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm font-semibold ${meta.text} hover:underline`}
              onClick={e => e.stopPropagation()}
            >
              Open in Google Maps →
            </a>
          </div>
        </>
      )}
    </div>
  )
}

function TravelBanner({ sections }: { sections: ReturnType<typeof parseSections> }) {
  const travel = sections.filter(s => s.meta.travel)
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
            {duration && (
              <span className={`text-sm font-bold ${s.meta.text} flex-shrink-0`}>⏱ {duration}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function TripDayPage() {
  const params = useParams<{ id: string; date: string }>()
  const [trip, setTrip] = useState<{ name: string; start_date: string; end_date: string } | null>(null)
  const [days, setDays] = useState<DayData[]>([])
  const [allDates, setAllDates] = useState<string[]>([])
  const [form, setForm] = useState({ title: '', notes: '' })
  const [prevDate, setPrevDate] = useState<string | null>(null)
  const [nextDate, setNextDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: tripData }, { data: allDays }] = await Promise.all([
        supabase.from('trips').select('name, start_date, end_date').eq('id', params.id).single(),
        supabase.from('trip_days').select('date, title, notes').eq('trip_id', params.id).order('date'),
      ])

      setTrip(tripData)
      setDays(allDays ?? [])

      // Generate every date in the trip range for sidebar + prev/next
      const generated: string[] = []
      if (tripData) {
        const cur = new Date(tripData.start_date + 'T00:00:00')
        const end = new Date(tripData.end_date + 'T00:00:00')
        while (cur <= end) {
          generated.push(cur.toISOString().split('T')[0])
          cur.setDate(cur.getDate() + 1)
        }
      }
      setAllDates(generated)

      const currentIdx = generated.indexOf(params.date)
      setPrevDate(currentIdx > 0 ? generated[currentIdx - 1] : null)
      setNextDate(currentIdx < generated.length - 1 ? generated[currentIdx + 1] : null)

      const current = allDays?.find(d => d.date === params.date)
      if (current) {
        setForm({ title: current.title ?? '', notes: current.notes ?? '' })
      }
      setLoading(false)
    }
    load()
  }, [params.id, params.date])

  const updateWithAI = async () => {
    if (!aiInput.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/trips/update-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: aiInput,
          currentTitle: form.title,
          currentNotes: form.notes,
          date: params.date,
          tripId: params.id,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setForm({ title: data.title ?? form.title, notes: data.notes ?? form.notes })
        setAiInput('')
      } else {
        setAiError(data.error ?? `Error ${res.status}`)
      }
    } catch {
      setAiError('Network error — make sure the server is running')
    } finally {
      setAiLoading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('trip_days').upsert(
      { trip_id: params.id, user_id: user.id, date: params.date, title: form.title || null, notes: form.notes || null },
      { onConflict: 'trip_id,date' }
    )
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const dayNumber = trip
    ? Math.round((new Date(params.date + 'T00:00:00').getTime() - new Date(trip.start_date + 'T00:00:00').getTime()) / 86400000) + 1
    : null

  const dateLabel = new Date(params.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const sections = form.notes ? parseSections(form.notes) : []

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">Loading...</div>
  }

  const dayTitleMap = new Map(days.map(d => [d.date, d.title]))

  return (
    <div className="min-h-screen bg-white flex">

      {/* Sidebar — fixed below the main nav bar */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-gray-100 bg-gray-50 fixed top-16 left-0 h-[calc(100vh-4rem)] z-20">
        <div className="px-5 py-4 border-b border-gray-200">
          <Link href={`/trips/${params.id}`} className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition flex items-center gap-1">
            ← {trip?.name ?? 'Trip'}
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">{allDates.length} days</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-1">
          {allDates.map((date, i) => {
            const isActive = date === params.date
            const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            const title = dayTitleMap.get(date) ?? null
            return (
              <Link
                key={date}
                href={`/trips/${params.id}/${date}`}
                className={`flex items-center gap-3 px-5 py-3 transition ${
                  isActive ? 'bg-blue-600' : 'hover:bg-gray-100'
                }`}
              >
                <span className={`text-xs font-bold flex-shrink-0 w-12 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                  Day {i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{label}</p>
                  <p className={`text-sm font-medium leading-snug truncate ${isActive ? 'text-white' : title ? 'text-gray-800' : 'text-gray-400'}`}>
                    {title ?? '—'}
                  </p>
                </div>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-72">

      {/* Compact sticky header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          {/* Left: day info */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex-shrink-0 text-xs font-bold bg-blue-600 text-white rounded-full px-3 py-1 whitespace-nowrap">
              Day {dayNumber}
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 leading-tight truncate">
                {form.title || 'Untitled day'}
              </h1>
              <p className="text-xs text-gray-400 truncate">{dateLabel}</p>
            </div>
          </div>
          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {prevDate && (
              <Link
                href={`/trips/${params.id}/${prevDate}`}
                className="border border-gray-200 text-gray-500 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                ← Prev
              </Link>
            )}
            {nextDate && (
              <Link
                href={`/trips/${params.id}/${nextDate}`}
                className="border border-gray-200 text-gray-500 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                Next →
              </Link>
            )}
            <button
              onClick={() => setEditing(e => !e)}
              className="border border-gray-200 text-gray-600 font-medium px-4 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              {editing ? 'View' : 'Edit'}
            </button>
            {editing && (
              <button
                onClick={save}
                disabled={saving}
                className="bg-blue-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
              >
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {sections.length > 0 && <TravelBanner sections={sections} />}

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={aiInput}
              onChange={e => { setAiInput(e.target.value); setAiError(null) }}
              onKeyDown={e => e.key === 'Enter' && !aiLoading && updateWithAI()}
              placeholder="Tell AI what to change… e.g. swap lunch to ramen in Shibuya"
              className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${aiError ? 'border-red-400' : 'border-gray-300'}`}
            />
            <button
              onClick={updateWithAI}
              disabled={aiLoading || !aiInput.trim()}
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm flex-shrink-0"
            >
              {aiLoading ? 'Updating…' : 'Update'}
            </button>
          </div>
          {aiError && (
            <p className="text-xs text-red-600 px-1">⚠️ {aiError}</p>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Arrival in Tokyo"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={20}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
              />
            </div>
          </div>
        ) : sections.length > 0 ? (
          <div>
            {sections.map((s, i) => {
              const isLast = i === sections.length - 1
              return (
                <div key={i} className="flex gap-3">
                  {/* Time column */}
                  <div className="flex flex-col items-end flex-shrink-0 w-14 pt-3.5">
                    <span className="text-xs font-semibold text-gray-400 leading-none">{s.meta.time}</span>
                  </div>

                  {/* Dot + vertical line */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-3 h-3 rounded-full mt-3 flex-shrink-0 ring-2 ring-white shadow-sm"
                      style={{ backgroundColor: s.meta.dotColor }}
                    />
                    {!isLast && (
                      <div
                        className="flex-1 mt-1"
                        style={{
                          width: '2px',
                          minHeight: '24px',
                          background: s.meta.travel
                            ? 'repeating-linear-gradient(to bottom, #5eead4 0, #5eead4 5px, transparent 5px, transparent 10px)'
                            : '#e2e8f0',
                        }}
                      />
                    )}
                  </div>

                  {/* Card */}
                  <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                    {(s.meta.hotel || s.meta.car)
                      ? <HotelCard meta={s.meta} lines={s.lines} />
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
            <p className="text-sm">No plans yet for this day</p>
            <button onClick={() => setEditing(true)} className="mt-4 text-sm text-blue-600 hover:underline">Add notes</button>
          </div>
        )}
      </div>
      </div>{/* end main content */}
    </div>
  )
}
