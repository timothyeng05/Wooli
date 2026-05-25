export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import BudgetTargetsClient from '@/app/components/budget/BudgetTargetsClient'

export default async function BudgetTargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const raw = params?.month
  const month = raw && /^\d{4}-\d{2}$/.test(raw)
    ? raw
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [year, mon] = month.split('-').map(Number)
  const lastDay = new Date(year, mon, 0).getDate()
  const monthStart = `${month}-01T00:00:00`
  const monthEnd   = `${month}-${String(lastDay).padStart(2, '0')}T23:59:59`

  const [categoriesResult, txnResult, budgetsResult] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, color, icon, is_income, is_transfer, parent_id, sort_order, budget_level')
      .eq('user_id', user.id)
      .order('sort_order'),
    supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('user_id', user.id)
      .eq('is_transfer', false)
      .eq('is_pending', false)
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

  const actuals: Record<string, number> = {}
  let uncategorizedIncome = 0
  let uncategorizedExpenses = 0
  for (const t of (txnResult.data ?? [])) {
    if (transferCategoryIds.has(t.category_id)) continue
    const amt = Number(t.amount)
    if (!t.category_id) {
      if (amt >= 0) uncategorizedIncome += amt
      else uncategorizedExpenses += Math.abs(amt)
      continue
    }
    actuals[t.category_id] = (actuals[t.category_id] ?? 0) + amt
  }

  const budgets: Record<string, number> = {}
  for (const b of (budgetsResult.data ?? [])) {
    budgets[b.category_id] = Number(b.target_amount)
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
