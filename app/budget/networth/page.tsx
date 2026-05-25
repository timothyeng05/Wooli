export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import NetWorthChart from '@/app/components/budget/NetWorthChart'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  depository: 'Checking / Savings',
  credit: 'Credit Card',
  investment: 'Investment',
  loan: 'Loan',
  other: 'Other',
  checking: 'Checking',
  savings: 'Savings',
  cash: 'Cash',
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtSigned(n: number): string {
  return `${n >= 0 ? '+' : '-'}$${fmt(n)}`
}

export default async function NetWorthPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  // Load all data in parallel
  const [
    { data: manualAccounts },
    { data: plaidAccounts },
    { data: history },
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, institution, current_balance, is_active, is_asset')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('plaid_accounts')
      .select('account_id, name, type, subtype, institution_name:item_id, current_balance, mask')
      .eq('user_id', user.id),
    supabase
      .from('net_worth_history')
      .select('recorded_on, assets, liabilities, net_worth')
      .eq('user_id', user.id)
      .order('recorded_on', { ascending: true })
      .limit(730),
  ])

  // Get institution names for Plaid accounts via join
  const { data: plaidItems } = await supabase
    .from('plaid_items')
    .select('item_id, institution_name')
    .eq('user_id', user.id)

  const institutionMap = Object.fromEntries(
    (plaidItems ?? []).map(i => [i.item_id, i.institution_name ?? 'Bank'])
  )

  const plaidWithInstitution = (plaidAccounts ?? []).map(a => ({
    ...a,
    institution_name: institutionMap[a.institution_name] ?? 'Bank',
  }))

  // Compute current totals
  const manualAssets = (manualAccounts ?? [])
    .filter(a => a.is_asset)
    .reduce((s, a) => s + Number(a.current_balance), 0)
  const manualLiabilities = (manualAccounts ?? [])
    .filter(a => !a.is_asset)
    .reduce((s, a) => s + Math.abs(Number(a.current_balance)), 0)

  const plaidAssets = (plaidAccounts ?? [])
    .filter(a => a.type !== 'credit' && a.type !== 'loan')
    .reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const plaidLiabilities = (plaidAccounts ?? [])
    .filter(a => a.type === 'credit' || a.type === 'loan')
    .reduce((s, a) => s + (a.current_balance ?? 0), 0)

  const totalAssets = manualAssets + plaidAssets
  const totalLiabilities = manualLiabilities + plaidLiabilities
  const netWorth = totalAssets - totalLiabilities

  // Upsert today's snapshot
  await supabase
    .from('net_worth_history')
    .upsert(
      {
        user_id: user.id,
        recorded_on: today,
        assets: totalAssets,
        liabilities: totalLiabilities,
        net_worth: netWorth,
      },
      { onConflict: 'user_id,recorded_on' }
    )

  // Build the full history including today
  const historyWithToday = [
    ...(history ?? []).filter(h => h.recorded_on !== today),
    { recorded_on: today, assets: totalAssets, liabilities: totalLiabilities, net_worth: netWorth },
  ].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on))

  // Change vs 30 days ago (or oldest available)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const comparison =
    historyWithToday.find(h => new Date(h.recorded_on + 'T00:00:00') >= thirtyDaysAgo) ??
    historyWithToday[0]
  const changeAmt = comparison ? netWorth - comparison.net_worth : null
  const changeLabel = comparison?.recorded_on === today ? null : changeAmt

  // Split accounts for display
  const assetAccounts = [
    ...(manualAccounts ?? []).filter(a => a.is_asset).map(a => ({
      key: a.id,
      name: a.name,
      institution: a.institution ?? '',
      type: ACCOUNT_TYPE_LABELS[a.type] ?? a.type,
      balance: Number(a.current_balance),
      isLiability: false,
    })),
    ...plaidWithInstitution
      .filter(a => a.type !== 'credit' && a.type !== 'loan')
      .map(a => ({
        key: a.account_id,
        name: a.name + (a.mask ? ` ···${a.mask}` : ''),
        institution: a.institution_name,
        type: ACCOUNT_TYPE_LABELS[a.type] ?? a.type,
        balance: a.current_balance ?? 0,
        isLiability: false,
      })),
  ].sort((a, b) => b.balance - a.balance)

  const liabilityAccounts = [
    ...(manualAccounts ?? []).filter(a => !a.is_asset).map(a => ({
      key: a.id,
      name: a.name,
      institution: a.institution ?? '',
      type: ACCOUNT_TYPE_LABELS[a.type] ?? a.type,
      balance: Math.abs(Number(a.current_balance)),
      isLiability: true,
    })),
    ...plaidWithInstitution
      .filter(a => a.type === 'credit' || a.type === 'loan')
      .map(a => ({
        key: a.account_id,
        name: a.name + (a.mask ? ` ···${a.mask}` : ''),
        institution: a.institution_name,
        type: ACCOUNT_TYPE_LABELS[a.type] ?? a.type,
        balance: a.current_balance ?? 0,
        isLiability: true,
      })),
  ].sort((a, b) => b.balance - a.balance)

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Net Worth</h1>
          <p className="text-gray-500 text-sm">Updated today · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Big number */}
        <div>
          <p className="text-5xl font-bold tracking-tight text-gray-900">
            {netWorth < 0 ? '-' : ''}${fmt(netWorth)}
          </p>
          {changeLabel !== null && changeLabel !== undefined && (
            <p className={`mt-2 text-sm font-medium ${changeLabel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmtSigned(changeLabel)} in the last 30 days
            </p>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-green-600">${fmt(totalAssets)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Liabilities</p>
            <p className="text-2xl font-bold text-red-600">-${fmt(totalLiabilities)}</p>
          </div>
        </div>

        {/* Chart */}
        {historyWithToday.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Net Worth Over Time</h2>
            <NetWorthChart
              history={historyWithToday.map(h => ({
                recorded_on: h.recorded_on,
                net_worth: Number(h.net_worth),
                assets: Number(h.assets),
                liabilities: Number(h.liabilities),
              }))}
            />
          </div>
        )}

        {/* Account breakdown */}
        <div className="space-y-6">
          {/* Assets */}
          {assetAccounts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Assets</h2>
                <span className="text-sm font-bold text-green-600">${fmt(totalAssets)}</span>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                {assetAccounts.map((a, i) => (
                  <div
                    key={a.key}
                    className={`flex items-center justify-between px-4 py-3.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.institution ? `${a.institution} · ` : ''}{a.type}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">${fmt(a.balance)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liabilities */}
          {liabilityAccounts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Liabilities</h2>
                <span className="text-sm font-bold text-red-600">-${fmt(totalLiabilities)}</span>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                {liabilityAccounts.map((a, i) => (
                  <div
                    key={a.key}
                    className={`flex items-center justify-between px-4 py-3.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.institution ? `${a.institution} · ` : ''}{a.type}</p>
                    </div>
                    <p className="text-sm font-semibold text-red-600">-${fmt(a.balance)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assetAccounts.length === 0 && liabilityAccounts.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              No accounts yet.{' '}
              <a href="/budget/accounts" className="text-blue-600 hover:underline">Add accounts</a> to track your net worth.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
