import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import ShareButton from '@/app/components/ShareButton'
import { TRIP_LEGS, LEG_COLORS, type Leg } from '@/app/trips/legs-config'

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

function groupByLegs(allDays: string[], legs: Leg[]) {
  if (!legs.length) return [{ leg: null as Leg | null, days: allDays }]
  return legs
    .map(leg => ({ leg, days: allDays.filter(d => d >= leg.from && d <= leg.to) }))
    .filter(g => g.days.length > 0)
}

function shortDate(date: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric' })
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
    .select('date, title, notes')
    .eq('trip_id', id)
    .order('date')

  const dayDataByDate = new Map(tripDays?.map(d => [d.date, d]) ?? [])
  const allDays = generateDays(trip.start_date, trip.end_date)
  const legs = TRIP_LEGS[id] ?? []
  const groups = groupByLegs(allDays, legs)

  // Countdown / status computation (server-side)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(trip.start_date + 'T00:00:00')
  const endDate = new Date(trip.end_date + 'T00:00:00')
  const msPerDay = 1000 * 60 * 60 * 24

  type TripStatus = 'upcoming' | 'in-progress' | 'past'
  let tripStatus: TripStatus
  let countdownLabel: string
  let progressPct: number | null

  if (today < startDate) {
    tripStatus = 'upcoming'
    const daysUntil = Math.round((startDate.getTime() - today.getTime()) / msPerDay)
    countdownLabel = `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until departure`
    progressPct = 0
  } else if (today <= endDate) {
    tripStatus = 'in-progress'
    const dayOfTrip = Math.round((today.getTime() - startDate.getTime()) / msPerDay) + 1
    const totalDays = allDays.length
    countdownLabel = `In progress · Day ${dayOfTrip} of ${totalDays}`
    progressPct = Math.min(100, Math.round(((today.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100))
  } else {
    tripStatus = 'past'
    const daysAgo = Math.round((today.getTime() - endDate.getTime()) / msPerDay)
    countdownLabel = `Completed · ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`
    progressPct = null
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Breadcrumbs items={[
            { label: 'Trips', href: '/trips' },
            { label: trip.name },
          ]} />
          <div className="mt-4 sm:mt-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900">{trip.name}</h1>
              <ShareButton url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/share/${id}`} />
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${
                tripStatus === 'upcoming'    ? 'bg-blue-50 text-blue-700' :
                tripStatus === 'in-progress' ? 'bg-green-50 text-green-700' :
                                               'bg-gray-100 text-gray-500'
              }`}>
                {countdownLabel}
              </span>
              {progressPct !== null && (
                <div className="w-full h-1 bg-gray-100 rounded mt-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
            </div>
            {trip.destination && <p className="text-gray-500 mt-1">📍 {trip.destination}</p>}
            <p className="text-sm text-gray-400 mt-1">
              {shortDate(trip.start_date, { month: 'long', day: 'numeric' })} –{' '}
              {shortDate(trip.end_date, { month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}{allDays.length} days
            </p>
            {trip.description && (
              <p className="text-gray-600 mt-3 text-sm max-w-xl">{trip.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {groups.map((group, gi) => {
          const colors = LEG_COLORS[gi % LEG_COLORS.length]
          const { leg, days: legDays } = group

          return (
            <div key={gi}>
              {leg && (
                <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border mb-2 ${colors.bg} ${colors.border}`}>
                  <span className="text-2xl leading-none">{leg.emoji}</span>
                  <div>
                    <h2 className={`font-bold text-base ${colors.text}`}>{leg.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {shortDate(legDays[0])} – {shortDate(legDays[legDays.length - 1])}
                      {' · '}{legDays.length} day{legDays.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {legDays.map(date => {
                  const dayData = dayDataByDate.get(date)
                  const dayNum = allDays.indexOf(date) + 1
                  const dateObj = new Date(date + 'T00:00:00')
                  const dateLabel = dateObj.toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                  })
                  const hasContent = !!(dayData?.notes || dayData?.title)

                  return (
                    <Link key={date} href={`/trips/${id}/${date}`}>
                      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition group">
                        <span className={`text-xs font-bold rounded-full w-7 h-7 flex-shrink-0 flex items-center justify-center ${
                          hasContent ? `${colors.badge} text-white` : 'bg-gray-100 text-gray-400'
                        }`}>
                          {dayNum}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-gray-900 truncate">
                            {dayData?.title || dateLabel}
                          </p>
                          {dayData?.title && (
                            <p className="text-xs text-gray-400">{dateLabel}</p>
                          )}
                        </div>
                        <span className="text-gray-300 group-hover:text-gray-500 transition flex-shrink-0 text-base">›</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
