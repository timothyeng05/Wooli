import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { SIMPLEFIN_TRANSACTION_SYNC_ENABLED } from '@/lib/budget/sync-config'
import { syncTransactionsForUser } from '@/lib/budget/simplefin-sync'

// Pull + full-pipeline categorization. Deterministic layers (merchant memory,
// provider mapping, similarity) resolve rows from prior user-confirmed history;
// only fall-throughs hit Groq. maxDuration is bumped so a large first-sync
// backfill has room to finish the Groq pass.
export const maxDuration = 60

export async function POST() {
  if (!SIMPLEFIN_TRANSACTION_SYNC_ENABLED) return NextResponse.json({ added: 0, modified: 0, removed: 0, disabled: true })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role for DB queries so RLS doesn't silently block rows in route handlers
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: connections } = await admin
    .from('bank_connections')
    .select('id, access_url, last_successful_sync_at')
    .eq('user_id', user.id)

  if (!connections?.length) return NextResponse.json({ added: 0, modified: 0, removed: 0 })

  try {
    const results = await syncTransactionsForUser(admin, user.id, connections)
    const totals = results.reduce(
      (s, r) => ({ added: s.added + r.added, modified: s.modified + r.modified, removed: s.removed + r.removed, merged: s.merged + r.merged }),
      { added: 0, modified: 0, removed: 0, merged: 0 }
    )
    return NextResponse.json({ ...totals, connections: results })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 })
  }
}
