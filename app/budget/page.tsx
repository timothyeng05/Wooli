import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TransactionList from '@/app/components/budget/TransactionList'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import SyncTransactionsButton from '@/app/components/budget/SyncTransactionsButton'

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1).toISOString()
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  return { start, end }
}

export default async function BudgetPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const { start, end } = monthRange(now.getFullYear(), now.getMonth())

  const [txnResult, catResult] = await Promise.all([
    supabase
      .from('transactions')
      .select(`
        id, amount, description, merchant, transacted_at,
        categories ( id, name, color )
      `)
      .eq('user_id', user.id)
      .gte('transacted_at', start)
      .lte('transacted_at', end)
      .order('transacted_at', { ascending: false }) as any,
    supabase
      .from('categories')
      .select('id, name, color, is_income')
      .eq('user_id', user.id) as any
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

  const income = transactions.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses = transactions.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)
  const net = income - expenses

  // Category breakdown for expenses
  const catTotals = new Map<string, { name: string; color: string; total: number }>()
  transactions.filter((t: any) => t.amount < 0 && t.categories).forEach((t: any) => {
    const key = t.categories.id
    const existing = catTotals.get(key)
    if (existing) { existing.total += Math.abs(Number(t.amount)) }
    else catTotals.set(key, { name: t.categories.name, color: t.categories.color, total: Math.abs(Number(t.amount)) })
  })
  const sortedCats = Array.from(catTotals.values()).sort((a, b) => b.total - a.total)

  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Budget' }]} />
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Budget</h1>
              <p className="text-gray-600">{monthLabel}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/budget/accounts" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Accounts
              </Link>
              <Link href="/budget/categories" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Categories
              </Link>
              <SyncTransactionsButton />
              <Link
                href="/budget/new"
                className="bg-blue-600 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm"
              >
                + Add Transaction
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500 mb-1">Income</p>
            <p className="text-2xl font-bold text-green-600">+${income.toFixed(0)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500 mb-1">Expenses</p>
            <p className="text-2xl font-bold text-red-600">-${expenses.toFixed(0)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500 mb-1">Net</p>
            <p className={`text-2xl font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {net >= 0 ? '+' : '-'}${Math.abs(net).toFixed(0)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Category breakdown */}
          {sortedCats.length > 0 && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Spending by Category</h2>
                <div className="space-y-3">
                  {sortedCats.slice(0, 8).map(cat => (
                    <div key={cat.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-gray-700">{cat.name}</span>
                        </div>
                        <span className="font-medium text-gray-900">${cat.total.toFixed(0)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            backgroundColor: cat.color,
                            width: `${Math.min(100, (cat.total / expenses) * 100).toFixed(1)}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Transactions */}
          <div className={sortedCats.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Transactions</h2>
              <TransactionList transactions={transactions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
