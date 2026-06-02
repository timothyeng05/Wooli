// TODO: Update to new middleware convention in Next.js 17+
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  // If not logged in and trying to access protected route → redirect to login
  if (!user && !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/signup')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Non-owner users can only access /budget
  const isOwner = user?.email === 'woolitravel@gmail.com'
  const path = request.nextUrl.pathname
  if (user && !isOwner && path !== '/' && !path.startsWith('/budget')) {
    return NextResponse.redirect(new URL('/budget', request.url))
  }

  // Pass pathname to server components via header
  supabaseResponse.headers.set('x-pathname', request.nextUrl.pathname)

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/mood/:path*', '/budget/:path*',
            '/calendar/:path*']
}
