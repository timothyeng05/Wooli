export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import DashboardClient from '@/app/components/budget/DashboardClient'
import { visibleTransactionsFilter } from '@/lib/budget/hidden-accounts'

function monthBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
  return { start, end }
}

// Covers every comparison mode the Spending chart offers, including
// "this month vs last year" and "this year vs last year".
const EXPENSE_WINDOW_DAYS = 400

export default async function BudgetDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const now = new Date()
  const { start: curStart, end: curEnd } = monthBounds(now)
  const farStart = new Date(Date.now() - EXPENSE_WINDOW_DAYS * 86400000)
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Transactions on a hidden account are excluded everywhere below.
  const onlyVisible = await visibleTransactionsFilter(supabase, user.id)

  const [
    { data: profile },
    { data: windowTxns },
    { data: recentTxns },
    { data: budgets },
    { data: netWorthHistory },
    { data: members },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    onlyVisible(supabase
      .from('transactions')
      .select('amount, transacted_at, is_transfer, categories(is_income)')
      .eq('user_id', user.id)
      // Hidden transactions are excluded from every reporting surface.
      .eq('is_hidden', false)
      .gte('transacted_at', farStart.toISOString())
      .lte('transacted_at', curEnd.toISOString())),
    onlyVisible(supabase
      .from('transactions')
      .select('id, amount, merchant, description, transacted_at, is_pending, needs_review, is_transfer, owner, categories(name, icon, is_income)')
      .eq('user_id', user.id)
      // A row you've hidden shouldn't resurface in the recent-activity feed —
      // the transactions list is where it stays visible and can be unhidden.
      .eq('is_hidden', false)
      .order('transacted_at', { ascending: false })
      .limit(8)),
    supabase
      .from('budgets')
      .select('category_id, target_amount, categories!inner(is_income, is_transfer)')
      .eq('user_id', user.id)
      .eq('month', `${curStart.toISOString().slice(0, 7)}-01`),
    // Full history (not just a recent slice) so the net worth chart can offer
    // the same 1M/3M/6M/YTD/1Y/All period picker as the Accounts page.
    supabase
      .from('net_worth_history')
      .select('recorded_on, net_worth')
      .eq('user_id', user.id)
      .order('recorded_on', { ascending: true }),
    supabase
      .from('household_members')
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
  ])

  const curMonthKey = curStart.toISOString().slice(0, 7)

  let incomeActual = 0
  let expenseActual = 0
  // Daily expense total across the whole fetch window, keyed by YYYY-MM-DD —
  // the Spending chart derives whichever two series it needs (week/month/
  // year comparisons) from this single map.
  const dailyExpense: Record<string, number> = {}

  for (const t of windowTxns ?? []) {
    if (t.is_transfer) continue
    const day = t.transacted_at.slice(0, 10)
    const monthKey = day.slice(0, 7)
    const isIncome = (t.categories as any)?.is_income ?? t.amount >= 0
    const amt = Number(t.amount)

    // Expense-category rows contribute -amount, not |amount|: a negative
    // charge becomes positive spend, and a positive credit sitting in an
    // expense category (a refund, someone paying you back) subtracts from
    // that category instead of inflating it. Direction comes from the
    // category being an expense one, so a genuine income row is unaffected.
    const magnitude = -amt

    if (monthKey === curMonthKey) {
      if (isIncome) incomeActual += amt
      else expenseActual += magnitude
    }
    if (!isIncome) {
      dailyExpense[day] = (dailyExpense[day] ?? 0) + magnitude
    }
  }

  const incomePlanned = (budgets ?? [])
    .filter(b => (b.categories as any)?.is_income)
    .reduce((s, b) => s + Number(b.target_amount), 0)
  const expensePlanned = (budgets ?? [])
    .filter(b => !(b.categories as any)?.is_income && !(b.categories as any)?.is_transfer)
    .reduce((s, b) => s + Number(b.target_amount), 0)

  const mapRecent = (rows: typeof recentTxns) => (rows ?? []).map(t => ({
    id: t.id,
    amount: Number(t.amount),
    merchant: t.merchant,
    description: t.description,
    transactedAt: t.transacted_at,
    isPending: t.is_pending ?? false,
    needsReview: t.needs_review ?? false,
    isTransfer: t.is_transfer ?? false,
    owner: t.owner ?? null,
    categoryName: (t.categories as any)?.name ?? null,
    categoryIcon: (t.categories as any)?.icon ?? null,
    isIncome: Number(t.amount) >= 0,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <DashboardClient
          userId={user.id}
          greetingName={profile?.full_name?.split(' ')[0] ?? null}
          monthLabel={monthLabel}
          incomeActual={incomeActual}
          incomePlanned={incomePlanned}
          expenseActual={expenseActual}
          expensePlanned={expensePlanned}
          recentTransactions={mapRecent(recentTxns)}
          members={members ?? []}
          netWorthHistory={(netWorthHistory ?? []).map(r => ({ date: r.recorded_on, value: Number(r.net_worth) }))}
          dailyExpense={dailyExpense}
        />
      </div>
    </div>
  )
}
