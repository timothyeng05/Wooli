export interface GCalCalendar {
  id: string
  name: string
  color: string
}

export interface GCalEvent {
  title: string
  calendarId: string
}

export type GCalEventsByDate = Record<string, GCalEvent[]>

export interface GCalData {
  calendars: GCalCalendar[]
  eventsByDate: GCalEventsByDate
}

export async function fetchGCalData(
  providerToken: string,
  year: number,
  month: number // 1-based
): Promise<GCalData> {
  const now = new Date()
  const isEDT = now.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).includes('EDT')
  const offset = isEDT ? '-04:00' : '-05:00'

  const pad = (n: number) => String(n).padStart(2, '0')
  const daysInMonth = new Date(year, month, 0).getDate()
  const timeMin = `${year}-${pad(month)}-01T00:00:00${offset}`
  const timeMax = `${year}-${pad(month)}-${pad(daysInMonth)}T23:59:59${offset}`

  try {
    const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${providerToken}` },
      cache: 'no-store',
    })
    if (!calListRes.ok) return { calendars: [], eventsByDate: {} }
    const calList = await calListRes.json()
    const rawCals: { id: string; summary: string; backgroundColor: string }[] = calList.items ?? []

    const calendars: GCalCalendar[] = rawCals
      .filter(c => !c.summary?.toLowerCase().includes('holiday'))
      .map(c => ({
        id: c.id,
        name: c.summary,
        color: c.backgroundColor ?? '#3b82f6',
      }))

    const eventsByDate: GCalEventsByDate = {}

    await Promise.all(calendars.map(async (cal) => {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=50&timeZone=America%2FNew_York`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${providerToken}` }, cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      for (const event of data.items ?? []) {
        const dateStr: string = event.start?.date ?? event.start?.dateTime?.split('T')[0]
        if (!dateStr) continue
        if (!eventsByDate[dateStr]) eventsByDate[dateStr] = []
        eventsByDate[dateStr].push({ title: event.summary ?? '(No title)', calendarId: cal.id })
      }
    }))

    return { calendars, eventsByDate }
  } catch {
    return { calendars: [], eventsByDate: {} }
  }
}
