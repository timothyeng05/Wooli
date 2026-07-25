'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { BUDGET_NAV } from './budget-nav'

function getCurrentLabel(pathname: string): string {
  for (const item of BUDGET_NAV) {
    if (item.match(pathname)) return item.label
  }
  return 'Budget'
}

export default function BudgetMobileDrawer() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const [reviewCount, setReviewCount] = useState<number | null>(null)

  // Unreviewed-count badge, mirroring BudgetSidebar. Refetches on navigation and
  // whenever TransactionList reports a change via the budget:review-changed event.
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
    window.addEventListener('budget:review-changed', load)
    return () => { cancelled = true; window.removeEventListener('budget:review-changed', load) }
  }, [pathname])

  return (
    <>
      {/* Sticky sub-header — sits below global nav in document flow */}
      <div className="md:hidden sticky top-[53px] z-30 bg-white border-b border-gray-100 flex items-center gap-3 px-4 h-11">
        <button
          onClick={() => setOpen(true)}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition"
          aria-label="Open budget menu"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          {reviewCount !== null && reviewCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full" />
          )}
        </button>
        <span className="text-sm font-semibold text-gray-800">{getCurrentLabel(pathname)}</span>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-250 ease-in-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <p className="text-lg font-bold text-gray-900">Budget</p>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto h-full pb-20 px-3 pt-3">
          <nav className="space-y-0.5">
            {BUDGET_NAV.map(({ href, label, icon, match }) => {
              const active = match(pathname)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className={active ? 'text-blue-600' : 'text-gray-400'}>
                    {icon('w-5 h-5')}
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
    </>
  )
}
