import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function advanceDate(current: string, frequency: string, dayOfMonth: number): string {
  const d = new Date(current + 'T00:00:00')
  if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1)
    d.setDate(dayOfMonth)
  } else if (frequency === 'biweekly') {
    d.setDate(d.getDate() + 14)
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7)
  } else if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1)
  }
  return d.toISOString().split('T')[0]
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  const { data: due } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .lte('next_date', today)

  if (!due?.length) return NextResponse.json({ generated: 0 })

  let generated = 0
  for (const item of due) {
    // Create the transaction
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      amount: item.amount,
      description: item.description,
      merchant: item.merchant,
      category_id: item.category_id,
      transacted_at: item.next_date + 'T12:00:00',
      // Generated from a user-defined recurring rule → already confirmed, skip review.
      needs_review: false,
    })

    if (!error) {
      const nextDate = advanceDate(item.next_date, item.frequency, item.day_of_month ?? 1)
      await supabase
        .from('recurring_transactions')
        .update({ next_date: nextDate, last_generated_date: item.next_date })
        .eq('id', item.id)
      generated++
    }
  }

  return NextResponse.json({ generated })
}
