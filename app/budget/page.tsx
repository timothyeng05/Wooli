export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CashFlowClient from '@/app/components/budget/CashFlowClient'
import type { CashFlowTransaction, CashFlowCategory } from '@/app/budget/cashflow/page'

export default async function BudgetDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // Last 6 months of transactions for monthly view (yearly fetches client-side)
  const start = new Date(year, month - 5, 1).toISOString()
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

  const PAGE = 1000
  let allTxns: any[] = []
  for (let page = 0; ; page++) {
    const { data } = await supabase
      .from('transactions')
      .select(`
        id, amount, merchant, description, transacted_at, is_transfer, is_pending, owner,
        categories ( id, name, color, icon, is_income, is_transfer, parent_id )
      `)
      .eq('user_id', user.id)
      .gte('transacted_at', start)
      .lte('transacted_at', end)
      .order('transacted_at', { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1) as any
    if (!data || data.length === 0) break
    allTxns = allTxns.concat(data)
    if (data.length < PAGE) break
  }

  const catResult = await supabase
    .from('categories')
    .select('id, name, color, icon, is_income, is_transfer, parent_id')
    .eq('user_id', user.id) as any

  const transactions: CashFlowTransaction[] = allTxns.map((t: any) => ({
    id: t.id,
    amount: Number(t.amount),
    merchant: t.merchant ?? null,
    transacted_at: t.transacted_at,
    is_transfer: t.is_transfer ?? false,
    owner: t.owner ?? null,
    category: t.categories ?? null,
  }))

  const categories: CashFlowCategory[] = catResult.data ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <CashFlowClient
        transactions={transactions}
        categories={categories}
        currentYear={year}
        currentMonth={month}
      />

    </div>
  )
}
