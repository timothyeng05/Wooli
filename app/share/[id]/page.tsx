import { notFound, redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// The shared trip now uses the day view (with the read-only sidebar); route here.
export default async function ShareTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = serviceClient()
  const { data: trip } = await supabase.from('trips').select('start_date').eq('id', id).single()
  if (!trip) notFound()
  redirect(`/share/${id}/${trip.start_date}`)
}
