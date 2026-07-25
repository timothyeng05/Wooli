'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/budget/settings/categories', label: 'Categories' },
  { href: '/budget/settings/institutions', label: 'Institutions' },
]

export default function BudgetSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>
        <div className="flex gap-6 items-start">
          <div className="w-44 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm p-2 sticky top-20">
            <nav className="space-y-0.5">
              {TABS.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
