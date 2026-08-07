export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import GoalsPageClient, { type Goal } from '@/app/components/budget/GoalsPageClient'
import type { UnifiedAccount } from '@/app/components/budget/AccountsPageClient'

export default async function GoalsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const [
    { data: goals },
    { data: syncedAccounts },
    { data: connections },
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
      .from('synced_accounts')
      .select('provider_account_id, name, type, current_balance, connection_id')
      .eq('user_id', user.id),
    supabase
      .from('bank_connections')
      .select('id, institution_name')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, owner')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  const institutionMap = new Map((connections ?? []).map(c => [c.id, c.institution_name]))

  function syncedType(type: string | null): UnifiedAccount['type'] {
    if (type === 'credit' || type === 'loan') return type as 'credit' | 'loan'
    if (type === 'investment') return 'investment'
    return 'cash'
  }

  const accounts: UnifiedAccount[] = [
    ...(syncedAccounts ?? []).map(a => ({
      id: a.provider_account_id,
      name: a.name,
      mask: null,
      type: syncedType(a.type),
      institution: institutionMap.get(a.connection_id) ?? null,
      balance: a.current_balance ?? 0,
      owner: null,
      source: 'synced' as const,
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-16">
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
