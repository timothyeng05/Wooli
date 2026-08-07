export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import InvestmentsClient, { type InvestmentAccount, type InvestmentHolding } from '@/app/components/budget/InvestmentsClient'

export default async function InvestmentsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const [
    { data: manualAccounts },
    { data: syncedAccounts },
    { data: members },
    { data: holdingsRows },
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, institution, current_balance, owner, type, exclude_from_net_worth')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('type', 'investment'),
    supabase
      .from('synced_accounts')
      .select('id, provider_account_id, name, org_name, current_balance, owner, type, type_override, exclude_from_net_worth')
      .eq('user_id', user.id),
    supabase
      .from('household_members')
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    // account_holdings may not exist yet (migrations 050/051) — read defensively.
    supabase
      .from('account_holdings')
      .select('account_id, synced_account_id, fund_name, asset_class, current_mix_pct, future_mix_pct, statement_start, statement_end, opening_balance, gains_losses, other_activity, closing_balance, units, fund_price, fund_return_pct, cost_basis, unrealized_gain_loss')
      .eq('user_id', user.id)
      .order('statement_end', { ascending: false }),
  ])

  // Keyed by account_id for manual accounts, synced_account_id (synced_accounts.id,
  // not provider_account_id) for synced ones — a holdings row has exactly one of the two set.
  const holdingsByKey = new Map<string, InvestmentHolding[]>()
  for (const h of holdingsRows ?? []) {
    const key = h.account_id ?? h.synced_account_id
    if (!key) continue
    const existing = holdingsByKey.get(key) ?? []
    if (existing.some(e => e.fundName === h.fund_name)) continue // keep only the newest statement per fund
    existing.push({
      fundName: h.fund_name,
      assetClass: h.asset_class,
      mixPct: h.current_mix_pct === null ? null : Number(h.current_mix_pct),
      futureMixPct: h.future_mix_pct === null ? null : Number(h.future_mix_pct),
      statementStart: h.statement_start,
      statementEnd: h.statement_end,
      openingBalance: h.opening_balance === null ? null : Number(h.opening_balance),
      gainsLosses: h.gains_losses === null ? null : Number(h.gains_losses),
      otherActivity: h.other_activity === null ? null : Number(h.other_activity),
      closingBalance: Number(h.closing_balance) || 0,
      units: h.units === null ? null : Number(h.units),
      fundPrice: h.fund_price === null ? null : Number(h.fund_price),
      returnPct: h.fund_return_pct === null ? null : Number(h.fund_return_pct),
      costBasis: h.cost_basis === null ? null : Number(h.cost_basis),
      unrealizedGainLoss: h.unrealized_gain_loss === null ? null : Number(h.unrealized_gain_loss),
    })
    holdingsByKey.set(key, existing)
  }

  function syncedIsInvestment(type: string | null, override: string | null) {
    if (override) return override === 'investment'
    return type === 'investment'
  }

  const accounts: InvestmentAccount[] = [
    ...(manualAccounts ?? [])
      .filter(a => !a.exclude_from_net_worth)
      .map(a => ({
        id: a.id,
        name: a.name,
        institution: a.institution ?? null,
        owner: a.owner,
        balance: Number(a.current_balance) || 0,
        source: 'manual' as const,
        holdings: holdingsByKey.get(a.id) ?? [],
      })),
    ...(syncedAccounts ?? [])
      .filter(a => !a.exclude_from_net_worth && syncedIsInvestment(a.type, a.type_override ?? null))
      .map(a => ({
        id: a.provider_account_id,
        name: a.name,
        institution: a.org_name ?? null,
        owner: a.owner,
        balance: Number(a.current_balance) || 0,
        source: 'synced' as const,
        holdings: holdingsByKey.get(a.id) ?? [],
      })),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <InvestmentsClient accounts={accounts} members={members ?? []} />
      </div>
    </div>
  )
}
