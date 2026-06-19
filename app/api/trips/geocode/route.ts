import { NextResponse } from 'next/server'

// Pull "lat,lng" out of a Google Maps URL (or any text containing them).
// Tries the most accurate patterns first.
function coordsFromText(text: string): { lat: number; lng: number } | null {
  // !3d<lat>!4d<lng> — the actual place pin, most accurate
  let m = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // @<lat>,<lng> — map center
  m = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // ?q=<lat>,<lng> / ll= / query= / destination= / center= (optionally loc:)
  m = text.match(/[?&](?:q|ll|query|destination|center)=(?:loc:)?(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

// Resolve a Google Maps URL → { coords, expanded long URL }.
// Short links (maps.app.goo.gl, goo.gl/maps) are redirects, so follow them
// server-side, then parse the expanded URL / page. The returned `url` is the
// long version and always carries coords so it can be re-parsed later.
async function resolveMapsUrl(url: string): Promise<{ lat: number; lng: number; url: string } | null> {
  // Already a long URL with coords in it
  const direct = coordsFromText(url)
  if (direct) return { ...direct, url }

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WooliBot/1.0)' },
    })
    let expanded = res.url
    let coords = coordsFromText(expanded)
    if (!coords) {
      const body = await res.text()
      coords = coordsFromText(body)
    }
    if (!coords) return null
    // Guarantee the stored URL carries coords (some redirects land on a
    // coords-less URL but expose them in the page body)
    if (!coordsFromText(expanded)) {
      expanded = `https://www.google.com/maps/@${coords.lat},${coords.lng},17z`
    }
    return { ...coords, url: expanded }
  } catch {
    return null
  }
}

// Geocode a free-text query OR resolve a Google Maps URL → { lat, lng }.
// Uses Google Geocoding when a key is set, otherwise falls back to Nominatim.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const q = searchParams.get('q')

  // 1) Google Maps URL (short or long) — returns coords + expanded long URL
  if (url) {
    try {
      const resolved = await resolveMapsUrl(url)
      if (resolved) return NextResponse.json({ ...resolved, source: 'url' })
      return NextResponse.json({ lat: null, lng: null, url: null, source: 'url' })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  if (!q) return NextResponse.json({ error: 'q or url is required' }, { status: 400 })

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
