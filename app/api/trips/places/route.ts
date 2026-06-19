import { NextResponse } from 'next/server'

// Places API (New). Key stays server-side. Two modes:
//   ?q=<text>&session=<token>      → autocomplete suggestions
//   ?placeId=<id>&session=<token>  → place details (coords + maps URL)
// Session token ties keystrokes + the final details call into one billed
// session (cheaper). If no key is configured, autocomplete is disabled and
// the caller falls back to paste-a-link.
const getKey = () => process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const placeId = searchParams.get('placeId')
  const session = searchParams.get('session') || undefined
  const key = getKey()

  if (!key) return NextResponse.json({ suggestions: [], disabled: true })

  try {
    // Place Details → coords + a coords-bearing Maps URL
    if (placeId) {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
          (session ? `?sessionToken=${encodeURIComponent(session)}` : ''),
        { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'location,displayName' } }
      )
      const data = await res.json()
      const lat = data.location?.latitude
      const lng = data.location?.longitude
      if (lat == null || lng == null) return NextResponse.json({ lat: null, lng: null, url: null })
      // Include query_place_id so the stored URL opens the actual business
      // listing (name, photos, reviews) rather than just dropping a pin.
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(placeId)}`
      return NextResponse.json({ lat, lng, url, placeId, name: data.displayName?.text ?? null })
    }

    // Autocomplete → suggestion list
    if (q) {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
        body: JSON.stringify({ input: q, sessionToken: session }),
      })
      const data = await res.json()
      const suggestions = (data.suggestions || [])
        .map((s: any) => {
          const p = s.placePrediction
          if (!p) return null
          return {
            placeId: p.placeId as string,
            main: p.structuredFormat?.mainText?.text || p.text?.text || '',
            secondary: p.structuredFormat?.secondaryText?.text || '',
          }
        })
        .filter(Boolean)
      return NextResponse.json({ suggestions })
    }

    return NextResponse.json({ error: 'q or placeId is required' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
