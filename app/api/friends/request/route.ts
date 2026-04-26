import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  if (email.trim().toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'Cannot send a request to yourself' }, { status: 400 })
  }

  // Use service role to look up target profile by email (bypasses RLS)
  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .ilike('email', email.trim())
    .maybeSingle()

  if (!targetProfile) {
    return NextResponse.json({ error: 'No Wooli account found with that email' }, { status: 404 })
  }

  // Check for existing relationship (either direction)
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${user.id})`)
    .maybeSingle()

  if (existing) {
    const msg = existing.status === 'accepted' ? 'Already friends' : 'Request already pending'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: targetProfile.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ friendship: data, name: targetProfile.full_name || targetProfile.email })
}
