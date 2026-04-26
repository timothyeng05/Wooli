import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TransactionForm from '@/app/components/budget/TransactionForm'
import Breadcrumbs from '@/app/components/Breadcrumbs'

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [txnResult, catResult, acctResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, description, merchant, category_id, account_id, transacted_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
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

  if (!txnResult.data) notFound()

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[
            { label: 'Budget', href: '/budget' },
            { label: 'Edit Transaction' },
          ]} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Transaction</h1>
          <TransactionForm
            userId={user.id}
            categories={catResult.data || []}
            accounts={acctResult.data || []}
            transaction={txnResult.data as any}
          />
        </div>
      </div>
    </div>
  )
}
