import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { upsertItemAccounts } from '@/lib/budget/plaid-sync'

// Called after an update-mode Link flow succeeds. Update mode keeps the same
// access token, so there is no public-token exchange — we verify the item works
// again, pick up any newly-shared accounts, and clear its error status.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { item_id } = await request.json().catch(() => ({}))
  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: item } = await admin
    .from('plaid_items')
    .select('access_token')
    .eq('item_id', item_id)
    .eq('user_id', user.id)
    .single()
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  try {
    // accountsGet doubles as the health check — it fails if the item is still broken.
    await upsertItemAccounts(admin, user.id, item_id, item.access_token)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Item still unavailable' },
      { status: 502 }
    )
  }

  await admin
    .from('plaid_items')
    .update({ status: 'healthy', error_code: null, error_message: null, last_sync_attempt_at: new Date().toISOString() })
    .eq('item_id', item_id)

  return NextResponse.json({ ok: true })
}
