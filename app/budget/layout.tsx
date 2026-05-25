import BudgetSidebar from '@/app/components/budget/BudgetSidebar'
import BudgetMobileNav from '@/app/components/budget/BudgetMobileNav'

export default function BudgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <BudgetSidebar />
      <div className="flex-1 min-w-0 pb-16 md:pb-0">
        {children}
      </div>
      <BudgetMobileNav />
    </div>
  )
}
