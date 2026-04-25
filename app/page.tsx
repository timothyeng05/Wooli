import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logout } from '@/app/auth/actions'
import { computeCardStats } from '@/lib/card-utils'
import MoodCalendar from '@/app/components/dashboard/MoodCalendar'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [moodResult, transactionResult, cardsResult] = await Promise.all([
    supabase
      .from('mood_entries')
      .select('id, mood, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', monthStart)
      .lte('logged_at', monthEnd),
    supabase
      .from('transactions')
      .select('id, amount, description, merchant, transacted_at, categories(id, name, color)')
      .eq('user_id', user.id)
      .gte('transacted_at', monthStart)
      .lte('transacted_at', monthEnd)
      .order('transacted_at', { ascending: false })
      .limit(8) as any,
    supabase
      .from('cards')
      .select(`
        id, name, issuer, annual_fee, is_active,
        card_benefits (
          is_core,
          benefits ( amount, amount_unit, period_type )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3) as any
  ])

  const moodEntries = moodResult.data || []
  const transactions = transactionResult.data || []
  const rawCards = cardsResult.data || []

  const cards = rawCards.map((c: any) => ({
    ...c,
    ...computeCardStats(c.annual_fee, c.card_benefits || [])
  }))

  const income = transactions.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses = transactions.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)

  const monthLabel = now.toLocaleString('default', { month: 'long' })
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const hasTransactions = transactions.length > 0 && !transactionResult.error
  const hasCards = cards.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{greeting}</h1>
            <p className="text-gray-500 mt-0.5 text-sm">{user.email}</p>
          </div>
          <form>
            <button formAction={logout} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: Big calendar */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Mood</h2>
                  <p className="text-sm text-gray-500">Click any past day to log or view</p>
                </div>
                <Link href="/mood" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  All entries →
                </Link>
              </div>
              <MoodCalendar initialEntries={moodEntries} />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">

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

            {/* Cards summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Cards</h2>
                <Link href="/cards" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View all →
                </Link>
              </div>
              {hasCards ? (
                <div className="space-y-3">
                  {cards.map((card: any) => (
                    <Link key={card.id} href={`/cards/${card.id}`}>
                      <div className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{card.name}</p>
                          <p className="text-xs text-gray-500">{card.issuer}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${card.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {card.netValue >= 0 ? '+' : '-'}${Math.abs(card.netValue).toFixed(0)}
                          </p>
                          <p className="text-xs text-gray-400">net/yr</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-400 mb-3">No active cards yet</p>
                  <Link
                    href="/cards/new"
                    className="block w-full text-center py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
                  >
                    + Add card
                  </Link>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
