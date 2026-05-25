export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import PlaidLinkButton from '@/app/components/budget/PlaidLinkButton'
import AccountsView from '@/app/components/budget/AccountsView'
import AccountsPageClient, { type UnifiedAccount, type BalancePoint } from '@/app/components/budget/AccountsPageClient'
import { type Account } from '@/lib/account-utils'

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: plaidAccounts },
    { data: plaidItems },
    { data: manualAccounts },
    { data: history },
  ] = await Promise.all([
    supabase
      .from('plaid_accounts')
      .select('account_id, name, mask, type, subtype, current_balance, owner, item_id')
      .eq('user_id', user.id),
    supabase
      .from('plaid_items')
      .select('item_id, institution_name')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, is_active, is_asset, notes, sort_order, owner')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('account_balance_history')
      .select('account_id, date, balance')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
  ])

  // ── Build unified account list ──────────────────────────────────────────────
  const institutionMap = new Map((plaidItems ?? []).map(i => [i.item_id, i.institution_name]))

  function plaidType(type: string): UnifiedAccount['type'] {
    if (type === 'credit' || type === 'loan') return type as 'credit' | 'loan'
    if (type === 'investment') return 'investment'
    return 'cash'
  }

  function manualType(type: string): UnifiedAccount['type'] {
    if (type === 'credit' || type === 'loan') return type as 'credit' | 'loan'
    if (type === 'investment' || type === 'savings') return 'investment'
    return 'cash'
  }

  const unified: UnifiedAccount[] = [
    ...(plaidAccounts ?? []).map(a => ({
      id: a.account_id,
      name: a.name,
      mask: a.mask,
      type: plaidType(a.type),
      institution: institutionMap.get(a.item_id) ?? null,
      balance: a.current_balance ?? 0,
      owner: a.owner,
      source: 'plaid' as const,
    })),
    ...(manualAccounts ?? []).map(a => ({
      id: a.id,
      name: a.name,
      mask: null,
      type: manualType(a.type),
      institution: a.institution ?? null,
      balance: a.current_balance ?? 0,
      owner: a.owner,
      source: 'manual' as const,
    })),
  ]

  // ── Auto-snapshot today's balances ─────────────────────────────────────────
  // Only runs if we haven't snapshotted today yet for any account
  const todayHistory = (history ?? []).filter(h => h.date === today)
  const snapshotted = new Set(todayHistory.map(h => h.account_id))
  const toInsert = unified
    .filter(a => !snapshotted.has(a.id))
    .map(a => ({
      user_id: user.id,
      account_id: a.id,
      account_name: a.name,
      date: today,
      balance: a.balance,
    }))

  if (toInsert.length > 0) {
    await supabase
      .from('account_balance_history')
      .upsert(toInsert, { onConflict: 'user_id,account_id,date' })
  }

  // Re-read history now that today is included
  const { data: freshHistory } = toInsert.length > 0
    ? await supabase
        .from('account_balance_history')
        .select('account_id, date, balance')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
    : { data: history }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <Breadcrumbs items={[{ label: 'Budget', href: '/budget' }, { label: 'Accounts' }]} />
          <div className="flex items-center justify-between mt-3">
            <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
            <PlaidLinkButton />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <AccountsPageClient
          accounts={unified}
          history={(freshHistory ?? []) as BalancePoint[]}
        />

        {/* Manual accounts management */}
        {(manualAccounts?.length ?? 0) > 0 || true ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">Manage Manual Accounts</p>
            <AccountsView
              userId={user.id}
              initialAccounts={(manualAccounts || []) as Account[]}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
