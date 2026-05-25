export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import DashboardSpendingChart from '@/app/components/budget/DashboardSpendingChart'
import DashboardNetWorthChart from '@/app/components/budget/DashboardNetWorthChart'
import { getCatEmoji } from '@/app/components/budget/catEmoji'

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function buildCumulativeSpend(txns: { amount: number; transacted_at: string }[], year: number, month: number) {
  const days = daysInMonth(year, month)
  const daily = new Array(days).fill(0)
  for (const t of txns) {
    if (t.amount >= 0) continue
    const d = new Date(t.transacted_at)
    if (d.getFullYear() === year && d.getMonth() === month) {
      daily[d.getDate() - 1] += Math.abs(Number(t.amount))
    }
  }
  // cumulative
  for (let i = 1; i < days; i++) daily[i] += daily[i - 1]
  return daily
}

export default async function BudgetDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const lastMonth = month === 0 ? 11 : month - 1
  const lastYear  = month === 0 ? year - 1 : year

  const monthStart = new Date(year, month, 1).toISOString()
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  const lastStart  = new Date(lastYear, lastMonth, 1).toISOString()
  const lastEnd    = new Date(lastYear, lastMonth + 1, 0, 23, 59, 59).toISOString()

  const [txnResult, lastTxnResult, historyResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, description, merchant, transacted_at, is_transfer, is_pending, owner, account_name, categories ( id, name, color, icon )')
      .eq('user_id', user.id)
      .gte('transacted_at', monthStart)
      .lte('transacted_at', monthEnd)
      .order('transacted_at', { ascending: false }) as any,
    supabase
      .from('transactions')
      .select('amount, transacted_at, is_transfer')
      .eq('user_id', user.id)
      .gte('transacted_at', lastStart)
      .lte('transacted_at', lastEnd) as any,
    supabase
      .from('account_balance_history')
      .select('account_id, date, balance')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
  ])

  const transactions: any[] = txnResult.data ?? []
  const lastTransactions: any[] = lastTxnResult.data ?? []
  const history: { account_id: string; date: string; balance: number }[] = historyResult.data ?? []

  const nonTransfers = transactions.filter((t: any) => !t.is_transfer)
  const income   = nonTransfers.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses = nonTransfers.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)

  const monthProgress = today / daysInMonth(year, month)

  // ── Spending chart data ────────────────────────────────────────────────────
  const thisMonthSpend = buildCumulativeSpend(nonTransfers, year, month)
  const lastNonTransfers = lastTransactions.filter((t: any) => !t.is_transfer)
  const lastMonthSpend = buildCumulativeSpend(lastNonTransfers, lastYear, lastMonth)

  // ── Net worth series ───────────────────────────────────────────────────────
  // Group history by date, carry forward latest balance per account, sum to net worth
  const allDates = [...new Set(history.map(h => h.date))].sort()
  const latestBalance = new Map<string, number>()
  const netWorthSeries: { date: string; value: number }[] = []

  for (const date of allDates) {
    const dayPoints = history.filter(h => h.date === date)
    for (const p of dayPoints) latestBalance.set(p.account_id, Number(p.balance))
    const total = Array.from(latestBalance.values()).reduce((s, v) => s + v, 0)
    netWorthSeries.push({ date, value: total })
  }

  // ── Recent transactions ────────────────────────────────────────────────────
  const recent = nonTransfers.slice(0, 8)

  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const currentNetWorth = netWorthSeries.length > 0 ? netWorthSeries[netWorthSeries.length - 1].value : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left column ──────────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-6">

            {/* Budget widget */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">{monthName}</h2>
                <span className="text-xs text-gray-400">{Math.round(monthProgress * 100)}% through month</span>
              </div>

              <div className="space-y-4">
                {/* Income */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-600">Income</span>
                    <span className="text-xs font-semibold text-green-600">${income.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full transition-all"
                      style={{ width: `${Math.min(monthProgress * 100, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Month progress</p>
                </div>

                {/* Expenses */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-600">Expenses</span>
                    <span className="text-xs font-semibold text-red-500">${expenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full transition-all"
                      style={{ width: income > 0 ? `${Math.min((expenses / income) * 100, 100)}%` : '0%' }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {income > 0 ? `${Math.round((expenses / income) * 100)}% of income` : 'No income recorded'}
                  </p>
                </div>

                {/* Net summary row */}
                <div className="flex gap-3 pt-1">
                  <div className="flex-1 bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-0.5">Saved</p>
                    <p className={`text-sm font-bold ${income - expenses >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {income - expenses >= 0 ? '+' : '-'}${Math.abs(income - expenses).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  {currentNetWorth !== null && (
                    <div className="flex-1 bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 mb-0.5">Net Worth</p>
                      <p className="text-sm font-bold text-gray-800">
                        ${currentNetWorth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent transactions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">Recent Transactions</h2>
                <Link href="/budget/transactions" className="text-xs text-blue-600 hover:underline">View all</Link>
              </div>

              {recent.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No transactions this month</p>
              ) : (
                <div className="space-y-0.5">
                  {recent.map((t: any) => {
                    const name = t.merchant || t.description || 'Unknown'
                    const catName = t.categories?.name ?? 'Uncategorized'
                    const emoji = getCatEmoji(catName, t.categories?.icon)
                    const isExpense = t.amount < 0
                    return (
                      <Link key={t.id} href={`/budget/${t.id}`}
                        className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition group">
                        <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                          {emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                            {t.is_pending && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                                Pending
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{catName}</p>
                        </div>
                        <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                          t.is_pending ? 'text-amber-500' : isExpense ? 'text-gray-800' : 'text-green-600'
                        }`}>
                          {!isExpense ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100">
                <Link href="/budget/transactions"
                  className="block w-full text-center text-xs text-gray-500 hover:text-gray-700 transition py-1">
                  See all transactions →
                </Link>
              </div>
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Net worth chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-bold text-gray-900">Net Worth</h2>
                <Link href="/budget/accounts" className="text-xs text-blue-600 hover:underline">Details</Link>
              </div>
              {currentNetWorth !== null && (
                <p className="text-2xl font-bold text-gray-900 mb-3">
                  ${currentNetWorth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              )}
              <DashboardNetWorthChart series={netWorthSeries} />
            </div>

            {/* Spending chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900">Spending</h2>
                <span className="text-xs text-gray-400">{monthName}</span>
              </div>
              <DashboardSpendingChart
                thisMonth={thisMonthSpend}
                lastMonth={lastMonthSpend}
                today={today}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
