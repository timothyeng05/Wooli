'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const SESSION_KEY = 'budget:recurring-checked'

/**
 * Generates any overdue recurring transactions when a budget page is opened.
 *
 * The daily Vercel cron is the primary trigger, but it is a single point of
 * failure — it needs CRON_SECRET set in the deployment, and when it silently
 * stops firing nothing generates and the gap is only noticed weeks later by a
 * missing entry. This runs the same catch-up from the client so the schedule
 * degrades to "next time you open the app" instead of "never".
 *
 * Once per browser session, not per navigation: the endpoint is idempotent
 * (it only emits periods whose next_date has passed) but there's no reason to
 * call it on every route change.
 */
export default function RecurringCatchUp() {
  const router = useRouter()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')

    fetch('/api/budget/generate-recurring', { method: 'POST' })
      .then(r => (r.ok ? r.json() : null))
      .then(res => {
        // Only refresh when something was actually written, so the common
        // nothing-due case costs a single request and no re-render.
        if (res?.generated > 0) router.refresh()
      })
      .catch(() => {
        // Best-effort: the cron is still the primary path, and a failed
        // catch-up must never interfere with viewing the page.
        sessionStorage.removeItem(SESSION_KEY)
      })
  }, [router])

  return null
}
