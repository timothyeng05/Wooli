import type { ReactNode } from 'react'

// Single source of truth for budget navigation, shared by BudgetSidebar
// (desktop) and BudgetMobileDrawer (mobile) so the two never drift.
// Flat, Monarch-style order: Dashboard, Accounts, Transactions, Cash Flow,
// Budget, Recurring, Goals, Import, Settings (last — utility).
export interface BudgetNavItem {
  href: string
  label: string
  match: (p: string) => boolean
  icon: (className: string) => ReactNode
}

const svg = (className: string, children: ReactNode) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

export const BUDGET_NAV: BudgetNavItem[] = [
  {
    href: '/budget/dashboard',
    label: 'Dashboard',
    match: p => p.startsWith('/budget/dashboard'),
    icon: c => svg(c, <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>),
  },
  {
    href: '/budget/household-map',
    label: 'Household Map',
    match: p => p.startsWith('/budget/household-map'),
    icon: c => svg(c, <><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 7.5v3M12 10.5L6.8 16M12 10.5L17.2 16"/></>),
  },
  {
    href: '/budget/accounts',
    label: 'Accounts',
    match: p => p.startsWith('/budget/accounts'),
    icon: c => svg(c, <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></>),
  },
  {
    href: '/budget/investments',
    label: 'Investments',
    match: p => p.startsWith('/budget/investments'),
    icon: c => svg(c, <><line x1="4" y1="20" x2="4" y2="12"/><line x1="10" y1="20" x2="10" y2="7"/><line x1="16" y1="20" x2="16" y2="4"/><line x1="20" y1="20" x2="20" y2="10"/></>),
  },
  {
    href: '/budget/transactions',
    label: 'Transactions',
    match: p =>
      p === '/budget/transactions' ||
      (p.startsWith('/budget/') && !['accounts','settings','recurring','import','targets','goals','cashflow','dashboard','household-map','investments'].some(s => p.startsWith(`/budget/${s}`))),
    icon: c => svg(c, <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>),
  },
  {
    href: '/budget',
    label: 'Cash Flow',
    match: p => p === '/budget' || p.startsWith('/budget/cashflow'),
    icon: c => svg(c, <><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>),
  },
  {
    href: '/budget/targets',
    label: 'Budget',
    match: p => p.startsWith('/budget/targets'),
    icon: c => svg(c, <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>),
  },
  {
    href: '/budget/recurring',
    label: 'Recurring',
    match: p => p.startsWith('/budget/recurring'),
    icon: c => svg(c, <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></>),
  },
  {
    href: '/budget/goals',
    label: 'Goals',
    match: p => p.startsWith('/budget/goals'),
    icon: c => svg(c, <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>),
  },
  {
    href: '/budget/import',
    label: 'Import',
    match: p => p.startsWith('/budget/import'),
    icon: c => svg(c, <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>),
  },
  {
    href: '/budget/settings',
    label: 'Settings',
    match: p => p.startsWith('/budget/settings'),
    icon: c => svg(c, <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></>),
  },
]
