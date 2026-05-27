export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PlaidLinkButton from '@/app/components/budget/PlaidLinkButton'
import AccountsPageClient, { type UnifiedAccount, type BalancePoint } from '@/app/components/budget/AccountsPageClient'

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
    { data: netWorthHistory },
  ] = await Promise.all([
    supabase
      .from('plaid_accounts')
      .select('account_id, name, mask, type, subtype, current_balance, owner, item_id, updated_at')
      .eq('user_id', user.id),
    supabase
      .from('plaid_items')
      .select('item_id, institution_name')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, is_active, is_asset, notes, sort_order, owner, updated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('account_balance_history')
      .select('account_id, date, balance')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
    supabase
      .from('net_worth_history')
      .select('recorded_on, net_worth')
      .eq('user_id', user.id)
      .order('recorded_on', { ascending: true }),
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
      updatedAt: a.updated_at ?? null,
      source: 'plaid' as const,
    })),
    ...(manualAccounts ?? []).map(a => ({
      id: a.id,
      name: a.name,
      mask: null,
      type: manualType(a.type),
      rawType: a.type,
      institution: a.institution ?? null,
      balance: a.current_balance ?? 0,
      owner: a.owner,
      updatedAt: a.updated_at ?? null,
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

  // Also upsert today's net worth snapshot so the chart has a data point for every visit
  const assets = unified.filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
  const liabilities = unified.filter(a => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + Math.abs(a.balance), 0)
  await supabase.from('net_worth_history').upsert(
    { user_id: user.id, recorded_on: today, assets, liabilities, net_worth: assets - liabilities },
    { onConflict: 'user_id,recorded_on' }
  )

  // Re-read net_worth_history to include today
  const { data: freshNetWorthHistory } = await supabase
    .from('net_worth_history')
    .select('recorded_on, net_worth')
    .eq('user_id', user.id)
    .order('recorded_on', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Accounts</h1>
          <PlaidLinkButton />
        </div>
        <AccountsPageClient
          accounts={unified}
          history={(freshHistory ?? []) as BalancePoint[]}
          netWorthHistory={(freshNetWorthHistory ?? []) as { recorded_on: string; net_worth: number }[]}
          userId={user.id}
        />
      </div>
    </div>
  )
}
