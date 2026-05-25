import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows }: { rows: { date: string; balance: number; account: string }[] } = await request.json()

  const batch = rows
    .filter(r => r.date && r.account && isFinite(r.balance))
    .map(r => ({
      user_id: user.id,
      account_name: r.account.trim(),
      date: r.date.trim(),
      balance: r.balance,
    }))

  const CHUNK = 500
  let imported = 0
  for (let i = 0; i < batch.length; i += CHUNK) {
    const { error } = await supabase
      .from('account_balance_history')
      .upsert(batch.slice(i, i + CHUNK), { onConflict: 'user_id,account_name,date' })
    if (!error) imported += Math.min(CHUNK, batch.length - i)
  }

  return NextResponse.json({ imported, total: batch.length })
}
