import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function TripWidget({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date')
    .eq('user_id', userId)
    .gte('end_date', today)
    .order('start_date')
    .limit(1)

  const trip = trips?.[0]
  if (!trip) return null

  const fromDate = today >= trip.start_date ? today : trip.start_date

  const { data: days } = await supabase
    .from('trip_days')
    .select('date, title')
    .eq('trip_id', trip.id)
    .gte('date', fromDate)
    .order('date')
    .limit(5)

  if (!days?.length) return null

  const daysUntil = today < trip.start_date
    ? Math.ceil((new Date(trip.start_date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">✈️ {trip.name}</h2>
          {daysUntil !== null && (
            <p className="text-xs text-blue-600 font-semibold mt-0.5">{daysUntil} days to go</p>
          )}
        </div>
        <Link href={`/trips/${trip.id}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View all →
        </Link>
      </div>

      <div className="space-y-1">
        {days.map(day => {
          const isToday = day.date === today
          const dateObj = new Date(day.date + 'T00:00:00')
          const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
          const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <Link key={day.date} href={`/trips/${trip.id}/${day.date}`}>
              <div className={`flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition ${isToday ? 'bg-blue-50 hover:bg-blue-100' : ''}`}>
                <span className={`text-xs font-bold rounded px-1.5 py-0.5 flex-shrink-0 min-w-[42px] text-center ${
                  isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {isToday ? 'Today' : weekday}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0 w-14">{dateLabel}</span>
                <span className="text-sm text-gray-700 truncate flex-1">{day.title || '—'}</span>
                <span className="text-gray-300 flex-shrink-0">›</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
