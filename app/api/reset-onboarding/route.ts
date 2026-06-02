import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Don't allow the owner account to reset
  if (user.email === 'woolitravel@gmail.com') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  await supabase.from('categories').delete().eq('user_id', user.id)
  await supabase.from('household_members').delete().eq('user_id', user.id)
  await supabase.from('budgets').delete().eq('user_id', user.id)
  await supabase.from('profiles').update({ onboarding_completed_at: null }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
