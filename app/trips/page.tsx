import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Breadcrumbs from '@/app/components/Breadcrumbs'

export default async function TripsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Trips' }]} />
          <div className="flex items-center justify-between mt-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Trips</h1>
              <p className="text-gray-600">Plan and track your adventures</p>
            </div>
            <Link href="/trips/new" className="bg-blue-600 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition">
              + New Trip
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {trips && trips.length > 0 ? (
          <div className="space-y-3">
            {trips.map(trip => {
              const start = new Date(trip.start_date + 'T00:00:00')
              const end = new Date(trip.end_date + 'T00:00:00')
              const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
              return (
                <Link key={trip.id} href={`/trips/${trip.id}`}>
                  <div className="p-4 rounded-lg border border-gray-200 hover:shadow-sm transition hover:border-blue-200 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-semibold text-gray-900">{trip.name}</h2>
                        {trip.destination && (
                          <p className="text-sm text-gray-500 mt-0.5">📍 {trip.destination}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {days} day{days !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                      {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {trip.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{trip.description}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">✈️</p>
            <p className="text-gray-600 mb-6">No trips yet</p>
            <Link href="/trips/new" className="inline-block bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition">
              Plan your first trip
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
