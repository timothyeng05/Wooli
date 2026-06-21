'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function addCountry(code: string, name: string): Promise<{ id: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('wishlist_countries')
    .insert({ user_id: user.id, country_code: code.toUpperCase(), country_name: name })
    .select('id')
    .single()

  if (error || !data) return null
  revalidatePath('/wishlist')
  return { id: data.id }
}

export async function removeCountry(id: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('wishlist_countries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return false
  revalidatePath('/wishlist')
  return true
}

export async function toggleVisited(id: string, visited: boolean): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('wishlist_countries')
    .update({ visited })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return false
  revalidatePath('/wishlist')
  return true
}

export async function updateNote(id: string, note: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('wishlist_countries')
    .update({ note: note.trim() || null })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return false
  revalidatePath('/wishlist')
  return true
}
