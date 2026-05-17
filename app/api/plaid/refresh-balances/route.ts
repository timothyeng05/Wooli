import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { plaidClient } from '@/lib/plaid-client'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: items } = await supabase
    .from('plaid_items')
    .select('item_id, access_token')
    .eq('user_id', user.id)

  if (!items?.length) return NextResponse.json({ ok: true })

  await Promise.all(items.map(async (item) => {
    const res = await plaidClient.accountsGet({ access_token: item.access_token })
    const updates = res.data.accounts.map(a => ({
      account_id: a.account_id,
      current_balance: a.balances.current ?? null,
      available_balance: a.balances.available ?? null,
      updated_at: new Date().toISOString(),
    }))
    await Promise.all(updates.map(u =>
      supabase.from('plaid_accounts').update(u).eq('account_id', u.account_id)
    ))
  }))

  return NextResponse.json({ ok: true })
}
