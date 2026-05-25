import BudgetSidebar from '@/app/components/budget/BudgetSidebar'

export default function BudgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <BudgetSidebar />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
