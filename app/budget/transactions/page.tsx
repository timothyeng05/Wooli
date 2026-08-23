export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import TransactionList from '@/app/components/budget/TransactionList'
import SyncTransactionsButton from '@/app/components/budget/SyncTransactionsButton'
import MonthNav from '@/app/components/budget/MonthNav'
import { SIMPLEFIN_TRANSACTION_SYNC_ENABLED } from '@/lib/budget/sync-config'
import { visibleTransactionsFilter } from '@/lib/budget/hidden-accounts'

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
  const user = await getServerUser()
  if (!user) redirect('/login')

  const monthStart = new Date(year, resolvedMonth, 1).toISOString()
  const monthEnd   = new Date(year, resolvedMonth + 1, 0, 23, 59, 59).toISOString()

  // All independent reads run concurrently — transactions overlap with the
  // smaller metadata queries instead of blocking them serially.
  // Transactions on a hidden account are dropped here rather than client-side,
  // so the row windowing in TransactionList counts only rows that will render.
  const onlyVisible = await visibleTransactionsFilter(supabase, user.id)

  const fetchMonthTransactions = async () => {
    // Supabase caps each request at 1000 rows, so paginate.
    const PAGE = 1000
    let all: any[] = []
    for (let page = 0; ; page++) {
      const q = supabase
        .from('transactions')
        .select(`
          id, amount, description, merchant, transacted_at, provider_transaction_id,
          is_transfer, is_pending, needs_review, owner, account_name, trip_id, account_id, notes,
          is_recurring, recurring_id, is_hidden,
          categories ( id, name, color, icon, is_income ),
          trips ( id, name )
        `)
        .eq('user_id', user.id)
        .gte('transacted_at', monthStart)
        .lte('transacted_at', monthEnd)
        .order('transacted_at', { ascending: false })
        .range(page * PAGE, (page + 1) * PAGE - 1)
      const { data } = await onlyVisible(q) as any
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < PAGE) break
    }
    return all
  }

  const [transactions, syncedResult, catResult, tripResult, memberResult, acctResult, syncedAcctResult] = await Promise.all([
    fetchMonthTransactions(),
    supabase
      .from('synced_accounts')
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
    // Account lists for the editor sheet — it is now the only place a
    // transaction's account can be changed.
    supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name') as any,
    supabase
      .from('synced_accounts')
      .select('id, name, mask')
      .eq('user_id', user.id)
      .order('name') as any,
  ])

  // Last synced = most recent synced_accounts.updated_at
  const lastSynced = (syncedResult.data ?? []).reduce((max: string | null, a: { updated_at: string | null }) => {
    if (!a.updated_at) return max
    return max === null || a.updated_at > max ? a.updated_at : max
  }, null as string | null)

  const categories     = catResult.data || []
  const trips          = tripResult.data || []
  const members        = memberResult.data || []
  const accounts       = acctResult.data || []
  const syncedAccounts = syncedAcctResult.data || []

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-[53px] z-30 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-0">

          {/* Single row on sm+, two rows on mobile. MonthNav is rendered ONCE and
              repositioned with flex order — it used to be rendered twice, in a
              `hidden sm:flex` wrapper and again in an `sm:hidden` row, which meant
              two live month pickers in the DOM at every viewport. */}
          <div className="flex flex-wrap items-center justify-between gap-3 sm:h-14 sm:flex-nowrap">
            <h1 className="order-1 text-xl font-bold text-gray-900">Transactions</h1>

            <div className="order-3 basis-full flex justify-center pb-2 sm:order-2 sm:basis-auto sm:flex-1 sm:pb-0">
              <MonthNav year={year} month={resolvedMonth} />
            </div>

            <div className="order-2 flex items-center gap-2 sm:order-3">
              {SIMPLEFIN_TRANSACTION_SYNC_ENABLED && <SyncTransactionsButton lastSynced={lastSynced} />}
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        {/* Keyed by month so a MonthNav navigation remounts the list. Without
            this the rows never change: TransactionList seeds its `items` state
            from this prop with useState, which ignores a new initial value, so
            switching month updated the header and refetched the data but kept
            painting the previous month's transactions. Remounting also clears
            search/filter/selection, which is what you want on a month switch. */}
        <TransactionList
          key={`${year}-${resolvedMonth}`}
          transactions={transactions}
          categories={categories}
          trips={trips}
          members={members}
          accounts={accounts}
          syncedAccounts={syncedAccounts}
          initialOwner={initialOwner}
          initialType={initialType}
        />
      </div>
    </div>
  )
}
