export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import { depreciatedValue } from '@/lib/budget/account-utils'
import AccountsPageClient, { AddAccountMenu, type UnifiedAccount } from '@/app/components/budget/AccountsPageClient'

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: syncedAccounts },
    { data: connections },
    { data: manualAccounts },
    { data: netWorthHistory },
    { data: members },
    institutionLogosResult,
  ] = await Promise.all([
    supabase
      .from('synced_accounts')
      .select('id, provider_account_id, name, mask, type, subtype, current_balance, owner, connection_id, org_name, updated_at, is_hidden, exclude_from_net_worth, exclude_from_reports, nickname, type_override, sort_order')
      .eq('user_id', user.id),
    supabase
      .from('bank_connections')
      .select('id, institution_name, status, error_code, error_message, last_successful_sync_at')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, is_active, is_asset, notes, sort_order, owner, updated_at, exclude_from_net_worth, exclude_from_reports, purchase_price, purchase_date, depreciation_months, residual_value')
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

  // account_holdings may not exist yet (migrations 050/051) — read defensively.
  // Keep only each account's most recent statement per fund. A row has
  // either account_id (manual) or synced_account_id (synced_accounts.id) set —
  // resolve the latter back to provider_account_id, since that's what
  // UnifiedAccount.id uses for synced accounts.
  const syncedIdToProviderId = new Map((syncedAccounts ?? []).map(a => [a.id, a.provider_account_id]))
  const { data: allHoldings } = await supabase
    .from('account_holdings')
    .select('account_id, synced_account_id, fund_name, current_mix_pct, fund_return_pct, statement_end')
    .eq('user_id', user.id)
    .order('statement_end', { ascending: false })
  const holdingsByAccount = new Map<string, { fundName: string; mixPct: number | null; returnPct: number | null; statementEnd: string }[]>()
  for (const h of allHoldings ?? []) {
    const key = h.account_id ?? (h.synced_account_id ? syncedIdToProviderId.get(h.synced_account_id) : null)
    if (!key) continue
    const existing = holdingsByAccount.get(key) ?? []
    if (existing.some(e => e.fundName === h.fund_name)) continue // already have a newer statement for this fund
    existing.push({
      fundName: h.fund_name,
      mixPct: h.current_mix_pct === null ? null : Number(h.current_mix_pct),
      returnPct: h.fund_return_pct === null ? null : Number(h.fund_return_pct),
      statementEnd: h.statement_end,
    })
    holdingsByAccount.set(key, existing)
  }

  // linked_account_id may not exist yet (migration 044) — read defensively.
  const { data: linkedRecurring } = await supabase
    .from('recurring_transactions')
    .select('id, linked_account_id')
    .eq('user_id', user.id)
    .not('linked_account_id', 'is', null)
  const depreciationRecurringMap = new Map(
    (linkedRecurring ?? []).map(r => [r.linked_account_id as string, r.id])
  )

  // ── Recompute 'vehicle' accounts so current_balance stays accurate for
  // every reader (Goals, net worth) without duplicating the math.
  for (const a of manualAccounts ?? []) {
    if (a.type !== 'vehicle' || !a.purchase_price || !a.purchase_date || !a.depreciation_months) continue
    const computed = depreciatedValue(Number(a.purchase_price), a.purchase_date, a.depreciation_months, Number(a.residual_value) || 0)
    if (Math.abs(computed - Number(a.current_balance)) > 0.005) {
      await supabase.from('accounts').update({ current_balance: computed }).eq('id', a.id)
      a.current_balance = computed
    }
  }

  // ── Last synced timestamp (max updated_at across synced accounts) ─────────
  const lastSynced = (syncedAccounts ?? []).reduce<string | null>((max, a) => {
    if (!a.updated_at) return max
    return max === null || a.updated_at > max ? a.updated_at : max
  }, null)

  // ── Build unified account list ──────────────────────────────────────────────
  const institutionMap = new Map((connections ?? []).map(c => [c.id, c.institution_name]))

  function syncedType(type: string | null, override: string | null): UnifiedAccount['type'] {
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
    ...(syncedAccounts ?? []).map(a => {
      // A connection can span multiple institutions (one SimpleFin setup token
      // covers the whole bridge) — each account's own org_name always wins over
      // the connection-level label, which is just a display fallback.
      const institution = a.org_name ?? institutionMap.get(a.connection_id) ?? null
      return {
        id: a.provider_account_id,
        name: a.name,
        mask: a.mask,
        type: syncedType(a.type, a.type_override ?? null),
        institution,
        balance: a.current_balance ?? 0,
        owner: a.owner,
        updatedAt: a.updated_at ?? null,
        source: 'synced' as const,
        is_hidden: a.is_hidden ?? false,
        exclude_from_net_worth: a.exclude_from_net_worth ?? false,
        exclude_from_reports: a.exclude_from_reports ?? false,
        nickname: a.nickname ?? null,
        sortOrder: a.sort_order ?? 0,
        logoUrl: institution ? institutionLogoMap.get(institution) ?? null : null,
        holdings: holdingsByAccount.get(a.provider_account_id),
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
      exclude_from_reports: (a as any).exclude_from_reports ?? false,
      sortOrder: a.sort_order ?? 0,
      purchasePrice: a.purchase_price ?? null,
      purchaseDate: a.purchase_date ?? null,
      depreciationMonths: a.depreciation_months ?? null,
      residualValue: a.residual_value ?? 0,
      logoUrl: a.institution ? institutionLogoMap.get(a.institution) ?? null : null,
      depreciationRecurringId: depreciationRecurringMap.get(a.id) ?? null,
      holdings: holdingsByAccount.get(a.id),
    })),
  ]

  // Upsert today's net worth snapshot so the chart has a data point for every visit
  // Hidden accounts still count toward net worth; only exclude_from_net_worth removes them
  const countedUnified = unified.filter(a => !a.exclude_from_net_worth)
  const assets = countedUnified.filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
  // No Math.abs: a negative synced credit balance means the cardholder is in
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
          connections={(connections ?? []) as { id: string; institution_name: string | null; status: string; error_code: string | null; error_message: string | null; last_successful_sync_at: string | null }[]}
        />
      </div>
    </div>
  )
}
