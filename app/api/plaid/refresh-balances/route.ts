import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { PLAID_BALANCE_SYNC_ENABLED } from '@/lib/budget/sync-config'
import { refreshBalancesForItems, snapshotNetWorth } from '@/lib/budget/plaid-sync'

export async function POST() {
  // Balance sync stays on (used for net worth) — see lib/budget/sync-config.ts
  if (!PLAID_BALANCE_SYNC_ENABLED) return NextResponse.json({ updated: 0, disabled: true })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: items } = await supabase
    .from('plaid_items')
    .select('item_id, access_token')
    .eq('user_id', user.id)

  if (!items?.length) return NextResponse.json({ ok: true })

  await refreshBalancesForItems(admin, items)

  // Capture a net worth snapshot with the freshly-updated balances
  await snapshotNetWorth(admin, user.id)

  return NextResponse.json({ ok: true })
}
