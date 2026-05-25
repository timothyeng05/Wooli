'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function MonthNav({ year, month }: { year: number; month: number }) {
  const router = useRouter()
  const pathname = usePathname()

  const navigate = (y: number, m: number) => {
    if (m < 0) { y--; m = 11 }
    if (m > 11) { y++; m = 0 }
    router.push(`${pathname}?year=${y}&month=${m}`)
  }

  const now = new Date()
  const isCurrent = year === now.getFullYear() && month === now.getMonth()
  const label = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(year, month - 1)}
        className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
        aria-label="Previous month"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <span className="text-sm font-medium text-gray-700 min-w-[130px] text-center">{label}</span>
      <button
        onClick={() => navigate(year, month + 1)}
        disabled={isCurrent}
        className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next month"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  )
}
