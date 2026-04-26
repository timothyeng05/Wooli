import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

  const start = new Date(year, month - 1, 1).toISOString()
  const end = new Date(year, month, 1).toISOString()

  const [moodResult, periodResult] = await Promise.all([
    supabase
      .from('mood_entries')
      .select('id, mood, note, grateful_for, activities, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lt('logged_at', end),
    supabase
      .from('period_entries')
      .select('id, start_date, end_date, flow_level, symptoms, notes')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false }),
  ])

  return NextResponse.json({
    moodEntries: moodResult.data || [],
    periodEntries: periodResult.data || [],
  })
}
