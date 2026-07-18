import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { PLAID_TRANSACTION_SYNC_ENABLED } from '@/lib/budget/sync-config'
import { syncTransactionsForUser } from '@/lib/budget/plaid-sync'

// Pull + deterministic categorization. At sync we run only the fast deterministic
// layers (rules, merchant memory, provider mapping, similarity) — never Groq — so
// the pull stays quick and can't be aborted mid-write. Rows that no deterministic
// layer can place are left needs_review for the explicit "Auto-categorize" (Groq) pass.
export async function POST() {
  if (!PLAID_TRANSACTION_SYNC_ENABLED) return NextResponse.json({ added: 0, modified: 0, removed: 0, disabled: true })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role for DB queries so RLS doesn't silently block rows in route handlers
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: items } = await admin
    .from('plaid_items')
    .select('item_id, access_token, cursor')
    .eq('user_id', user.id)

  if (!items?.length) return NextResponse.json({ added: 0, modified: 0, removed: 0 })

  try {
    const results = await syncTransactionsForUser(admin, user.id, items)
    const totals = results.reduce(
      (s, r) => ({ added: s.added + r.added, modified: s.modified + r.modified, removed: s.removed + r.removed }),
      { added: 0, modified: 0, removed: 0 }
    )
    return NextResponse.json({ ...totals, items: results })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 })
  }
}
