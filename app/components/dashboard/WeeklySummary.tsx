'use client'

import { useEffect, useState } from 'react'

interface SummaryResponse {
  summary: string | null
  week_start?: string
  source?: string
}

const DISMISS_KEY_PREFIX = 'wooli_weekly_summary_dismissed_'

export default function WeeklySummary() {
  const [summary, setSummary] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/weekly-summary')
      .then(r => r.json())
      .then((d: SummaryResponse) => {
        if (!d.summary || !d.week_start) return
        if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY_PREFIX + d.week_start)) {
          setDismissed(true)
          return
        }
        setSummary(d.summary)
        setWeekStart(d.week_start)
      })
      .catch(() => {})
  }, [])

  const dismiss = () => {
    if (weekStart && typeof window !== 'undefined') {
      localStorage.setItem(DISMISS_KEY_PREFIX + weekStart, '1')
    }
    setDismissed(true)
  }

  if (!summary || dismissed) return null

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-xl p-5 mb-6 relative">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none"
      >
        ×
      </button>
      <div className="flex items-start gap-3">
        <span className="text-xl">✨</span>
        <div className="flex-1 pr-6">
          <p className="text-xs uppercase tracking-wide font-semibold text-blue-700 mb-1">Weekly reflection</p>
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  )
}
