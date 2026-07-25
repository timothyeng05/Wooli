'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { BUDGET_NAV } from './budget-nav'

export default function BudgetSidebar() {
  const pathname = usePathname()
  const [reviewCount, setReviewCount] = useState<number | null>(null)

  // Unreviewed-count badge on the Transactions item — the Monarch "bell dot".
  // Refetches on navigation and whenever TransactionList reports a change.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const supabase = createClient()
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('needs_review', true)
      if (!cancelled) setReviewCount(count ?? 0)
    }
    load()
    // 'budget:review-changed' is dispatched by TransactionList (REVIEW_CHANGED_EVENT).
    window.addEventListener('budget:review-changed', load)
    return () => { cancelled = true; window.removeEventListener('budget:review-changed', load) }
  }, [pathname])

  return (
    <aside className="hidden md:block w-52 shrink-0 self-start sticky top-[53px]">
      <div className="h-[calc(100vh-53px)] overflow-y-auto border-r border-gray-200 bg-white">
        <div className="px-3 pt-5 pb-6">
          <nav className="space-y-0.5">
            {BUDGET_NAV.map(({ href, label, icon, match }) => {
              const active = match(pathname)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className={active ? 'text-blue-600' : 'text-gray-400'}>
                    {icon('w-4 h-4')}
                  </span>
                  {label}
                  {href === '/budget/transactions' && reviewCount !== null && reviewCount > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-violet-100 text-violet-700 text-[11px] font-bold rounded-full inline-flex items-center justify-center">
                      {reviewCount > 99 ? '99+' : reviewCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
