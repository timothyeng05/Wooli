import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      queryParams: { access_type: 'offline', prompt: 'consent' },
      redirectTo: `${new URL(request.url).origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.redirect(data.url)
}
