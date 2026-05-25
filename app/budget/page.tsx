export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TransactionList from '@/app/components/budget/TransactionList'
import MonthNav from '@/app/components/budget/MonthNav'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import SyncTransactionsButton from '@/app/components/budget/SyncTransactionsButton'
import RecategorizeButton from '@/app/components/budget/RecategorizeButton'

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1).toISOString()
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  return { start, end }
}

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { year: yearStr, month: monthStr } = await searchParams
  const now = new Date()
  const year = yearStr ? parseInt(yearStr) : now.getFullYear()
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
        user_id: user.id,
        amount: item.amount,
        description: item.description,
        merchant: item.merchant,
        category_id: item.category_id,
        transacted_at: item.next_date + 'T12:00:00',
      })
      const d = new Date(item.next_date + 'T00:00:00')
      if (item.frequency === 'monthly') { d.setMonth(d.getMonth() + 1); d.setDate(item.day_of_month ?? 1) }
      else if (item.frequency === 'biweekly') d.setDate(d.getDate() + 14)
      else if (item.frequency === 'weekly') d.setDate(d.getDate() + 7)
      else if (item.frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
      await supabase.from('recurring_transactions')
        .update({ next_date: d.toISOString().split('T')[0], last_generated_date: item.next_date })
        .eq('id', item.id)
    }
  }

  const [txnResult, catResult] = await Promise.all([
    supabase
      .from('transactions')
      .select(`
        id, amount, description, merchant, transacted_at, plaid_transaction_id, is_transfer, is_pending, owner, account_name,
        categories ( id, name, color )
      `)
      .eq('user_id', user.id)
      .gte('transacted_at', start)
      .lte('transacted_at', end)
      .order('transacted_at', { ascending: false }) as any,
    supabase
      .from('categories')
      .select('id, name, color, is_income, parent_id')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }) as any
  ])

  const needsMigration =
    txnResult.error?.code === '42P01' || txnResult.error?.message?.includes('does not exist')

  if (needsMigration) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Breadcrumbs items={[{ label: 'Budget' }]} />
            <h1 className="text-4xl font-bold text-gray-900 mb-2 mt-4">Budget</h1>
            <p className="text-gray-600">Track your spending</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Setup required</h2>
            <p className="text-gray-600 mb-4">
              Run the migration in <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">supabase/migrations/008_budget_module.sql</code> in your Supabase SQL editor, then refresh.
            </p>
            <Link href="/budget/categories" className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
              Go to Categories Setup
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const transactions = txnResult.data || []
  const categories = catResult.data || []

  const nonTransfers = transactions.filter((t: any) => !t.is_transfer)
  const transferTxns = transactions.filter((t: any) => t.is_transfer)
  const income = nonTransfers.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses = nonTransfers.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)
  const transfersOut = transferTxns.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)
  const net = income - expenses

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <Breadcrumbs items={[{ label: 'Budget' }]} />
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mr-2">Budget</h1>
                <MonthNav year={year} month={month} />
              </div>
              <Link
                href="/budget/new"
                className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
              >
                + Add
              </Link>
            </div>
            <div className="flex items-center gap-3 mt-3 overflow-x-auto pb-1">
              <Link href="/budget/networth" className="text-sm text-gray-500 hover:text-gray-900 font-medium whitespace-nowrap">
                Net Worth
              </Link>
              <Link href="/budget/import" className="text-sm text-gray-500 hover:text-gray-900 font-medium whitespace-nowrap">
                Import CSV
              </Link>
              <Link href="/budget/accounts" className="text-sm text-gray-500 hover:text-gray-900 font-medium whitespace-nowrap">
                Accounts
              </Link>
              <Link href="/budget/categories" className="text-sm text-gray-500 hover:text-gray-900 font-medium whitespace-nowrap">
                Categories
              </Link>
              <Link href="/budget/recurring" className="text-sm text-gray-500 hover:text-gray-900 font-medium whitespace-nowrap">
                Recurring
              </Link>
              <RecategorizeButton />
              <SyncTransactionsButton />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-5">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Income</p>
            <p className="text-lg sm:text-2xl font-bold text-green-600">+${income.toFixed(0)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-5">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Expenses</p>
            <p className="text-lg sm:text-2xl font-bold text-red-600">-${expenses.toFixed(0)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-5">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Transfers</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-500">${transfersOut.toFixed(0)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-5">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Net</p>
            <p className={`text-lg sm:text-2xl font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {net >= 0 ? '+' : '-'}${Math.abs(net).toFixed(0)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <TransactionList transactions={transactions} categories={categories} />
        </div>
      </div>
    </div>
  )
}
