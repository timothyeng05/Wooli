import BudgetSidebar from '@/app/components/budget/BudgetSidebar'
import BudgetMobileDrawer from '@/app/components/budget/BudgetMobileDrawer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { netWorth } from '@/lib/budget/account-utils'

export default async function BudgetLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: accounts } = await supabase
    .from('accounts')
    .select('current_balance, is_asset, is_active')
    .eq('is_active', true)

  const netWorthData = accounts
    ? netWorth(
        accounts.map((a) => ({
          ...a,
          id: '',
          name: '',
          type: 'other' as const,
          institution: null,
          current_balance: Number(a.current_balance) || 0,
          notes: null,
          sort_order: 0,
          owner: null,
        }))
      )
    : null

  const sidebarNetWorthData = netWorthData
    ? {
        assets: Math.round(netWorthData.assets),
        liabilities: Math.round(netWorthData.liabilities),
        netWorth: Math.round(netWorthData.net),
      }
    : undefined

  return (
    <div className="flex">
      <BudgetSidebar netWorthData={sidebarNetWorthData} />
      <div className="flex-1 min-w-0 pb-16 md:pb-0">
        <BudgetMobileDrawer />
        {children}
      </div>
    </div>
  )
}
