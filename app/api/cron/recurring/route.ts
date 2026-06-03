import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: dueRecurring } = await supabase
    .from('recurring_transactions')
    .select('id, user_id, amount, description, merchant, category_id, next_date, frequency, day_of_month')
    .eq('is_active', true)
    .lte('next_date', today)

  if (!dueRecurring?.length) {
    return NextResponse.json({ ok: true, generated: 0 })
  }

  let generated = 0
  for (const item of dueRecurring) {
    await supabase.from('transactions').insert({
      user_id:      item.user_id,
      amount:       item.amount,
      description:  item.description,
      merchant:     item.merchant,
      category_id:  item.category_id,
      transacted_at: item.next_date + 'T12:00:00',
    })
    const d = new Date(item.next_date + 'T00:00:00')
    if      (item.frequency === 'monthly')  { d.setMonth(d.getMonth() + 1); d.setDate(item.day_of_month ?? 1) }
    else if (item.frequency === 'biweekly') d.setDate(d.getDate() + 14)
    else if (item.frequency === 'weekly')   d.setDate(d.getDate() + 7)
    else if (item.frequency === 'yearly')   d.setFullYear(d.getFullYear() + 1)
    await supabase.from('recurring_transactions')
      .update({ next_date: d.toISOString().split('T')[0], last_generated_date: item.next_date })
      .eq('id', item.id)
    generated++
  }

  return NextResponse.json({ ok: true, generated })
}
