import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendship_id } = await req.json()
  if (!friendship_id) return NextResponse.json({ error: 'friendship_id required' }, { status: 400 })

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendship_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
