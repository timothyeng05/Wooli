'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { logout } from '@/app/auth/actions'
import { countUnreviewed } from '@/lib/budget/review-queue'
import { BUDGET_NAV } from './budget-nav'

export default function BudgetSidebar() {
  const pathname = usePathname()
  const [reviewCount, setReviewCount] = useState<number | null>(null)

  // Unreviewed-count badge on the Transactions item — the Monarch "bell dot".
  // Refetches on navigation and whenever TransactionList reports a change.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const count = await countUnreviewed(createClient())
      if (!cancelled) setReviewCount(count)
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

          <div className="mt-4 pt-3 border-t border-gray-100">
            <form>
              <button
                formAction={logout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
              >
                <span className="text-gray-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </span>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  )
}
