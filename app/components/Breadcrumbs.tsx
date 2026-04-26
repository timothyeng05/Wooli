import Link from 'next/link'

export type Crumb = { label: string; href?: string }

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ label: 'Dashboard', href: '/' }, ...items]

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
      <ol className="flex items-center flex-wrap gap-x-1.5 gap-y-1">
        {trail.map((c, i) => {
          const last = i === trail.length - 1
          return (
            <li key={i} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-blue-600 transition">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? 'text-gray-900 font-medium' : ''}>{c.label}</span>
              )}
              {!last && <span className="text-gray-300">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
