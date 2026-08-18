import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import BudgetSidebar from '@/app/components/budget/BudgetSidebar'
import BudgetMobileDrawer from '@/app/components/budget/BudgetMobileDrawer'
import ResetOnboardingButton from '@/app/components/budget/ResetOnboardingButton'
import RecurringCatchUp from '@/app/components/budget/RecurringCatchUp'

export default async function BudgetLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isOnboardingPage = pathname === '/budget/onboarding'

  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()

  // Onboarding page — render wizard fullscreen, no sidebar
  if (isOnboardingPage) {
    return <>{children}</>
  }

  // For all other budget pages, check if onboarding is needed
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .single()

    if (!profile?.onboarding_completed_at) {
      redirect('/budget/onboarding')
    }
  }

  return (
    <div className="flex">
      {/* Generates overdue recurring transactions on open, so the schedule
          doesn't depend solely on the Vercel cron firing. */}
      <RecurringCatchUp />
      <BudgetSidebar />
      <div className="flex-1 min-w-0 pb-16 md:pb-0">
        <BudgetMobileDrawer />
        {children}
        {/* Dev-only: /api/reset-onboarding is guarded to development, so the
            button is hidden in production rather than shown and failing. */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-20 md:bottom-4 right-4 z-40">
            <ResetOnboardingButton />
          </div>
        )}
      </div>
    </div>
  )
}
