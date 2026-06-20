import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Breadcrumbs from '@/app/components/Breadcrumbs'


type Trip = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  destination?: string | null
  description?: string | null
}

function formatDateRange(start_date: string | null, end_date: string | null): string {
  if (!start_date && !end_date) return 'Dates TBD'

  const start = start_date ? new Date(start_date + 'T00:00:00') : null
  const end = end_date ? new Date(end_date + 'T00:00:00') : null

  if (!start && end) {
    return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (start && !end) {
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (!start || !end) return 'Dates TBD'

  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()

  if (sameMonth) {
    // e.g. "Jun 12–19, 2026"
    const month = start.toLocaleDateString('en-US', { month: 'short' })
    const year = start.getFullYear()
    return `${month} ${start.getDate()}–${end.getDate()}, ${year}`
  } else if (sameYear) {
    // e.g. "Jun 28 – Jul 4, 2026"
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${s} – ${e}, ${start.getFullYear()}`
  } else {
    // e.g. "Dec 30, 2025 – Jan 3, 2026"
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${s} – ${e}`
  }
}

function getDayCount(start_date: string | null, end_date: string | null): number | null {
  if (!start_date || !end_date) return null
  const start = new Date(start_date + 'T00:00:00')
  const end = new Date(end_date + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
}

function tripStatus(start_date: string | null, end_date: string | null): { label: string; cls: string } | null {
  if (!start_date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const s = new Date(start_date + 'T00:00:00')
  const e = new Date((end_date ?? start_date) + 'T00:00:00')
  const day = 86400000
  if (today < s) {
    const d = Math.round((s.getTime() - today.getTime()) / day)
    const label = d === 0 ? 'Starts today' : d === 1 ? 'Tomorrow' : `In ${d} days`
    return { label, cls: 'bg-blue-50 text-blue-600 border-blue-200' }
  }
  if (today <= e) return { label: 'In progress', cls: 'bg-green-50 text-green-700 border-green-200' }
  return { label: 'Completed', cls: 'bg-gray-100 text-gray-400 border-gray-200' }
}

function TripCard({ trip }: { trip: Trip }) {
  const days = getDayCount(trip.start_date, trip.end_date)
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const status = tripStatus(trip.start_date, trip.end_date)

  return (
    <Link href={`/trips/${trip.id}`} className="block">
      <div className="p-4 rounded-xl border border-gray-200 hover:shadow-sm transition hover:border-blue-200 active:scale-[0.99] bg-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-semibold text-base text-gray-900 leading-snug">{trip.name}</h2>
            {trip.destination && (
              <p className="text-sm text-gray-500 mt-0.5">📍 {trip.destination}</p>
            )}
          </div>
          {status && (
            <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap flex-shrink-0 ${status.cls}`}>
              {status.label}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1.5">
          {dateRange}{days !== null ? ` · ${days} day${days !== 1 ? 's' : ''}` : ''}
        </p>
        {trip.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{trip.description}</p>
        )}
      </div>
    </Link>
  )
}

export default async function TripsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, destination, description')
    .eq('user_id', user.id)
    .order('start_date', { ascending: true })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcoming: Trip[] = []
  const past: Trip[] = []

  for (const trip of trips ?? []) {
    // A trip is upcoming if its end_date (or start_date if no end_date) is today or in the future
    const compareDate = trip.end_date ?? trip.start_date
    if (!compareDate) {
      // No dates — treat as upcoming (needs planning)
      upcoming.push(trip)
    } else {
      const tripEnd = new Date(compareDate + 'T00:00:00')
      if (tripEnd >= today) {
        upcoming.push(trip)
      } else {
        past.push(trip)
      }
    }
  }

  // Past trips: most recent first
  past.reverse()

  const totalTrips = upcoming.length + past.length

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Trips' }]} />
          <div className="flex items-center justify-between mt-4 sm:mt-6">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Trips</h1>
              <p className="text-sm sm:text-base text-gray-600">Plan and track your adventures</p>
            </div>
            <Link href="/trips/new" className="bg-blue-600 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition">
              + New Trip
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        {totalTrips === 0 ? (
          <div>
            <div className="text-center py-6 mb-8">
              <p className="text-5xl mb-4">✈️</p>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Plan and document your travels</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-8">
                Keep all your trip details in one place — itineraries, daily logs, meals, activities, and notes. Great for planning ahead or capturing memories as you go.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-8 text-left">
                {[
                  { icon: '🗓️', title: 'Day-by-day itinerary', desc: 'Organise activities and plans for each day of your trip' },
                  { icon: '🍽️', title: 'Meals & ratings', desc: 'Log restaurants and rate them as you travel' },
                  { icon: '📝', title: 'Daily summaries', desc: 'AI-assisted summaries to capture your trip story' },
                ].map(f => (
                  <div key={f.title} className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xl mb-1.5">{f.icon}</p>
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{f.title}</p>
                    <p className="text-xs text-gray-500">{f.desc}</p>
                  </div>
                ))}
              </div>
              <Link href="/trips/new" className="inline-block bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition">
                Plan your first trip
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Upcoming */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Upcoming
              </h2>
              {upcoming.length > 0 ? (
                <div className="space-y-3">
                  {upcoming.map(trip => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  No upcoming trips ·{' '}
                  <Link href="/trips/new" className="text-blue-500 hover:underline">
                    Plan one!
                  </Link>
                </p>
              )}
            </section>

            {/* Past — only render if there are past trips */}
            {past.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Past trips
                </h2>
                <div className="space-y-3 opacity-75">
                  {past.map(trip => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
