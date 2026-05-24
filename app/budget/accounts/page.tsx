import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import PlaidLinkButton from '@/app/components/budget/PlaidLinkButton'
import AccountsView from '@/app/components/budget/AccountsView'
import { type Account } from '@/lib/account-utils'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  depository: 'Checking / Savings',
  credit: 'Credit Card',
  investment: 'Investment',
  loan: 'Loan',
  other: 'Other',
}

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: manualAccounts }, { data: plaidItems }, { data: plaidAccounts }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, is_active, is_asset, notes, sort_order, owner')
      .eq('user_id', user.id)
      .order('is_active', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('plaid_items')
      .select('item_id, institution_name')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('plaid_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('type'),
  ])

  const totalAssets = plaidAccounts
    ?.filter(a => a.type !== 'credit' && a.type !== 'loan')
    .reduce((s, a) => s + (a.current_balance ?? 0), 0) ?? 0

  const totalDebt = plaidAccounts
    ?.filter(a => a.type === 'credit' || a.type === 'loan')
    .reduce((s, a) => s + (a.current_balance ?? 0), 0) ?? 0

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Budget', href: '/budget' }, { label: 'Accounts' }]} />
          <div className="flex items-start justify-between mt-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Accounts</h1>
              <p className="text-gray-600">Where your money lives</p>
            </div>
            <PlaidLinkButton />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Connected accounts via Plaid */}
        {(plaidItems?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Connected Accounts</h2>
              <div className="grid grid-cols-3 gap-3 text-right">
                <div>
                  <p className="text-xs text-gray-400">Net Worth</p>
                  <p className={`text-sm font-bold ${totalAssets - totalDebt >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    ${(totalAssets - totalDebt).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Assets</p>
                  <p className="text-sm font-bold text-green-700">
                    ${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Debt</p>
                  <p className="text-sm font-bold text-red-600">
                    ${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {plaidItems?.map(item => {
                const accounts = plaidAccounts?.filter(a => a.item_id === item.item_id) ?? []
                return (
                  <div key={item.item_id} className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <p className="font-semibold text-gray-900">{item.institution_name ?? 'Bank'}</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {accounts.map(account => (
                        <div key={account.account_id} className="flex items-center justify-between px-4 py-3.5">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {account.name}
                              {account.mask && <span className="text-gray-400 font-normal"> ···{account.mask}</span>}
                            </p>
                            <p className="text-xs text-gray-400">{ACCOUNT_TYPE_LABELS[account.type] ?? account.type}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${account.type === 'credit' || account.type === 'loan' ? 'text-red-600' : 'text-gray-900'}`}>
                              ${(account.current_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            {account.available_balance !== null && account.available_balance !== account.current_balance && (
                              <p className="text-xs text-gray-400">${account.available_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} avail.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Manual accounts */}
        <div>
          {(plaidItems?.length ?? 0) > 0 && (
            <h2 className="text-lg font-bold text-gray-900 mb-4">Manual Accounts</h2>
          )}
          <AccountsView userId={user.id} initialAccounts={(manualAccounts || []) as Account[]} />
        </div>

      </div>
    </div>
  )
}
