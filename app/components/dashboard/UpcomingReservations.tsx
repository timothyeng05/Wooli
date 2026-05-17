import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const RESERVATION_TYPES = [
  { keys: ['FLIGHT', 'FAMILY FLIGHT'], icon: '✈️', label: 'Flight', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  { keys: ['TRANSPORT', 'TRANSPORTATION'], icon: '🚄', label: 'Transport', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  { keys: ['HOTEL'], icon: '🏨', label: 'Hotel', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  { keys: ['RENTAL CAR'], icon: '🚗', label: 'Rental Car', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
]

function extractReservation(notes: string) {
  const lines = notes.split('\n')
  const results: { type: typeof RESERVATION_TYPES[number]; summary: string }[] = []
  let currentType: typeof RESERVATION_TYPES[number] | null = null
  let currentLines: string[] = []

  const flush = () => {
    if (!currentType) return
    const content = currentLines.map(l => l.trim()).filter(Boolean).filter(l => !l.startsWith('~'))
    const route = content.find(l => l.includes('→')) ?? content[0]
    if (route) results.push({ type: currentType, summary: route.replace(/^-\s*/, '') })
  }

  for (const line of lines) {
    const header = line.trim().toUpperCase()
    const matched = RESERVATION_TYPES.find(t => t.keys.includes(header))
    if (matched) {
      flush()
      currentType = matched
      currentLines = []
    } else if (currentType) {
      currentLines.push(line)
    }
  }
  flush()
  return results
}

export default async function UpcomingReservations({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().split('T')[0]
  const in14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

  const { data: trips } = await supabase
    .from('trips')
    .select('id, name')
    .eq('user_id', userId)
    .gte('end_date', today)

  if (!trips?.length) return null

  const tripIds = trips.map(t => t.id)
  const tripMap = new Map(trips.map(t => [t.id, t.name]))

  const { data: days } = await supabase
    .from('trip_days')
    .select('trip_id, date, notes')
    .in('trip_id', tripIds)
    .gte('date', today)
    .lte('date', in14Days)
    .not('notes', 'is', null)
    .order('date')

  if (!days?.length) return null

  const reservations: { date: string; tripId: string; tripName: string; type: typeof RESERVATION_TYPES[number]; summary: string }[] = []

  for (const day of days) {
    if (!day.notes) continue
    const found = extractReservation(day.notes)
    for (const r of found) {
      reservations.push({
        date: day.date,
        tripId: day.trip_id,
        tripName: tripMap.get(day.trip_id) ?? '',
        ...r,
      })
    }
  }

  if (!reservations.length) return null

  const formatDate = (date: string) => {
    const d = new Date(date + 'T00:00:00')
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    if (date === today) return 'Today'
    if (date === tomorrow) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Upcoming</h3>
      <div className="space-y-2">
        {reservations.map((r, i) => (
          <Link key={i} href={`/trips/${r.tripId}/${r.date}`}>
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${r.type.bg} ${r.type.border} hover:opacity-80 transition`}>
              <span className="text-base flex-shrink-0">{r.type.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${r.type.color}`}>{r.type.label}</p>
                <p className="text-sm text-gray-800 truncate">{r.summary}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(r.date)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
