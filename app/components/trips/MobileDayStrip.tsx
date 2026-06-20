'use client'
import { useRef, useEffect } from 'react'
import Link from 'next/link'

function fmt(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Horizontally-scrollable day pills shown under the header on mobile so you can
// jump between days fast without opening the sidebar drawer.
export default function MobileDayStrip({ tripId, allDates, activeDate, todayLocal }: {
  tripId: string; allDates: string[]; activeDate: string; todayLocal: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const c = ref.current
    const el = c?.querySelector(`[data-d="${activeDate}"]`) as HTMLElement | null
    if (c && el) {
      const er = el.getBoundingClientRect(), cr = c.getBoundingClientRect()
      c.scrollLeft += (er.left - cr.left) - (c.clientWidth / 2 - el.clientWidth / 2)
    }
  }, [activeDate])

  return (
    <div
      ref={ref}
      className="lg:hidden flex gap-1.5 overflow-x-auto px-3 py-2 border-t border-gray-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {allDates.map((date, i) => {
        const active = date === activeDate
        const today = date === todayLocal
        return (
          <Link
            key={date}
            href={`/trips/${tripId}/${date}`}
            data-d={date}
            className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-1.5 min-w-[56px] border text-center transition active:scale-95
              ${active ? 'bg-blue-600 border-blue-600' : today ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
          >
            <span className={`text-[10px] font-bold leading-none ${active ? 'text-blue-100' : today ? 'text-blue-400' : 'text-gray-400'}`}>
              DAY {i + 1}
            </span>
            <span className={`text-xs font-semibold leading-tight mt-0.5 ${active ? 'text-white' : today ? 'text-blue-600' : 'text-gray-600'}`}>
              {fmt(date)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
