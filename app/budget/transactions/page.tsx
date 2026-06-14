export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TransactionList from '@/app/components/budget/TransactionList'
import SyncTransactionsButton from '@/app/components/budget/SyncTransactionsButton'
import MonthNav from '@/app/components/budget/MonthNav'
import { PLAID_TRANSACTION_SYNC_ENABLED } from '@/lib/budget/sync-config'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; type?: string; year?: string; month?: string }>
}) {
  const params = await searchParams
  const initialOwner = params.owner
  const rawType = params.type
  const initialType: 'income' | 'expense' | undefined =
    rawType === 'income' ? 'income' : rawType === 'expense' ? 'expense' : undefined

  const now = new Date()
  const year = parseInt(params.year ?? '') || now.getFullYear()
  const monthParam = parseInt(params.month ?? '')
  const resolvedMonth = isNaN(monthParam) ? now.getMonth() : monthParam

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  const monthStart = new Date(year, resolvedMonth, 1).toISOString()
  const monthEnd   = new Date(year, resolvedMonth + 1, 0, 23, 59, 59).toISOString()

  // All independent reads run concurrently — transactions overlap with the
  // smaller metadata queries instead of blocking them serially.
  const fetchMonthTransactions = async () => {
    // Supabase caps each request at 1000 rows, so paginate.
    const PAGE = 1000
    let all: any[] = []
    for (let page = 0; ; page++) {
      const { data } = await supabase
        .from('transactions')
        .select(`
          id, amount, description, merchant, transacted_at, plaid_transaction_id,
          is_transfer, is_pending, owner, account_name, trip_id,
          categories ( id, name, color, icon ),
          trips ( id, name )
        `)
        .eq('user_id', user.id)
        .gte('transacted_at', monthStart)
        .lte('transacted_at', monthEnd)
        .order('transacted_at', { ascending: false })
        .range(page * PAGE, (page + 1) * PAGE - 1) as any
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < PAGE) break
    }
    return all
  }

  const [transactions, plaidResult, catResult, tripResult, memberResult] = await Promise.all([
    fetchMonthTransactions(),
    supabase
      .from('plaid_accounts')
      .select('updated_at')
      .eq('user_id', user.id) as any,
    supabase
      .from('categories')
      .select('id, name, color, is_income, is_transfer, parent_id, icon')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }) as any,
    supabase
      .from('trips')
      .select('id, name, start_date, end_date')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false }) as any,
    supabase
      .from('household_members')
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
  ])

  // Last synced = most recent plaid_accounts.updated_at
  const lastSynced = (plaidResult.data ?? []).reduce((max: string | null, a: { updated_at: string | null }) => {
    if (!a.updated_at) return max
    return max === null || a.updated_at > max ? a.updated_at : max
  }, null as string | null)

  const categories = catResult.data || []
  const trips      = tripResult.data || []
  const members    = memberResult.data || []

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-[53px] z-30 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-0">

          {/* Single row on sm+, two rows on mobile */}
          <div className="flex items-center justify-between sm:h-14 gap-3">
            <h1 className="text-xl font-bold text-gray-900">Transactions</h1>

            {/* MonthNav: hidden on mobile (shown in row 2 below) */}
            <div className="hidden sm:flex flex-1 justify-center">
              <MonthNav year={year} month={resolvedMonth} />
            </div>

            <div className="flex items-center gap-2">
              {PLAID_TRANSACTION_SYNC_ENABLED && <SyncTransactionsButton lastSynced={lastSynced} />}
              <Link
                href="/budget/new"
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
              >
                <span className="text-lg leading-none">+</span>
                <span className="hidden sm:inline">Add</span>
              </Link>
            </div>
          </div>

          {/* MonthNav row — mobile only, sits below title row */}
          <div className="flex justify-center pb-2 sm:hidden">
            <MonthNav year={year} month={resolvedMonth} />
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <TransactionList
          transactions={transactions}
          categories={categories}
          trips={trips}
          members={members}
          initialOwner={initialOwner}
          initialType={initialType}
        />
      </div>
    </div>
  )
}
