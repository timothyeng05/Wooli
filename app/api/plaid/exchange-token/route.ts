import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { plaidClient } from '@/lib/budget/plaid-client'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { public_token, institution_name, institution_id } = await request.json()

  const INSTITUTION_LIMIT = 3

  // Count existing linked institutions before allowing a new one
  const { count: itemCount } = await supabase
    .from('plaid_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((itemCount ?? 0) >= INSTITUTION_LIMIT) {
    return NextResponse.json(
      { error: `Free tier limit reached. You can link a maximum of ${INSTITUTION_LIMIT} institutions.` },
      { status: 403 }
    )
  }

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
  const accountsRes = await plaidClient.accountsGet({ access_token })
  const accounts = accountsRes.data.accounts.map(a => ({
    item_id,
    user_id: user.id,
    account_id: a.account_id,
    name: a.name,
    official_name: a.official_name ?? null,
    type: a.type,
    subtype: a.subtype ?? null,
    mask: a.mask ?? null,
    current_balance: a.balances.current ?? null,
    available_balance: a.balances.available ?? null,
    currency: a.balances.iso_currency_code ?? 'USD',
  }))

  await supabase.from('plaid_accounts').upsert(accounts, { onConflict: 'account_id' })

  return NextResponse.json({ ok: true })
}
