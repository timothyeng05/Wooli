export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CashFlowClient from '@/app/components/budget/CashFlowClient'
import type { CashFlowTransaction, CashFlowCategory } from '@/app/budget/cashflow/page'
import { getCatEmoji } from '@/app/components/budget/catEmoji'

export default async function BudgetDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // Last 6 months of transactions (paginated)
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

  const recent = allTxns.filter((t: any) => !t.is_transfer).slice(0, 8)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <CashFlowClient
        transactions={transactions}
        categories={categories}
        currentYear={year}
        currentMonth={month}
      />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Recent Transactions</h2>
          <Link href="/budget/transactions" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No transactions yet</p>
        ) : (
          <div className="space-y-0.5">
            {recent.map((t: any) => {
              const name = t.merchant || t.description || 'Unknown'
              const catName = t.categories?.name ?? 'Uncategorized'
              const emoji = getCatEmoji(catName, t.categories?.icon)
              const isExpense = t.amount < 0
              return (
                <Link key={t.id} href={`/budget/${t.id}`}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition">
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
                    {!isExpense ? '+' : '-'}${Math.abs(Number(t.amount)).toFixed(2)}
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
  )
}
