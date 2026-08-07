import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * The authenticated user for this request.
 *
 * `auth.getUser()` is not a local cookie read — it round-trips to Supabase to
 * validate the JWT. A budget navigation used to make three of those calls
 * (proxy.ts, then the layout, then the page), each blocking before any data
 * query could start. React's `cache()` dedupes per render pass, so the layout
 * and page now share one call. The proxy runs in a separate runtime and still
 * makes its own — that one is the auth boundary and has to stay.
 */
export const getServerUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const createServerSupabaseClient = cache(async () => {
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component, which can't set cookies — safe to
          // ignore because proxy.ts refreshes and persists the session on
          // every matched request.
        }
      },
    },
  })
})
