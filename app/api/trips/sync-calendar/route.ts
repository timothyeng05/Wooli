import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { mapGCalToSection, type GCalEvent } from '@/lib/trips/google-calendar'

export async function POST(request: Request) {
  const { date } = await request.json()
  if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session || !session.provider_token) {
    return NextResponse.json({ error: 'No Google session found. Please log in again.' }, { status: 401 })
  }

  const timeMin = new Date(`${date}T00:00:00Z`).toISOString()
  const timeMax = new Date(`${date}T23:59:59Z`).toISOString()

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${session.provider_token}`,
        },
      }
    )

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message || 'Failed to fetch from Google' }, { status: res.status })
    }

    const data = await res.json()
    const events: GCalEvent[] = data.items || []

    const sections = events.map(mapGCalToSection)

    return NextResponse.json({ sections })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
