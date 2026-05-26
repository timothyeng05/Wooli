import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import JournalDeleteButton from '@/app/components/mood/JournalDeleteButton'
import MoodCalendar from '@/app/components/mood/MoodCalendar'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import JournalTabs from '@/app/components/JournalTabs'
import { loggingStreak } from '@/lib/mood-utils'

const MOOD_EMOJI: Record<number, string> = { 1: '😢', 2: '😕', 3: '😐', 4: '😊', 5: '😄' }
const MOOD_LABEL: Record<number, string> = { 1: 'Bad', 2: 'Stressed', 3: 'Okay', 4: 'Good', 5: 'Great' }
const MOOD_BG: Record<number, string> = {
  1: 'bg-red-50 border-red-200',
  2: 'bg-orange-50 border-orange-200',
  3: 'bg-yellow-50 border-yellow-200',
  4: 'bg-lime-50 border-lime-200',
  5: 'bg-green-50 border-green-200',
}

export default async function MoodPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(60)

  const now = new Date()
  const streak = loggingStreak(entries ?? [], now)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEntries = (entries ?? []).filter(e => new Date(e.logged_at) >= monthStart)
  const avgMoodThisMonth = monthEntries.length > 0
    ? monthEntries.reduce((sum: number, e: any) => sum + e.mood, 0) / monthEntries.length
    : null

  // Build activity → [mood scores] map
  const activityScores: Record<string, number[]> = {}
  for (const entry of entries ?? []) {
    const score = entry.mood ?? 0
    const acts: string[] = entry.activities ?? []
    for (const act of acts) {
      if (!activityScores[act]) activityScores[act] = []
      activityScores[act].push(score)
    }
  }
  // Filter to activities with ≥2 entries, compute avg
  const activityInsights = Object.entries(activityScores)
    .filter(([, scores]) => scores.length >= 2)
    .map(([activity, scores]) => ({
      activity,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Journal' }]} />
          <JournalTabs active="entries" />
          <div className="flex items-center justify-between mt-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Journal</h1>
              <p className="text-gray-600">Your daily log</p>
              {(streak > 0 || avgMoodThisMonth !== null) && (
                <p className="text-sm text-gray-500 mt-2 flex items-center gap-2 flex-wrap">
                  {streak > 0 && (
                    <span className="font-medium text-orange-600">🔥 {streak}-day streak</span>
                  )}
                  {streak > 0 && avgMoodThisMonth !== null && (
                    <span className="text-gray-300">·</span>
                  )}
                  {avgMoodThisMonth !== null && (
                    <span>Avg mood this month: <span className="font-medium text-gray-700">{avgMoodThisMonth.toFixed(1)}/5</span></span>
                  )}
                </p>
              )}
            </div>
            <Link
              href="/mood/new"
              className="bg-blue-600 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition"
            >
              + New Entry
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">This month</p>
          <MoodCalendar
            entries={(entries ?? []).map(e => ({ logged_at: e.logged_at, mood_score: e.mood }))}
            year={now.getFullYear()}
            month={now.getMonth() + 1}
          />
        </div>

        {activityInsights.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Activity Insights</p>
            <div className="space-y-2">
              {activityInsights.map(({ activity, avg, count }) => {
                const badgeClass = avg >= 4
                  ? 'bg-green-50 text-green-700'
                  : avg >= 3
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-red-50 text-red-700'
                return (
                  <div key={activity} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">{activity}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}>
                      ★{avg.toFixed(1)} · {count} entries
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {entries && entries.length > 0 ? (
          <div className="space-y-3">
            {entries.map(entry => (
              <Link key={entry.id} href={`/mood/${entry.id}`}>
                <div className={`flex items-start gap-4 p-4 rounded-lg border transition hover:shadow-sm ${MOOD_BG[entry.mood as keyof typeof MOOD_BG]}`}>
                  <span className="text-3xl">{MOOD_EMOJI[entry.mood as keyof typeof MOOD_EMOJI]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {MOOD_LABEL[entry.mood as keyof typeof MOOD_LABEL]}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">
                          {new Date(entry.logged_at).toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric'
                          })}
                        </span>
                        <JournalDeleteButton entryId={entry.id} />
                      </div>
                    </div>
                    {entry.grateful_for && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1 italic">{entry.grateful_for}</p>
                    )}
                    {entry.note && (
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{entry.note}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">😐</p>
            <p className="text-gray-600 mb-6">No mood entries yet</p>
            <Link
              href="/mood/new"
              className="inline-block bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Log your first entry
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
