'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Mobile day jumper for the read-only share page (the day list sidebar is
// desktop-only). Compact trigger + a scrollable picker sheet.
export default function ShareDayPicker({ id, days, activeDate, dayNumber, total }: {
  id: string
  days: { date: string; title: string | null }[]
  activeDate: string
  dayNumber: number
  total: number
}) {
  const [open, setOpen] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const c = scroll.current
    const el = c?.querySelector(`[data-pd="${activeDate}"]`) as HTMLElement | null
    if (c && el) { const er = el.getBoundingClientRect(), cr = c.getBoundingClientRect(); c.scrollTop += (er.top - cr.top) - 140 }
  }, [open, activeDate])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center gap-1 text-xs font-bold bg-blue-600 text-white rounded-full pl-3 pr-2 py-1 active:scale-95 transition"
      >
        Day {dayNumber}<span className="text-blue-200 font-semibold">/{total} ▾</span>
      </button>
      {open && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />
          <div className="lg:hidden fixed inset-x-0 bottom-0 top-[16vh] z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col">
            <div className="flex justify-center pt-2.5 pb-1"><div className="w-10 h-1.5 rounded-full bg-gray-300" /></div>
            <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Jump to day</p>
              <button onClick={() => setOpen(false)} className="text-xs font-medium text-gray-400">Close</button>
            </div>
            <div ref={scroll} className="flex-1 overflow-y-auto p-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {days.map((d, i) => {
                const active = d.date === activeDate
                return (
                  <Link
                    key={d.date}
                    data-pd={d.date}
                    href={`/share/${id}/${d.date}`}
                    onClick={() => setOpen(false)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? 'bg-blue-600' : 'active:bg-gray-100'}`}
                  >
                    <span className={`text-xs font-bold w-12 flex-shrink-0 ${active ? 'text-blue-200' : 'text-gray-400'}`}>Day {i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] ${active ? 'text-blue-200' : 'text-gray-400'}`}>{fmt(d.date)}</p>
                      <p className={`text-sm font-medium truncate ${active ? 'text-white' : d.title ? 'text-gray-800' : 'text-gray-400'}`}>{d.title ?? '—'}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
