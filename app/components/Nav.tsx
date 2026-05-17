'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'

const NAV_LINKS = [
  { href: '/mood', label: 'Journal', alsoMatches: ['/period'] },
  { href: '/lists', label: 'Lists' },
  { href: '/friends', label: 'Friends' },
  { href: '/budget', label: 'Budget' },
  { href: '/cards', label: 'Cards' },
  { href: '/trips', label: 'Trips' },
] as const

export default function Nav() {
  const pathname = usePathname()

  const isActive = (href: string, alsoMatches: readonly string[] = []) => {
    const all = [href, ...alsoMatches]
    return all.some(p => pathname === p || pathname.startsWith(p + '/'))
  }

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 sm:gap-8">
        <Link href="/" className="font-bold text-lg text-blue-600 tracking-tight">
          Wooli
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {NAV_LINKS.map(link => {
            const { href, label } = link
            const active = isActive(href, 'alsoMatches' in link ? link.alsoMatches : [])
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
        <form>
          <button formAction={logout} className="text-sm text-gray-400 hover:text-gray-600 transition whitespace-nowrap">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}
