export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import AccountsPageClient from '@/app/components/budget/AccountsPageClient'
import AccountsView from '@/app/components/budget/AccountsView'
import { type Account } from '@/lib/account-utils'

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: balanceHistory },
    { data: plaidItems },
    { data: plaidAccounts },
    { data: manualAccounts },
  ] = await Promise.all([
    supabase
      .from('account_balance_history')
      .select('account_name, date, balance')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
    supabase
      .from('plaid_items')
      .select('item_id, institution_name')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('plaid_accounts')
      .select('account_id, name, type, mask, current_balance, owner, item_id')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, is_active, is_asset, notes, sort_order, owner')
      .eq('user_id', user.id)
      .order('is_active', { ascending: false })
      .order('sort_order', { ascending: true }),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Breadcrumbs items={[{ label: 'Budget', href: '/budget' }, { label: 'Accounts' }]} />
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Accounts</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <AccountsPageClient
          initialBalanceHistory={(balanceHistory ?? []) as any}
          plaidAccounts={(plaidAccounts ?? []) as any}
          plaidItems={(plaidItems ?? []) as any}
        />

        {/* Manual accounts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">Manual Accounts</p>
          <AccountsView userId={user.id} initialAccounts={(manualAccounts || []) as Account[]} />
        </div>
      </div>
    </div>
  )
}
