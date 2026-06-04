'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_GROUPS = [
  {
    label: 'Daily',
    items: [
      {
        href: '/budget',
        label: 'Overview',
        match: (p: string) => p === '/budget',
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        ),
      },
      {
        href: '/budget/transactions',
        label: 'Transactions',
        match: (p: string) =>
          p === '/budget/transactions' ||
          (p.startsWith('/budget/') && !['accounts','categories','recurring','import','targets','goals','forecast','rules'].some(s => p.startsWith(`/budget/${s}`))),
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        ),
      },
      {
        href: '/budget/targets',
        label: 'Budget',
        match: (p: string) => p.startsWith('/budget/targets'),
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Planning',
    items: [
      {
        href: '/budget/forecast',
        label: 'Forecast',
        match: (p: string) => p.startsWith('/budget/forecast'),
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
            <polyline points="16 7 22 7 22 13"/>
          </svg>
        ),
      },
      {
        href: '/budget/goals',
        label: 'Goals',
        match: (p: string) => p.startsWith('/budget/goals'),
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Inputs',
    items: [
      {
        href: '/budget/accounts',
        label: 'Accounts',
        match: (p: string) => p.startsWith('/budget/accounts'),
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
          </svg>
        ),
      },
      {
        href: '/budget/categories',
        label: 'Categories',
        match: (p: string) => p.startsWith('/budget/categories'),
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        ),
      },
      {
        href: '/budget/rules',
        label: 'Rules',
        match: (p: string) => p.startsWith('/budget/rules'),
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
            <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
            <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
          </svg>
        ),
      },
      {
        href: '/budget/recurring',
        label: 'Recurring',
        match: (p: string) => p.startsWith('/budget/recurring'),
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>
            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
          </svg>
        ),
      },
      {
        href: '/budget/import',
        label: 'Import',
        match: (p: string) => p.startsWith('/budget/import'),
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        ),
      },
    ],
  },
]

export default function BudgetSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:block w-52 shrink-0 self-start sticky top-[53px]">
      <div className="h-[calc(100vh-53px)] overflow-y-auto border-r border-gray-200 bg-white">
        <div className="px-3 pt-5 pb-6 space-y-5">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {group.label}
              </p>
              <nav className="space-y-0.5">
                {group.items.map(({ href, label, icon, match }) => {
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
                        {icon}
                      </span>
                      {label}
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
