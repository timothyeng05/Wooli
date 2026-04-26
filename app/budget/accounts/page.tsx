import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import AccountsView from '@/app/components/budget/AccountsView'
import { type Account } from '@/lib/account-utils'

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('accounts')
    .select('id, name, type, institution, current_balance, is_active, is_asset, notes, sort_order')
    .eq('user_id', user.id)
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const accounts = (data || []) as Account[]

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[
            { label: 'Budget', href: '/budget' },
            { label: 'Accounts' },
          ]} />
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Accounts</h1>
              <p className="text-gray-600">Where your money lives</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <AccountsView userId={user.id} initialAccounts={accounts} />
      </div>
    </div>
  )
}
