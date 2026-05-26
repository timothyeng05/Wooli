import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import LifeCalendar from '@/app/components/dashboard/LifeCalendar'
import CalendarInsights from '@/app/components/dashboard/CalendarInsights'
import WeeklySummary from '@/app/components/dashboard/WeeklySummary'
import TripWidget from '@/app/components/dashboard/TripWidget'
import GoogleCalendarWidget from '@/app/components/dashboard/GoogleCalendarWidget'
import { fetchGCalData } from '@/lib/google-calendar'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const { data: { session } } = await supabase.auth.getSession()

  const moodLookbackStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const [moodResult, periodResult, transactionResult, listsResult, calendarEvents] = await Promise.all([
    supabase
      .from('mood_entries')
      .select('id, mood, note, grateful_for, activities, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', moodLookbackStart),
    supabase
      .from('period_entries')
      .select('id, start_date, end_date, flow_level, symptoms, notes')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false }),
    supabase
      .from('transactions')
      .select('id, amount, description, merchant, transacted_at, categories(id, name, color)')
      .eq('user_id', user.id)
      .gte('transacted_at', monthStart)
      .lte('transacted_at', monthEnd)
      .order('transacted_at', { ascending: false })
      .limit(8) as any,
    supabase
      .from('lists')
      .select('id, name, is_archived')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(4) as any,
    session?.provider_token
      ? fetchGCalData(session.provider_token, now.getFullYear(), now.getMonth() + 1)
      : Promise.resolve({ calendars: [], eventsByDate: {} }),
  ])

  const moodEntries = moodResult.data || []
  const periodEntries = periodResult.data || []
  const moodEntriesThisMonth = moodEntries.filter(e => e.logged_at >= monthStart && e.logged_at <= monthEnd)
  const transactions = transactionResult.data || []
  const activeLists = listsResult.data || []

  const income = transactions.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses = transactions.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)

  // Compute top 3 spending categories from current month transactions
  const categoryTotals: Record<string, number> = {}
  for (const tx of transactions ?? []) {
    if (Number((tx as any).amount) >= 0) continue  // skip income
    const cat = (tx as any).categories?.name ?? 'Uncategorized'
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Math.abs(Number((tx as any).amount))
  }
  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }))

  // Cross-module insight: avg spend on low-mood days vs high-mood days
  let moodSpendInsight: string | null = null
  if ((moodEntries?.length ?? 0) >= 5 && (transactions?.length ?? 0) >= 5) {
    // Build a map of date → mood score
    const moodByDate: Record<string, number> = {}
    for (const entry of moodEntries ?? []) {
      const date = (entry.logged_at as string).split('T')[0]
      moodByDate[date] = entry.mood as number
    }
    // Aggregate spend per day (transactions use transacted_at; expenses are negative amounts)
    const spendByDate: Record<string, number> = {}
    for (const tx of transactions ?? []) {
      const amount = Number((tx as any).amount)
      if (amount < 0) {
        const date = ((tx as any).transacted_at as string).split('T')[0]
        spendByDate[date] = (spendByDate[date] ?? 0) + Math.abs(amount)
      }
    }
    // Group daily spend by mood tier
    const lowMoodSpend: number[] = []   // mood 1-2
    const highMoodSpend: number[] = []  // mood 4-5
    for (const [date, spend] of Object.entries(spendByDate)) {
      const mood = moodByDate[date]
      if (!mood) continue
      if (mood <= 2) lowMoodSpend.push(spend)
      else if (mood >= 4) highMoodSpend.push(spend)
    }
    if (lowMoodSpend.length >= 2 && highMoodSpend.length >= 2) {
      const avgLow = lowMoodSpend.reduce((a, b) => a + b, 0) / lowMoodSpend.length
      const avgHigh = highMoodSpend.reduce((a, b) => a + b, 0) / highMoodSpend.length
      const diff = Math.abs(avgLow - avgHigh)
      if (diff >= 5) {
        if (avgLow > avgHigh) {
          moodSpendInsight = `You spend $${avgLow.toFixed(0)}/day on low-mood days vs $${avgHigh.toFixed(0)} on high-mood days`
        } else {
          moodSpendInsight = `You spend $${avgHigh.toFixed(0)}/day on high-mood days vs $${avgLow.toFixed(0)} on low-mood days`
        }
      }
    }
  }

  const monthLabel = now.toLocaleString('default', { month: 'long' })
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const hasTransactions = transactions.length > 0 && !transactionResult.error

  const isEmpty = (transactions?.length ?? 0) === 0 &&
    (moodEntries?.length ?? 0) === 0 &&
    (activeLists?.length ?? 0) === 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 sm:py-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{greeting}</h1>
            <p className="hidden sm:block text-gray-500 mt-0.5 text-sm">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Mood × spending insight strip */}
      {moodSpendInsight && (
        <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
            <span className="text-lg">💡</span>
            <p className="text-sm text-gray-600">{moodSpendInsight}</p>
          </div>
        </div>
      )}

      {/* Welcome panel — shown only when the account has no data yet */}
      {isEmpty && (
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Wooli</h2>
          <p className="text-gray-500 mb-8">Your personal dashboard for budget, trips, and more. Get started by adding your first entry.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a href="/budget/transactions" className="flex flex-col items-center gap-2 p-5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition group">
              <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Add a transaction</span>
            </a>
            <a href="/mood/new" className="flex flex-col items-center gap-2 p-5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition group">
              <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Log your mood</span>
            </a>
            <a href="/trips/new" className="flex flex-col items-center gap-2 p-5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition group">
              <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Plan a trip</span>
            </a>
          </div>
        </div>
      )}

      {/* Main layout */}
      {!isEmpty && <div className="max-w-7xl mx-auto px-6 py-8">
        <WeeklySummary />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: Big calendar */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Daily Log</h2>
                  <p className="text-sm text-gray-500">Click any past day to log or view</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Link href="/period" className="text-pink-600 hover:text-pink-700 font-medium">Period</Link>
                  <Link href="/mood" className="text-blue-600 hover:text-blue-700 font-medium">All entries →</Link>
                </div>
              </div>
              <CalendarInsights moodEntries={moodEntries} periodEntries={periodEntries} />
              <LifeCalendar initialMoodEntries={moodEntriesThisMonth} initialPeriodEntries={periodEntries} initialGCalData={calendarEvents} />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6 order-1 lg:order-2">

            <GoogleCalendarWidget />
            <TripWidget userId={user.id} />

            {/* Budget summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Budget</h2>
                <Link href="/budget" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View all →
                </Link>
              </div>
              {!hasTransactions && transactionResult.error ? (
                <p className="text-sm text-gray-400">
                  <Link href="/budget" className="text-blue-600 hover:underline">Set up budget tracking</Link>
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{monthLabel} income</p>
                      <p className="font-bold text-green-700">+${income.toFixed(0)}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{monthLabel} spent</p>
                      <p className="font-bold text-red-700">-${expenses.toFixed(0)}</p>
                    </div>
                  </div>

                  {topCategories.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {topCategories.map(({ name, amount }) => (
                        <div key={name} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 truncate">{name}</span>
                          <span className="text-gray-700 font-medium ml-2 flex-shrink-0">${amount.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {transactions.length > 0 ? (
                    <div className="space-y-2">
                      {transactions.slice(0, 5).map((t: any) => (
                        <div key={t.id} className="flex items-center gap-2.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: t.categories?.color || '#d1d5db' }}
                          />
                          <span className="text-sm text-gray-700 flex-1 truncate">
                            {t.description || t.merchant || 'Transaction'}
                          </span>
                          <span className={`text-sm font-medium flex-shrink-0 ${t.amount >= 0 ? 'text-green-600' : 'text-gray-800'}`}>
                            {t.amount >= 0 ? '+' : ''}${Math.abs(Number(t.amount)).toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No transactions this month</p>
                  )}

                  <Link
                    href="/budget/new"
                    className="mt-4 block w-full text-center py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
                  >
                    + Add transaction
                  </Link>
                </>
              )}
            </div>

            {/* Lists summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Lists</h2>
                <Link href="/lists" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View all →
                </Link>
              </div>
              {activeLists.length > 0 ? (
                <div className="space-y-2">
                  {(activeLists as any[]).map((l: any) => (
                    <Link key={l.id} href={`/lists/${l.id}`}>
                      <div className="flex items-center gap-2 py-1.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition">
                        <span className="text-sm text-gray-700 flex-1 truncate">{l.name}</span>
                        <span className="text-gray-300 text-xs">›</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-400 mb-3">No active lists</p>
                  <Link
                    href="/lists/new"
                    className="block w-full text-center py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
                  >
                    + New list
                  </Link>
                </div>
              )}
            </div>


          </div>
        </div>
      </div>}

    </div>
  )
}
