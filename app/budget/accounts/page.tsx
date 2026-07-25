export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { depreciatedValue } from '@/lib/budget/account-utils'
import AccountsPageClient, { AddAccountMenu, type UnifiedAccount } from '@/app/components/budget/AccountsPageClient'

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  let [
    { data: plaidAccounts },
    { data: plaidItems },
    { data: manualAccounts },
    { data: netWorthHistory },
    { data: members },
    institutionLogosResult,
  ] = await Promise.all([
    supabase
      .from('plaid_accounts')
      .select('account_id, name, mask, type, subtype, current_balance, owner, item_id, updated_at, is_hidden, exclude_from_net_worth, nickname, type_override, sort_order')
      .eq('user_id', user.id),
    supabase
      .from('plaid_items')
      .select('item_id, institution_name, status, error_code, error_message, last_successful_sync_at')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, is_active, is_asset, notes, sort_order, owner, updated_at, exclude_from_net_worth, purchase_price, purchase_date, depreciation_months, residual_value')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('net_worth_history')
      .select('recorded_on, net_worth')
      .eq('user_id', user.id)
      .order('recorded_on', { ascending: true }),
    supabase
      .from('household_members')
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    // institution_logos may not exist yet (migration 043) — read defensively.
    supabase.from('institution_logos').select('institution_name, logo_url').eq('user_id', user.id),
  ])

  const institutionLogoMap = new Map(
    (institutionLogosResult.data ?? []).map(l => [l.institution_name, l.logo_url])
  )

  // linked_account_id may not exist yet (migration 044) — read defensively.
  const { data: linkedRecurring } = await supabase
    .from('recurring_transactions')
    .select('id, linked_account_id')
    .eq('user_id', user.id)
    .not('linked_account_id', 'is', null)
  const depreciationRecurringMap = new Map(
    (linkedRecurring ?? []).map(r => [r.linked_account_id as string, r.id])
  )

  // Fallback while migration 039 (item health columns) hasn't run yet — the
  // extended select errors on unknown columns, so retry with the base set.
  if (!plaidItems) {
    const { data } = await supabase
      .from('plaid_items')
      .select('item_id, institution_name')
      .eq('user_id', user.id)
    plaidItems = (data ?? []).map(i => ({
      ...i, status: 'healthy', error_code: null, error_message: null, last_successful_sync_at: null,
    }))
  }

  // Fallback while migration 040 (type_override + sort_order) hasn't run yet.
  if (!plaidAccounts) {
    const { data } = await supabase
      .from('plaid_accounts')
      .select('account_id, name, mask, type, subtype, current_balance, owner, item_id, updated_at, is_hidden, exclude_from_net_worth, nickname')
      .eq('user_id', user.id)
    plaidAccounts = (data ?? []).map(a => ({ ...a, type_override: null, sort_order: 0 }))
  }

  // Fallback while migration 041 (depreciation columns) hasn't run yet.
  if (!manualAccounts) {
    const { data } = await supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, is_active, is_asset, notes, sort_order, owner, updated_at, exclude_from_net_worth')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    manualAccounts = (data ?? []).map(a => ({
      ...a, purchase_price: null, purchase_date: null, depreciation_months: null, residual_value: 0,
    }))
  }

  // ── Recompute 'vehicle' accounts so current_balance stays accurate for
  // every reader (Goals, Forecast, net worth) without duplicating the math.
  for (const a of manualAccounts) {
    if (a.type !== 'vehicle' || !a.purchase_price || !a.purchase_date || !a.depreciation_months) continue
    const computed = depreciatedValue(Number(a.purchase_price), a.purchase_date, a.depreciation_months, Number(a.residual_value) || 0)
    if (Math.abs(computed - Number(a.current_balance)) > 0.005) {
      await supabase.from('accounts').update({ current_balance: computed }).eq('id', a.id)
      a.current_balance = computed
    }
  }

  // ── Last synced timestamp (max updated_at across Plaid accounts) ──────────
  const lastSynced = (plaidAccounts ?? []).reduce<string | null>((max, a) => {
    if (!a.updated_at) return max
    return max === null || a.updated_at > max ? a.updated_at : max
  }, null)

  // ── Build unified account list ──────────────────────────────────────────────
  const institutionMap = new Map((plaidItems ?? []).map(i => [i.item_id, i.institution_name]))

  function plaidType(type: string, override: string | null): UnifiedAccount['type'] {
    if (override === 'cash' || override === 'investment' || override === 'credit' || override === 'loan') return override
    if (type === 'credit' || type === 'loan') return type as 'credit' | 'loan'
    if (type === 'investment') return 'investment'
    return 'cash'
  }

  function manualType(type: string): UnifiedAccount['type'] {
    if (type === 'credit' || type === 'loan') return type as 'credit' | 'loan'
    if (type === 'vehicle') return 'vehicle'
    if (type === 'investment' || type === 'savings') return 'investment'
    return 'cash'
  }

  const unified: UnifiedAccount[] = [
    ...(plaidAccounts ?? []).map(a => {
      const institution = institutionMap.get(a.item_id) ?? null
      return {
        id: a.account_id,
        name: a.name,
        mask: a.mask,
        type: plaidType(a.type, a.type_override ?? null),
        institution,
        balance: a.current_balance ?? 0,
        owner: a.owner,
        updatedAt: a.updated_at ?? null,
        source: 'plaid' as const,
        is_hidden: a.is_hidden ?? false,
        exclude_from_net_worth: a.exclude_from_net_worth ?? false,
        nickname: a.nickname ?? null,
        sortOrder: a.sort_order ?? 0,
        logoUrl: institution ? institutionLogoMap.get(institution) ?? null : null,
      }
    }),
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
      exclude_from_net_worth: (a as any).exclude_from_net_worth ?? false,
      sortOrder: a.sort_order ?? 0,
      purchasePrice: a.purchase_price ?? null,
      purchaseDate: a.purchase_date ?? null,
      depreciationMonths: a.depreciation_months ?? null,
      residualValue: a.residual_value ?? 0,
      logoUrl: a.institution ? institutionLogoMap.get(a.institution) ?? null : null,
      depreciationRecurringId: depreciationRecurringMap.get(a.id) ?? null,
    })),
  ]

  // Upsert today's net worth snapshot so the chart has a data point for every visit
  // Hidden accounts still count toward net worth; only exclude_from_net_worth removes them
  const countedUnified = unified.filter(a => !a.exclude_from_net_worth)
  const assets = countedUnified.filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
  // No Math.abs: a negative Plaid credit balance means the cardholder is in
  // credit (e.g. overpaid), which should reduce liabilities, not inflate them.
  const liabilities = countedUnified.filter(a => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + a.balance, 0)
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
          <AddAccountMenu userId={user.id} members={members ?? []} />
        </div>
        <AccountsPageClient
          accounts={unified}
          netWorthHistory={(freshNetWorthHistory ?? []) as { recorded_on: string; net_worth: number }[]}
          userId={user.id}
          lastSynced={lastSynced}
          members={members ?? []}
          plaidItems={(plaidItems ?? []) as { item_id: string; institution_name: string | null; status: string; error_code: string | null; error_message: string | null; last_successful_sync_at: string | null }[]}
        />
      </div>
    </div>
  )
}
