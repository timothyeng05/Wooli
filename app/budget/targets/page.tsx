export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import BudgetTargetsClient from '@/app/components/budget/BudgetTargetsClient'
import MonthNav from '@/app/components/budget/MonthNav'

export default async function BudgetTargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? '') || now.getFullYear()
  const monthParam = parseInt(params.month ?? '')  // 0-indexed
  const resolvedMonth = isNaN(monthParam) ? now.getMonth() : monthParam

  // Build YYYY-MM string for budget table lookup (month is 1-indexed in the string)
  const month = `${year}-${String(resolvedMonth + 1).padStart(2, '0')}`

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const monthStart = new Date(year, resolvedMonth, 1).toISOString()
  const monthEnd   = new Date(year, resolvedMonth + 1, 0, 23, 59, 59).toISOString()

  const [categoriesResult, txnResult, budgetsResult] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, color, icon, is_income, is_transfer, parent_id, sort_order, budget_level')
      .eq('user_id', user.id)
      .order('sort_order'),
    supabase
      .from('transactions')
      .select('category_id, amount, is_reimbursement')
      .eq('user_id', user.id)
      .eq('is_transfer', false)
      .gte('transacted_at', monthStart)
      .lte('transacted_at', monthEnd),
    supabase
      .from('budgets')
      .select('category_id, target_amount')
      .eq('user_id', user.id)
      .eq('month', `${month}-01`),
  ])

  const transferCategoryIds = new Set(
    (categoriesResult.data ?? []).filter(c => c.is_transfer).map(c => c.id)
  )
  const incomeCategoryIds = new Set(
    (categoriesResult.data ?? []).filter(c => c.is_income).map(c => c.id)
  )

  const actuals: Record<string, number> = {}
  let uncategorizedIncome = 0
  let uncategorizedExpenses = 0
  for (const t of (txnResult.data ?? [])) {
    if (transferCategoryIds.has(t.category_id)) continue
    const amt = Number(t.amount)
    if (!t.category_id) {
      if (amt >= 0) uncategorizedIncome += amt
      else uncategorizedExpenses += t.is_reimbursement ? -Math.abs(amt) : Math.abs(amt)
      continue
    }
    if (incomeCategoryIds.has(t.category_id)) {
      actuals[t.category_id] = (actuals[t.category_id] ?? 0) + amt
    } else {
      const magnitude = Math.abs(amt)
      actuals[t.category_id] = (actuals[t.category_id] ?? 0) + (t.is_reimbursement ? -magnitude : magnitude)
    }
  }

  const budgets: Record<string, number> = {}
  for (const b of (budgetsResult.data ?? [])) {
    budgets[b.category_id] = Number(b.target_amount)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Budget Targets</h1>
        <MonthNav year={year} month={resolvedMonth} />
      </div>
      <BudgetTargetsClient
        categories={(categoriesResult.data ?? []) as any}
        actuals={actuals}
        budgets={budgets}
        userId={user.id}
        month={month}
        uncategorizedIncome={uncategorizedIncome}
        uncategorizedExpenses={uncategorizedExpenses}
      />
    </div>
  )
}
