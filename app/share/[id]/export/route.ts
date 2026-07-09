import { createClient } from '@supabase/supabase-js'
import { buildTripItinerary, tripItineraryToMarkdown } from '@/lib/trips/trip-export'

// Machine-readable export of a shared trip. Same public visibility as the
// /share pages (service-role read, no auth), so a shared link can be fed to an
// AI assistant. Supports JSON (default) and Markdown (?format=md).
//   GET /share/:id/export            → application/json
//   GET /share/:id/export?format=md  → text/markdown

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = serviceClient()

  const [{ data: trip }, { data: dayRows }, { data: hotels }] = await Promise.all([
    // select('*') so trips.legs (migration 038) comes along when it exists —
    // naming the column would error before the migration is applied.
    supabase.from('trips').select('*').eq('id', id).single(),
    supabase.from('trip_days').select('date, title, notes').eq('trip_id', id).order('date'),
    supabase.from('trip_hotels').select('name, check_in, check_out, location').eq('trip_id', id).order('check_in'),
  ])

  if (!trip) {
    return new Response(JSON.stringify({ error: 'Trip not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const itinerary = buildTripItinerary(id, trip, dayRows ?? [], hotels ?? [])
  const format = new URL(req.url).searchParams.get('format')?.toLowerCase()
  const cache = 'public, max-age=300, s-maxage=300'

  if (format === 'md' || format === 'markdown' || format === 'text') {
    return new Response(tripItineraryToMarkdown(itinerary), {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': cache },
    })
  }

  return new Response(JSON.stringify(itinerary, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  })
}
