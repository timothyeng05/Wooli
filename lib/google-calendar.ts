export type GCalEventsByDate = Record<string, string[]> // date -> event titles

export async function fetchGCalEventsByDate(
  providerToken: string,
  year: number,
  month: number // 1-based
): Promise<GCalEventsByDate> {
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
    if (!calListRes.ok) return {}
    const calList = await calListRes.json()
    const calendars: { id: string }[] = calList.items ?? []

    const byDate: GCalEventsByDate = {}

    await Promise.all(calendars.map(async (cal) => {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=50&timeZone=America%2FNew_York`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${providerToken}` }, cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      for (const event of data.items ?? []) {
        const dateStr: string = event.start?.date ?? event.start?.dateTime?.split('T')[0]
        if (!dateStr) continue
        if (!byDate[dateStr]) byDate[dateStr] = []
        byDate[dateStr].push(event.summary ?? '(No title)')
      }
    }))

    return byDate
  } catch {
    return {}
  }
}
