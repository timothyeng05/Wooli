'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_GROUPS = [
  {
    label: 'Budget',
    items: [
      {
        href: '/budget',
        label: 'Overview',
        match: (p: string) => p === '/budget',
        icon: (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        ),
      },
      {
        href: '/budget/forecast',
        label: 'Forecast',
        match: (p: string) => p.startsWith('/budget/forecast'),
        icon: (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        ),
      },
      {
        href: '/budget/cashflow',
        label: 'Cash Flow',
        match: (p: string) => p.startsWith('/budget/cashflow'),
        icon: (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="8" width="6" height="13" rx="1"/><rect x="16" y="5" width="6" height="16" rx="1"/>
          </svg>
        ),
      },
      {
        href: '/budget/targets',
        label: 'Budget Targets',
        match: (p: string) => p.startsWith('/budget/targets'),
        icon: (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        ),
      },
      {
        href: '/budget/transactions',
        label: 'Transactions',
        match: (p: string) => p === '/budget/transactions' ||
          (p.startsWith('/budget/') && !['accounts','categories','recurring','import','targets','cashflow','goals','forecast'].some(s => p.startsWith(`/budget/${s}`))),
        icon: (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        ),
      },
      {
        href: '/budget/recurring',
        label: 'Recurring',
        match: (p: string) => p.startsWith('/budget/recurring'),
        icon: (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>
            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Manage',
    items: [
      {
        href: '/budget/accounts',
        label: 'Accounts',
        match: (p: string) => p.startsWith('/budget/accounts'),
        icon: (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
          </svg>
        ),
      },
      {
        href: '/budget/categories',
        label: 'Categories',
        match: (p: string) => p.startsWith('/budget/categories'),
        icon: (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5"/>
          </svg>
        ),
      },
      {
        href: '/budget/import',
        label: 'Import',
        match: (p: string) => p.startsWith('/budget/import'),
        icon: (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        ),
      },
    ],
  },
]

function getCurrentLabel(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.match(pathname)) return item.label
    }
  }
  return 'Budget'
}

export default function BudgetMobileDrawer() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Sticky sub-header — sits below global nav in document flow */}
      <div className="md:hidden sticky top-[53px] z-30 bg-white border-b border-gray-100 flex items-center gap-3 px-4 h-11">
        <button
          onClick={() => setOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition"
          aria-label="Open budget menu"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
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
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-5">
              <p className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {group.label}
              </p>
              <nav className="space-y-0.5">
                {group.items.map(({ href, label, icon, match }) => {
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
    </>
  )
}
