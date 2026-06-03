import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { averageCycleLength, currentCycleDay, predictNextPeriodStart, type PeriodEntry } from '@/lib/period-utils'

function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRange(start: string, end: string | null) {
  if (!end) return formatDate(start)
  return `${formatDate(start)} – ${formatDate(end)}`
}

export default async function PeriodPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from('period_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })

  const list: PeriodEntry[] = entries || []
  const today = new Date()
  const cycleDay = currentCycleDay(list, today)
  const avgCycle = list.length >= 2 ? averageCycleLength(list) : null
  const nextStart = predictNextPeriodStart(list)

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-b border-blue-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mt-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Periods</h1>
              <p className="text-gray-600">Track your cycle</p>
            </div>
            <Link
              href="/period/new"
              className="bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition"
            >
              + Log Period
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Stats */}
        {list.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <p className="text-sm text-gray-500 mb-1">Cycle day</p>
              <p className="text-2xl font-bold text-blue-700">{cycleDay ?? '—'}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <p className="text-sm text-gray-500 mb-1">Avg cycle</p>
              <p className="text-2xl font-bold text-gray-900">{avgCycle ? `${avgCycle}d` : '—'}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <p className="text-sm text-gray-500 mb-1">Next expected</p>
              <p className="text-base font-bold text-gray-900">
                {nextStart ? nextStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        )}

        {/* List */}
        {list.length > 0 ? (
          <div className="space-y-3">
            {list.map(entry => (
              <Link key={entry.id} href={`/period/${entry.id}`}>
                <div className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm transition">
                  <span className="w-2 h-12 rounded-full bg-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatRange(entry.start_date, entry.end_date)}
                      </span>
                      {entry.flow_level && (
                        <span className="text-xs uppercase tracking-wide text-blue-700 font-medium">
                          {entry.flow_level}
                        </span>
                      )}
                    </div>
                    {entry.symptoms && entry.symptoms.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1 capitalize">{entry.symptoms.join(' · ')}</p>
                    )}
                    {entry.notes && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{entry.notes}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-600 mb-6">No period entries yet</p>
            <Link
              href="/period/new"
              className="inline-block bg-blue-700 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Log your first period
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
