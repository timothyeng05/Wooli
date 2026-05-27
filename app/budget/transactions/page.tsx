export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TransactionList from '@/app/components/budget/TransactionList'
import MonthNav from '@/app/components/budget/MonthNav'
import SyncTransactionsButton from '@/app/components/budget/SyncTransactionsButton'

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1).toISOString()
  const end   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  return { start, end }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { year: yearStr, month: monthStr } = await searchParams
  const now   = new Date()
  const year  = yearStr  ? parseInt(yearStr)  : now.getFullYear()
  const month = monthStr ? parseInt(monthStr) : now.getMonth()
  const { start, end } = monthRange(year, month)

  // Auto-generate any due recurring transactions
  const today = new Date().toISOString().split('T')[0]
  const { data: dueRecurring } = await supabase
    .from('recurring_transactions')
    .select('id, amount, description, merchant, category_id, next_date, frequency, day_of_month')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .lte('next_date', today)

  if (dueRecurring?.length) {
    for (const item of dueRecurring) {
      await supabase.from('transactions').insert({
        user_id:      user.id,
        amount:       item.amount,
        description:  item.description,
        merchant:     item.merchant,
        category_id:  item.category_id,
        transacted_at: item.next_date + 'T12:00:00',
      })
      const d = new Date(item.next_date + 'T00:00:00')
      if      (item.frequency === 'monthly')  { d.setMonth(d.getMonth() + 1); d.setDate(item.day_of_month ?? 1) }
      else if (item.frequency === 'biweekly') d.setDate(d.getDate() + 14)
      else if (item.frequency === 'weekly')   d.setDate(d.getDate() + 7)
      else if (item.frequency === 'yearly')   d.setFullYear(d.getFullYear() + 1)
      await supabase.from('recurring_transactions')
        .update({ next_date: d.toISOString().split('T')[0], last_generated_date: item.next_date })
        .eq('id', item.id)
    }
  }

  // Last synced timestamp
  const { data: plaidAccts } = await supabase
    .from('plaid_accounts')
    .select('updated_at')
    .eq('user_id', user.id)

  const lastSynced = (plaidAccts ?? []).reduce<string | null>((max, a) => {
    if (!a.updated_at) return max
    return max === null || a.updated_at > max ? a.updated_at : max
  }, null)

  const [txnResult, catResult] = await Promise.all([
    supabase
      .from('transactions')
      .select(`
        id, amount, description, merchant, transacted_at, plaid_transaction_id,
        is_transfer, is_pending, owner, account_name,
        categories ( id, name, color, icon )
      `)
      .eq('user_id', user.id)
      .gte('transacted_at', start)
      .lte('transacted_at', end)
      .order('transacted_at', { ascending: false }) as any,
    supabase
      .from('categories')
      .select('id, name, color, is_income, is_transfer, parent_id, icon')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }) as any,
  ])

  const transactions = txnResult.data || []
  const categories   = catResult.data || []

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky page header */}
      <div className="sticky top-[53px] z-30 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Transactions</h1>
            <MonthNav year={year} month={month} />
          </div>
          <div className="flex items-center gap-2">
            <SyncTransactionsButton lastSynced={lastSynced} />
            <Link
              href="/budget/new"
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              <span className="text-lg leading-none">+</span>
              <span className="hidden sm:inline">Add</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <TransactionList transactions={transactions} categories={categories} />
      </div>
    </div>
  )
}
