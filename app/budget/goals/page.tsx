export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import GoalsPageClient, { type Goal } from '@/app/components/budget/GoalsPageClient'
import type { UnifiedAccount } from '@/app/components/budget/AccountsPageClient'

export default async function GoalsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: goals },
    { data: plaidAccounts },
    { data: plaidItems },
    { data: manualAccounts },
  ] = await Promise.all([
    supabase
      .from('budget_goals')
      .select('id, name, icon, color, target_amount, target_date, current_amount, linked_account_ids, notes, sort_order')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('target_date', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('plaid_accounts')
      .select('account_id, name, type, current_balance, item_id')
      .eq('user_id', user.id),
    supabase
      .from('plaid_items')
      .select('item_id, institution_name')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, owner')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  const institutionMap = new Map((plaidItems ?? []).map(i => [i.item_id, i.institution_name]))

  function plaidType(type: string): UnifiedAccount['type'] {
    if (type === 'credit' || type === 'loan') return type as 'credit' | 'loan'
    if (type === 'investment') return 'investment'
    return 'cash'
  }

  const accounts: UnifiedAccount[] = [
    ...(plaidAccounts ?? []).map(a => ({
      id: a.account_id,
      name: a.name,
      mask: null,
      type: plaidType(a.type),
      institution: institutionMap.get(a.item_id) ?? null,
      balance: a.current_balance ?? 0,
      owner: null,
      source: 'plaid' as const,
    })),
    ...(manualAccounts ?? []).map(a => ({
      id: a.id,
      name: a.name,
      mask: null,
      type: 'cash' as UnifiedAccount['type'],
      institution: a.institution ?? null,
      balance: a.current_balance ?? 0,
      owner: a.owner ?? null,
      source: 'manual' as const,
    })),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Goals</h1>
        <GoalsPageClient
          goals={(goals ?? []) as Goal[]}
          accounts={accounts}
          userId={user.id}
        />
      </div>
    </div>
  )
}
