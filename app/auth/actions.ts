'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function login(_prev: unknown, formData: FormData) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/')
}

const ALLOWED_SIGNUP_EMAILS = ['woolitravel@gmail.com']

export async function signup(_prev: unknown, formData: FormData) {
  const email = formData.get('email') as string

  if (!ALLOWED_SIGNUP_EMAILS.includes(email.toLowerCase())) {
    return { error: 'Signups are closed for this app.' }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signUp({
    email,
    password: formData.get('password') as string,
  })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
