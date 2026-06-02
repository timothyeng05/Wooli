export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ForecastClient, { type IncomeStream, type ForecastSettings, type ForecastMemberSetting } from '@/app/components/budget/ForecastClient'
import type { Goal } from '@/app/components/budget/GoalsPageClient'

export default async function ForecastPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()
  const thisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [
    { data: streams },
    { data: settingsRow },
    { data: plaidAccounts },
    { data: manualAccounts },
    { data: goals },
    { data: recentTxns },
    { data: members },
    { data: memberSettingsRows },
  ] = await Promise.all([
    supabase
      .from('forecast_income_streams')
      .select('id, name, owner, monthly_amount, tax_rate, growth_type, growth_rate, yearly_amounts, sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('forecast_settings')
      .select('expense_monthly, expense_growth_rate, investment_growth_rate, tim_age, tim_retirement_age, jess_age, jess_retirement_age')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('plaid_accounts')
      .select('type, current_balance')
      .eq('user_id', user.id),
    supabase
      .from('accounts')
      .select('type, current_balance, is_asset')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('budget_goals')
      .select('target_date, target_amount, name, color')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('transactions')
      .select('amount, categories(is_income, is_transfer)')
      .eq('user_id', user.id)
      .gte('transacted_at', threeMonthsAgo)
      .lte('transacted_at', thisMonth) as any,
    supabase
      .from('household_members')
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('forecast_member_settings')
      .select('member_full_name, age, retirement_age')
      .eq('user_id', user.id),
  ])

  // Starting balances from accounts
  const allAccounts = [
    ...(plaidAccounts ?? []).map(a => ({ type: a.type, balance: a.current_balance ?? 0, isAsset: a.type !== 'credit' && a.type !== 'loan' })),
    ...(manualAccounts ?? []).map(a => ({ type: a.type, balance: a.current_balance ?? 0, isAsset: a.is_asset })),
  ]
  const investments = allAccounts.filter(a => a.type === 'investment').reduce((s, a) => s + a.balance, 0)
  const cash = allAccounts.filter(a => a.isAsset && a.type !== 'investment').reduce((s, a) => s + a.balance, 0)
  const liabilities = allAccounts.filter(a => !a.isAsset).reduce((s, a) => s + Math.abs(a.balance), 0)

  // Avg monthly expenses from last 3 months (non-income, non-transfer)
  let avgMonthlyExpenses = 0
  if (recentTxns && recentTxns.length > 0) {
    const expenses = (recentTxns as any[])
      .filter(t => {
        const cat = t.categories
        if (cat?.is_transfer || cat?.is_income) return false
        return Number(t.amount) < 0
      })
      .reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)
    avgMonthlyExpenses = Math.round(expenses / 3)
  }

  const settings: ForecastSettings = {
    expense_monthly: settingsRow?.expense_monthly ?? avgMonthlyExpenses,
    expense_growth_rate: settingsRow?.expense_growth_rate ?? 3,
    investment_growth_rate: settingsRow?.investment_growth_rate ?? 7,
  }

  const memberSettings: ForecastMemberSetting[] = (memberSettingsRows ?? []).map(r => ({
    member_full_name: r.member_full_name,
    age: r.age ?? null,
    retirement_age: r.retirement_age ?? null,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Forecast</h1>
        <ForecastClient
          streams={(streams ?? []) as IncomeStream[]}
          settings={settings}
          memberSettings={memberSettings}
          goals={(goals ?? []) as Pick<Goal, 'name' | 'target_date' | 'target_amount' | 'color'>[]}
          startingCash={cash}
          startingInvestments={investments}
          startingLiabilities={liabilities}
          userId={user.id}
          settingsExist={!!settingsRow}
          members={members ?? []}
        />
      </div>
    </div>
  )
}
