import { NextResponse } from 'next/server'
import { coordsFromText, placeNameFromText } from '@/lib/trips/maps-url'

// Headers that make Google return the real Maps page instead of a cookie
// consent interstitial (which carries no coordinates). A realistic desktop
// User-Agent + a pre-accepted CONSENT cookie skips the redirect to
// consent.google.com that otherwise breaks short-link resolution.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Cookie: 'CONSENT=YES+1; SOCS=CAI',
}

// Geocode free text → coords. Google when a key is set, else Nominatim.
async function geocodeQuery(q: string): Promise<{ lat: number; lng: number; source: string } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (key) {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`,
    )
    const data = await res.json()
    if (data.status === 'OK' && data.results?.[0]) {
      const { lat, lng } = data.results[0].geometry.location
      return { lat, lng, source: 'google' }
    }
    if (data.status !== 'ZERO_RESULTS') {
      console.warn('Google geocode failed:', data.status, data.error_message)
    }
    return null
  }
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'Wooli/1.0 (trip map)' } },
  )
  const data = await res.json()
  if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), source: 'nominatim' }
  return null
}

// Resolve a Google Maps URL (short or long, or a generic share link) →
// { coords, expanded URL, business name }. Follows redirects server-side,
// parses the expanded URL / page, and — if the page has no coordinates — falls
// back to geocoding the business name pulled from the listing.
async function resolveMapsUrl(
  url: string,
): Promise<{ lat: number; lng: number; url: string; name?: string } | null> {
  // Already a long URL with coords in it — no network needed.
  const direct = coordsFromText(url)
  if (direct) return { ...direct, url }

  let finalUrl = url
  let body = ''
  try {
    const res = await fetch(url, { redirect: 'follow', headers: BROWSER_HEADERS })
    finalUrl = res.url || url
    body = await res.text()
  } catch {
    return null
  }

  const name = placeNameFromText(body, finalUrl) ?? undefined
  const coords = coordsFromText(finalUrl) || coordsFromText(body)

  if (coords) {
    // Prefer the actual listing URL when the redirect landed on a /place/ page;
    // otherwise store a coords-bearing URL so the pin can be re-derived.
    const stored = /\/maps\/place\//.test(finalUrl)
      ? finalUrl
      : `https://www.google.com/maps/@${coords.lat},${coords.lng},17z`
    return { ...coords, url: stored, name }
  }

  // No coords on the page — geocode the business name we scraped.
  if (name) {
    const g = await geocodeQuery(name)
    if (g) {
      return {
        lat: g.lat,
        lng: g.lng,
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
        name,
      }
    }
  }

  return null
}

// Geocode a free-text query OR resolve a Google Maps URL → { lat, lng }.
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

  try {
    const g = await geocodeQuery(q)
    if (g) return NextResponse.json({ lat: g.lat, lng: g.lng, source: g.source })
    return NextResponse.json({ lat: null, lng: null, source: 'none' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
