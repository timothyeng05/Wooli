'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'

const NAV_LINKS = [
  {
    href: '/mood', label: 'Journal', alsoMatches: ['/period'],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
      </svg>
    ),
  },
  {
    href: '/lists', label: 'Lists', alsoMatches: [],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    href: '/budget', label: 'Budget', alsoMatches: [],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/trips', label: 'Trips', alsoMatches: [],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
    ),
  },
  {
    href: '/friends', label: 'Friends', alsoMatches: [],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
] as const

export default function Nav() {
  const pathname = usePathname()

  const isActive = (href: string, alsoMatches: readonly string[] = []) => {
    const all = [href, ...alsoMatches]
    return all.some(p => pathname === p || pathname.startsWith(p + '/'))
  }

  return (
    <>
      {/* Top bar */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 sm:gap-8">
          <Link href="/" className="font-bold text-lg text-blue-600 tracking-tight">
            Wooli
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {NAV_LINKS.map(({ href, label, alsoMatches }) => {
              const active = isActive(href, alsoMatches)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          <form className="ml-auto md:ml-0">
            <button formAction={logout} className="text-sm text-gray-400 hover:text-gray-600 transition whitespace-nowrap">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex">
          {NAV_LINKS.map(({ href, label, icon, alsoMatches }) => {
            const active = isActive(href, alsoMatches)
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition ${
                  active ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {icon}
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
