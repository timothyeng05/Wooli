import Link from 'next/link'

const NAV_LINKS = [
  { href: '/mood', label: 'Journal' },
  { href: '/budget', label: 'Budget' },
  { href: '/cards', label: 'Cards' },
]

export default function Nav() {
  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-lg text-blue-600 tracking-tight">
            Wooli
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
