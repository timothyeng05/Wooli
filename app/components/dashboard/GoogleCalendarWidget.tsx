import { createServerSupabaseClient } from '@/lib/supabase-server'

interface CalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

export default async function GoogleCalendarWidget() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) return null

  const providerToken = session.provider_token

  // provider_token not in session — show prompt to reconnect with Google
  if (!providerToken) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Today</h2>
        <p className="text-sm text-gray-400 mb-3">Reconnect Google to see calendar events.</p>
        <a
          href="/api/auth/google"
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          Reconnect Google Calendar →
        </a>
      </div>
    )
  }

  const now = new Date()
  const isEDT = now.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).includes('EDT')
  const offsetStr = isEDT ? '-04:00' : '-05:00'
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const timeMin = `${dateStr}T00:00:00${offsetStr}`
  const timeMax = `${dateStr}T23:59:59${offsetStr}`

  let events: CalendarEvent[] = []
  let fetchError: string | null = null

  try {
    // Fetch all calendars to find where events live
    const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${providerToken}` },
      cache: 'no-store',
    })
    const calListData = await calListRes.json()
    const calendars: { id: string; summary: string }[] = calListData.items ?? []

    // Fetch events from all calendars
    const allEvents: CalendarEvent[] = []
    for (const cal of calendars) {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=8&timeZone=America%2FNew_York`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${providerToken}` }, cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        allEvents.push(...(data.items ?? []))
      }
    }
    allEvents.sort((a, b) => (a.start.dateTime ?? a.start.date ?? '').localeCompare(b.start.dateTime ?? b.start.date ?? ''))
    events = allEvents.slice(0, 8)
  } catch (e) {
    fetchError = 'Failed to fetch calendar'
  }

  const formatTime = (event: CalendarEvent) => {
    const start = event.start.dateTime
    if (!start) return 'All day'
    return new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Today</h2>
        <span className="text-xs text-gray-400">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' })}
        </span>
      </div>

      {fetchError ? (
        <p className="text-sm text-red-400">{fetchError}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing scheduled today</p>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <div key={event.id} className="flex items-start gap-2.5">
              <span className="text-xs font-semibold text-gray-400 flex-shrink-0 w-14 pt-0.5 text-right">
                {formatTime(event)}
              </span>
              <span className="text-sm text-gray-700 flex-1 leading-snug">
                {event.summary || '(No title)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
