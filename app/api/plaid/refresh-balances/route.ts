import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { plaidClient } from '@/lib/budget/plaid-client'

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

  // Capture a net worth snapshot with the freshly-updated balances
  const [{ data: manualAccounts }, { data: plaidAccounts }] = await Promise.all([
    supabase.from('accounts').select('current_balance, is_asset').eq('user_id', user.id).eq('is_active', true),
    supabase.from('plaid_accounts').select('type, current_balance').eq('user_id', user.id),
  ])

  const manualAssets = (manualAccounts ?? []).filter(a => a.is_asset).reduce((s, a) => s + Number(a.current_balance), 0)
  const manualLiabilities = (manualAccounts ?? []).filter(a => !a.is_asset).reduce((s, a) => s + Math.abs(Number(a.current_balance)), 0)
  const plaidAssets = (plaidAccounts ?? []).filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const plaidLiabilities = (plaidAccounts ?? []).filter(a => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + (a.current_balance ?? 0), 0)

  const assets = manualAssets + plaidAssets
  const liabilities = manualLiabilities + plaidLiabilities
  await supabase.from('net_worth_history').upsert(
    { user_id: user.id, recorded_on: new Date().toISOString().split('T')[0], assets, liabilities, net_worth: assets - liabilities },
    { onConflict: 'user_id,recorded_on' }
  )

  return NextResponse.json({ ok: true })
}
