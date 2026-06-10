'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export async function addItem(listId: string, title: string): Promise<{ id: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify the list belongs to this user
  const { data: list } = await supabase
    .from('lists')
    .select('id')
    .eq('id', listId)
    .eq('user_id', user.id)
    .single()

  if (!list) return null

  const { data, error } = await supabase
    .from('list_items')
    .insert({ list_id: listId, user_id: user.id, title: title.trim() })
    .select('id')
    .single()

  if (error || !data) return null
  return { id: data.id }
}

export async function toggleItem(itemId: string, isDone: boolean): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('list_items')
    .update({ is_done: isDone })
    .eq('id', itemId)
    .eq('user_id', user.id)

  return !error
}

export async function deleteItem(itemId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id)

  return !error
}
