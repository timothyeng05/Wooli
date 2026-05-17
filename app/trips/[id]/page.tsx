import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import TripRouteMapClient from '@/app/components/trips/TripRouteMapClient'
import type { MapDay } from '@/app/components/trips/TripRouteMap'

function generateDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const current = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (current <= end) {
    days.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return days
}

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!trip) notFound()

  const { data: tripDays } = await supabase
    .from('trip_days')
    .select('date, title, notes, lat, lng')
    .eq('trip_id', id)
    .order('date')

  const dayDataByDate = new Map(tripDays?.map(d => [d.date, d]) ?? [])
  const allDays = generateDays(trip.start_date, trip.end_date)
  const start = new Date(trip.start_date + 'T00:00:00')
  const end = new Date(trip.end_date + 'T00:00:00')

  const mapDays: MapDay[] = allDays
    .map((date, i) => {
      const d = dayDataByDate.get(date)
      if (!d?.lat || !d?.lng) return null
      return { date, title: d.title || date, dayNumber: i + 1, lat: d.lat, lng: d.lng }
    })
    .filter(Boolean) as MapDay[]

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[
            { label: 'Trips', href: '/trips' },
            { label: trip.name },
          ]} />
          <div className="mt-6">
            <h1 className="text-4xl font-bold text-gray-900 mb-1">{trip.name}</h1>
            {trip.destination && <p className="text-gray-500 mt-1">📍 {trip.destination}</p>}
            <p className="text-sm text-gray-400 mt-1">
              {start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} –{' '}
              {end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}{allDays.length} day{allDays.length !== 1 ? 's' : ''}
            </p>
            {trip.description && (
              <p className="text-gray-600 mt-3 text-sm max-w-xl">{trip.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {mapDays.length > 0 && (
          <div className="mb-8">
            <TripRouteMapClient days={mapDays} />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allDays.map((date, i) => {
            const dayData = dayDataByDate.get(date)
            const hasContent = !!(dayData?.notes || dayData?.title)
            const dateObj = new Date(date + 'T00:00:00')
            const dateLabel = dateObj.toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            })
            return (
              <Link key={date} href={`/trips/${id}/${date}`}>
                <div className={`p-4 rounded-xl border transition hover:shadow-md ${
                  hasContent
                    ? 'border-blue-200 bg-blue-50 hover:border-blue-300'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-bold rounded-full w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                        hasContent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {dayData?.title || dateLabel}
                        </p>
                        {dayData?.title && (
                          <p className="text-xs text-gray-400">{dateLabel}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-300 flex-shrink-0">→</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
