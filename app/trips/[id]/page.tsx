import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'

// The trip overview now lives in the day-view sidebar (legs, progress, share,
// hotels, what-we-ate). This page just routes to the right day.
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trip } = await supabase
    .from('trips')
    .select('start_date, end_date')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!trip) notFound()

  // Land on today if it's within the trip, otherwise the first day.
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayStr = `${y}-${m}-${d}`
  const target = todayStr >= trip.start_date && todayStr <= trip.end_date ? todayStr : trip.start_date

  redirect(`/trips/${id}/${target}`)
}
