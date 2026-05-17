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

  if (!session?.provider_token) return null

  const now = new Date()
  const timeMin = now.toISOString()
  const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  let events: CalendarEvent[] = []
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=8`,
      {
        headers: { Authorization: `Bearer ${session.provider_token}` },
        next: { revalidate: 300 },
      }
    )
    if (res.ok) {
      const data = await res.json()
      events = data.items ?? []
    }
  } catch {
    return null
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
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {events.length === 0 ? (
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
