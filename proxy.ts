import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // If not logged in and trying to access protected route → redirect to login
  // Allow '/' for unauthenticated users (landing page). Cron routes are exempt —
  // Vercel's scheduler (and a local curl test) never carries a session cookie;
  // they authenticate via their own CRON_SECRET bearer-token check instead, which
  // this redirect would otherwise block them from ever reaching.
  if (!user && pathname !== '/' &&
      !pathname.startsWith('/login') &&
      !pathname.startsWith('/signup') &&
      !pathname.startsWith('/api/cron')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Non-owner users can only access /budget, /trips, and the API routes those
  // pages depend on. /api/setup-budget seeds default categories during onboarding
  // and /api/simplefin/* links and syncs the user's own bank connection — both are
  // session-scoped and RLS-bound, so a non-owner reaching them only ever touches
  // their own rows. Omitting them silently redirected the onboarding wizard's
  // fetches, leaving new users with no categories and no way to connect a bank.
  const isOwner = user?.email === 'woolitravel@gmail.com'
  const path = request.nextUrl.pathname
  if (user && !isOwner && path !== '/' &&
      !path.startsWith('/budget') &&
      !path.startsWith('/trips') &&
      !path.startsWith('/api/trips') &&
      !path.startsWith('/api/budget') &&
      !path.startsWith('/api/setup-budget') &&
      !path.startsWith('/api/simplefin')) {
    return NextResponse.redirect(new URL('/budget/accounts', request.url))
  }

  // Pass pathname to server components via header
  supabaseResponse.headers.set('x-pathname', request.nextUrl.pathname)

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/budget/:path*', '/trips/:path*', '/period/:path*', '/api/:path*']
}
