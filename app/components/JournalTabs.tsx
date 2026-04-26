import Link from 'next/link'

const TABS = [
  { key: 'entries', label: 'Entries', href: '/mood' },
  { key: 'periods', label: 'Periods', href: '/period' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function JournalTabs({ active }: { active: TabKey }) {
  return (
    <div className="flex items-center gap-1 mt-4">
      {TABS.map(t => {
        const isActive = t.key === active
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
