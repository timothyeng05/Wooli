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

  // Transactions, categories, and members are independent — fetch concurrently
  // instead of serially so the window query doesn't block the metadata reads.
  const fetchWindowTxns = async () => {
    const PAGE = 1000
    let all: any[] = []
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
      all = all.concat(data)
      if (data.length < PAGE) break
    }
    return all
  }

  const [allTxns, catResult, memberResult, profileResult] = await Promise.all([
    fetchWindowTxns(),
    supabase
      .from('categories')
      .select('id, name, color, icon, is_income, is_transfer, parent_id')
      .eq('user_id', user.id) as any,
    supabase
      .from('household_members')
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('profiles')
      .select('setup_cta_dismissed')
      .eq('id', user.id)
      .single(),
  ])

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
  const setupCtaDismissed: Record<string, boolean> = profileResult.data?.setup_cta_dismissed ?? {}

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-16">
      <CashFlowClient
        transactions={transactions}
        categories={categories}
        members={memberResult.data ?? []}
        currentYear={year}
        currentMonth={month}
        userId={user.id}
        setupCtaDismissed={setupCtaDismissed}
      />

    </div>
  )
}
