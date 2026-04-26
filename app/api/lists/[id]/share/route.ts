import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: list } = await supabase
    .from('lists')
    .select('id')
    .eq('id', listId)
    .eq('user_id', user.id)
    .single()
  if (!list) return NextResponse.json({ error: 'List not found or not owned by you' }, { status: 404 })

  const { friend_id, can_edit } = await req.json()
  if (!friend_id) return NextResponse.json({ error: 'friend_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('list_shares')
    .insert({
      list_id: listId,
      shared_by_user_id: user.id,
      shared_with_user_id: friend_id,
      can_edit: !!can_edit,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ share: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { share_id } = await req.json()
  if (!share_id) return NextResponse.json({ error: 'share_id required' }, { status: 400 })

  const { error } = await supabase
    .from('list_shares')
    .delete()
    .eq('id', share_id)
    .eq('list_id', listId)
    .eq('shared_by_user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
