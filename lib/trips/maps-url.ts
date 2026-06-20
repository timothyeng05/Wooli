// Pure parsers for resolving Google Maps links → coordinates / business name.
// Kept network-free so they can be unit-tested; the geocode route adds the
// fetch/redirect + geocoding around them.

// Pull "lat,lng" out of a Google Maps URL or page body. Most accurate first.
export function coordsFromText(text: string): { lat: number; lng: number } | null {
  // !3d<lat>!4d<lng> — the actual place pin, most accurate
  let m = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // @<lat>,<lng> — map center
  m = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // ?q=<lat>,<lng> / ll= / query= / destination= / center= (optionally loc:)
  m = text.match(/[?&](?:q|ll|query|destination|center)=(?:loc:)?(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // "latitude":<lat>,"longitude":<lng> — embedded in the page's JSON
  m = text.match(/"latitude":\s*(-?\d+\.\d+),\s*"longitude":\s*(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

// Best-effort business / place name from the resolved URL or page body, so we
// can geocode it (and label the pin) when the page carries no coordinates.
export function placeNameFromText(body: string, finalUrl: string): string | null {
  let m = finalUrl.match(/\/maps\/place\/([^/@]+)/)
  if (m) {
    const name = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim()
    if (name && !/^[-\d.,\s]+$/.test(name)) return name
  }
  m = body.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
    || body.match(/<title>([^<]+)<\/title>/i)
  if (m) {
    const name = m[1].replace(/\s*[-–]\s*Google Maps\s*$/i, '').trim()
    if (name && !/^google maps$/i.test(name)) return name
  }
  return null
}
