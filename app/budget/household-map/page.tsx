export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import HouseholdMapClient, { type MapAccount } from '@/app/components/budget/HouseholdMapClient'

function monthBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
  return { start, end }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Same account-type unification as app/budget/accounts/page.tsx, duplicated
// here rather than shared — this page only reads the result, it doesn't need
// the manual-account edit affordances that live alongside that logic there.
function syncedType(type: string | null, override: string | null): MapAccount['type'] {
  if (override === 'cash' || override === 'investment' || override === 'credit' || override === 'loan') return override
  if (type === 'credit' || type === 'loan') return type as 'credit' | 'loan'
  if (type === 'investment') return 'investment'
  return 'cash'
}

function manualType(type: string): MapAccount['type'] {
  if (type === 'credit' || type === 'loan') return type as 'credit' | 'loan'
  if (type === 'vehicle') return 'vehicle'
  // 'savings' is liquid, not invested — bucketing it as an investment hid
  // emergency funds from the Cash liquidity signal, which reported "Tight" for
  // a fully-funded one. Also matches syncedType, where a savings account has
  // always fallen through to 'cash'.
  if (type === 'investment') return 'investment'
  return 'cash'
}

export default async function HouseholdMapPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const now = new Date()
  // Last 3 *complete* calendar months (not the current, still-in-progress one).
  const monthsAgo = (n: number) => new Date(now.getFullYear(), now.getMonth() - n, 1)
  const spendWindowStart = monthsAgo(3)
  const spendWindowEnd = monthBounds(monthsAgo(1)).end
  const spendMonthKeys = [3, 2, 1].map(n => monthKey(monthsAgo(n)))

  const [
    { data: syncedAccounts },
    { data: manualAccounts },
    { data: members },
    { data: spendTxns },
  ] = await Promise.all([
    supabase
      .from('synced_accounts')
      .select('provider_account_id, name, type, current_balance, owner, is_hidden, exclude_from_net_worth, type_override, updated_at')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, is_active, owner, exclude_from_net_worth')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('household_members')
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('transactions')
      .select('amount, transacted_at, is_transfer, categories(is_income)')
      .eq('user_id', user.id)
      .gte('transacted_at', spendWindowStart.toISOString())
      .lte('transacted_at', spendWindowEnd.toISOString()),
  ])

  // Freshness of the synced balances this page renders. Nothing pulls from
  // SimpleFin on a schedule — balances only move when the user hits Sync — so
  // the page has to report when that last happened instead of implying "now".
  // Same derivation as app/budget/accounts/page.tsx. Computed across every
  // synced account, including hidden/excluded ones: they still tell us when the
  // last successful pull was.
  const lastSynced = (syncedAccounts ?? []).reduce<string | null>((max, a) => {
    if (!a.updated_at) return max
    return max === null || a.updated_at > max ? a.updated_at : max
  }, null)
  const hasSyncedAccounts = (syncedAccounts ?? []).length > 0

  const accounts: MapAccount[] = [
    ...(syncedAccounts ?? [])
      .filter(a => !a.exclude_from_net_worth && !a.is_hidden)
      .map(a => ({
        id: a.provider_account_id,
        name: a.name,
        type: syncedType(a.type, a.type_override ?? null),
        institution: null,
        balance: Number(a.current_balance) || 0,
        owner: a.owner,
      })),
    ...(manualAccounts ?? [])
      .filter(a => !a.exclude_from_net_worth)
      .map(a => ({
        id: a.id,
        name: a.name,
        type: manualType(a.type),
        institution: a.institution ?? null,
        balance: Number(a.current_balance) || 0,
        owner: a.owner,
      })),
  ]

  // Bucket expense magnitude by month (is_transfer excluded) — same rule as
  // Dashboard/CashFlow/Targets.
  const expenseByMonth: Record<string, number> = {}
  for (const t of spendTxns ?? []) {
    if (t.is_transfer) continue
    const isIncome = (t.categories as any)?.is_income ?? Number(t.amount) >= 0
    if (isIncome) continue
    const amt = Number(t.amount)
    // See the note in app/budget/dashboard/page.tsx — expense rows contribute
    // -amount so credits net against spend rather than adding to it.
    const magnitude = -amt
    const key = t.transacted_at.slice(0, 7)
    expenseByMonth[key] = (expenseByMonth[key] ?? 0) + magnitude
  }
  const monthsWithData = spendMonthKeys.filter(k => expenseByMonth[k] !== undefined)
  const avgMonthlySpend = monthsWithData.length > 0
    ? monthsWithData.reduce((s, k) => s + expenseByMonth[k], 0) / monthsWithData.length
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <HouseholdMapClient
          accounts={accounts}
          members={members ?? []}
          avgMonthlySpend={avgMonthlySpend}
          lastSynced={lastSynced}
          hasSyncedAccounts={hasSyncedAccounts}
        />
      </div>
    </div>
  )
}
