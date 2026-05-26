export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import DashboardSpendingChart from '@/app/components/budget/DashboardSpendingChart'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import MonthNav from '@/app/components/budget/MonthNav'

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

export default async function BudgetDashboard({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? '') || now.getFullYear()
  const month = parseInt(params.month ?? '')  // 0-indexed
  const resolvedMonth = isNaN(month) ? now.getMonth() : month
  const isCurrentMonth = year === now.getFullYear() && resolvedMonth === now.getMonth()
  const today = isCurrentMonth ? now.getDate() : new Date(year, resolvedMonth + 1, 0).getDate()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lastMonth = resolvedMonth === 0 ? 11 : resolvedMonth - 1
  const lastYear  = resolvedMonth === 0 ? year - 1 : year

  const monthStart = new Date(year, resolvedMonth, 1).toISOString()
  const monthEnd   = new Date(year, resolvedMonth + 1, 0, 23, 59, 59).toISOString()
  const lastStart  = new Date(lastYear, lastMonth, 1).toISOString()
  const lastEnd    = new Date(lastYear, lastMonth + 1, 0, 23, 59, 59).toISOString()

  const [txnResult, lastTxnResult] = await Promise.all([
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
  ])

  const transactions: any[] = txnResult.data ?? []
  const lastTransactions: any[] = lastTxnResult.data ?? []

  const nonTransfers = transactions.filter((t: any) => !t.is_transfer)
  const income   = nonTransfers.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses = nonTransfers.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)

  const monthProgress = today / daysInMonth(year, resolvedMonth)

  // ── Spending chart data ────────────────────────────────────────────────────
  const thisMonthSpend = buildCumulativeSpend(nonTransfers, year, resolvedMonth)
  const lastNonTransfers = lastTransactions.filter((t: any) => !t.is_transfer)
  const lastMonthSpend = buildCumulativeSpend(lastNonTransfers, lastYear, lastMonth)

  // ── Category breakdown ────────────────────────────────────────────────────
  const expenseTransactions = nonTransfers.filter((t: any) => t.amount < 0)
  const catTotals = new Map<string, { amount: number; color?: string }>()
  for (const t of expenseTransactions) {
    const name = t.categories?.name ?? 'Uncategorized'
    const color = t.categories?.color ?? undefined
    const prev = catTotals.get(name)
    if (prev) {
      prev.amount += Math.abs(Number(t.amount))
    } else {
      catTotals.set(name, { amount: Math.abs(Number(t.amount)), color })
    }
  }
  const categoryBreakdown = Array.from(catTotals.entries())
    .map(([name, { amount, color }]) => ({ name, amount, color }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
  const maxCatAmount = categoryBreakdown.length > 0 ? categoryBreakdown[0].amount : 0

  // ── Recent transactions ────────────────────────────────────────────────────
  const recent = nonTransfers.slice(0, 8)

  const monthName = new Date(year, resolvedMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left column ──────────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-6">

            {/* Budget widget */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center justify-between mb-1">
                  <MonthNav year={year} month={resolvedMonth} />
                </div>
                {isCurrentMonth && (
                  <span className="text-xs text-gray-400">{Math.round(monthProgress * 100)}% through month</span>
                )}
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
                  <div className="flex-1 bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-0.5">Savings Rate</p>
                    {savingsRate !== null ? (
                      <p className={`text-sm font-bold ${savingsRate >= 20 ? 'text-green-600' : savingsRate >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                        {savingsRate}%
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-gray-300">—</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Spending by category */}
            {expenseTransactions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Spending by Category</h2>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No spending data for this period</p>
                ) : (
                  categoryBreakdown.map(cat => (
                    <div key={cat.name} className="mb-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{cat.name}</span>
                        <span>${cat.amount.toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(cat.amount / maxCatAmount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

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
