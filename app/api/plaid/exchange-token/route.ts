import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { plaidClient } from '@/lib/budget/plaid-client'
import { upsertItemAccounts } from '@/lib/budget/plaid-sync'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { public_token, institution_name, institution_id } = await request.json()

  const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token })
  const { access_token, item_id } = exchangeRes.data

  // Store item
  await supabase.from('plaid_items').upsert({
    user_id: user.id,
    item_id,
    access_token,
    institution_name,
    institution_id,
  }, { onConflict: 'item_id' })

  // Fetch and store all accounts for this institution (no per-account cap)
  await upsertItemAccounts(supabase, user.id, item_id, access_token)

  return NextResponse.json({ ok: true })
}
