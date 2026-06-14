export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ZooPageClient from '@/app/components/budget/ZooPageClient'

export default async function ZooPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const [
    { data: netWorthHistory },
    { data: plaidAccounts },
    { data: manualAccounts },
    { data: monthlyTxns },
  ] = await Promise.all([
    supabase
      .from('net_worth_history')
      .select('net_worth')
      .eq('user_id', user.id)
      .gte('recorded_on', thirtyDaysAgo.toISOString().split('T')[0])
      .order('recorded_on', { ascending: false }),
    supabase
      .from('plaid_accounts')
      .select('current_balance, type, exclude_from_net_worth')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('current_balance, type, exclude_from_net_worth')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('transactions')
      .select('amount, is_transfer')
      .eq('user_id', user.id)
      .gte('date', startOfMonth)
      .lte('date', todayStr),
  ])

  // 30-day average net worth; fallback to current balances if no history yet
  let balance = 0
  if (netWorthHistory && netWorthHistory.length > 0) {
    balance = netWorthHistory.reduce((s, h) => s + (h.net_worth ?? 0), 0) / netWorthHistory.length
  } else {
    const isDebt = (type: string) => type === 'credit' || type === 'loan'
    balance =
      (plaidAccounts ?? [])
        .filter(a => !a.exclude_from_net_worth)
        .reduce((s, a) => s + (isDebt(a.type) ? -Math.abs(a.current_balance ?? 0) : (a.current_balance ?? 0)), 0) +
      (manualAccounts ?? [])
        .filter(a => !(a as any).exclude_from_net_worth)
        .reduce((s, a) => s + (isDebt(a.type) ? -Math.abs(a.current_balance ?? 0) : (a.current_balance ?? 0)), 0)
  }

  // Monthly income (amount >= 0) and spend (amount < 0), excluding transfers
  let monthlyIncome = 0
  let monthlySpend = 0
  for (const t of monthlyTxns ?? []) {
    if (t.is_transfer) continue
    if (t.amount >= 0) monthlyIncome += t.amount
    else monthlySpend += Math.abs(t.amount)
  }

  return (
    <ZooPageClient
      balance={balance}
      monthlyIncome={monthlyIncome}
      monthlySpend={monthlySpend}
    />
  )
}
