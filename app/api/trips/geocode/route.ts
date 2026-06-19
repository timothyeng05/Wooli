import { NextResponse } from 'next/server'

// Geocode a free-text query → { lat, lng }.
// Uses Google Geocoding API when a key is set, otherwise falls back to
// free Nominatim (OpenStreetMap) so the map still works without a key.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 })

  // NEXT_PUBLIC_ vars are also readable server-side; prefer a server-only key if present.
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  try {
    if (key) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`
      )
      const data = await res.json()
      if (data.status === 'OK' && data.results?.[0]) {
        const { lat, lng } = data.results[0].geometry.location
        return NextResponse.json({ lat, lng, source: 'google' })
      }
      // REQUEST_DENIED / OVER_QUERY_LIMIT etc. — surface nothing rather than erroring the map
      if (data.status !== 'ZERO_RESULTS') {
        console.warn('Google geocode failed:', data.status, data.error_message)
      }
      return NextResponse.json({ lat: null, lng: null, source: 'google' })
    }

    // Fallback: Nominatim (no key, rate-limited — fine for light dev use)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'Wooli/1.0 (trip map)' } }
    )
    const data = await res.json()
    if (data[0]) {
      return NextResponse.json({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), source: 'nominatim' })
    }
    return NextResponse.json({ lat: null, lng: null, source: 'nominatim' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
