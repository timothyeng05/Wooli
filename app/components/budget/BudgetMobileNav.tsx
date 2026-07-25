'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

const TABS = [
  {
    href: '/budget/dashboard',
    label: 'Dashboard',
    match: (p: string) => p.startsWith('/budget/dashboard'),
    icon: (filled: boolean) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" strokeWidth={filled ? 0 : 1.8}
          fill={filled ? 'white' : 'none'} stroke={filled ? 'white' : 'currentColor'} />
      </svg>
    ),
  },
  {
    href: '/budget/accounts',
    label: 'Accounts',
    match: (p: string) => p.startsWith('/budget/accounts'),
    icon: (filled: boolean) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {filled ? (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" />
            <path d="M3 9h18M9 21V9" stroke="white" strokeWidth="1.8" />
          </>
        ) : (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </>
        )}
      </svg>
    ),
  },
  {
    href: '/budget/transactions',
    label: 'Transactions',
    match: (p: string) =>
      p === '/budget/transactions' ||
      (p.startsWith('/budget/') && !['accounts', 'settings', 'recurring', 'import', 'targets', 'networth', 'cashflow', 'dashboard'].some(s => p.startsWith(`/budget/${s}`))),
    icon: (filled: boolean) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {filled ? (
          <>
            <rect x="2" y="5" width="20" height="14" rx="2" fill="currentColor" />
            <line x1="2" y1="10" x2="22" y2="10" stroke="white" strokeWidth="1.8" />
          </>
        ) : (
          <>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </>
        )}
      </svg>
    ),
  },
  {
    href: '/budget',
    label: 'Cash Flow',
    match: (p: string) => p === '/budget' || p.startsWith('/budget/cashflow'),
    icon: (filled: boolean) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={filled ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="6" height="18" rx="1" fill={filled ? 'currentColor' : 'none'} />
        <rect x="9" y="8" width="6" height="13" rx="1" fill={filled ? 'currentColor' : 'none'} />
        <rect x="16" y="5" width="6" height="16" rx="1" fill={filled ? 'currentColor' : 'none'} />
      </svg>
    ),
  },
  {
    href: '/budget/targets',
    label: 'Budget',
    match: (p: string) => p.startsWith('/budget/targets') || p.startsWith('/budget/settings') || p.startsWith('/budget/recurring') || p.startsWith('/budget/import'),
    icon: (filled: boolean) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={filled ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <circle cx="3.5" cy="6" r="1.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
        <circle cx="3.5" cy="12" r="1.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
        <circle cx="3.5" cy="18" r="1.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
]

export default function BudgetMobileNav() {
  const pathname = usePathname()
  const [reviewCount, setReviewCount] = useState<number | null>(null)

  // Unreviewed-count badge on the Transactions tab — mirrors the desktop sidebar.
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex">
        {TABS.map(({ href, label, match, icon }) => {
          const active = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 pt-3 gap-0.5 transition-colors ${
                active ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <span className="relative">
                {icon(active)}
                {href === '/budget/transactions' && reviewCount !== null && reviewCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-violet-600 text-white text-[9px] font-bold rounded-full inline-flex items-center justify-center">
                    {reviewCount > 99 ? '99+' : reviewCount}
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-medium ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
