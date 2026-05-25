import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TransactionForm from '@/app/components/budget/TransactionForm'

export default async function NewTransactionPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, color, is_income, parent_id, sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }) as any,
    supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name') as any,
  ])

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Add Transaction</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Add Transaction</h2>

          {(!categories || categories.length === 0) ? (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              No categories set up yet.{' '}
              <Link href="/budget/categories" className="underline font-medium">Set up categories</Link>
              {' '}to organize your transactions.
            </div>
          ) : null}

          <TransactionForm
            userId={user.id}
            categories={categories || []}
            accounts={accounts || []}
            defaultDate={date}
          />
        </div>
      </div>
    </div>
  )
}
