import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function ymd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Step next_date forward one period. Month arithmetic works on the date parts
// rather than Date.setMonth: a rule on the 31st has to clamp to Feb 28/29, not
// overflow into March and skip February entirely.
function advanceDate(current: string, frequency: string, dayOfMonth: number): string {
  const [y, m, d] = current.split('-').map(Number)

  if (frequency === 'monthly') {
    const year = m === 12 ? y + 1 : y
    const monthIndex = m === 12 ? 0 : m
    const lastDay = new Date(year, monthIndex + 1, 0).getDate()
    return ymd(year, monthIndex, Math.min(dayOfMonth, lastDay))
  }

  const next = new Date(Date.UTC(y, m - 1, d))
  if      (frequency === 'biweekly') next.setUTCDate(next.getUTCDate() + 14)
  else if (frequency === 'weekly')   next.setUTCDate(next.getUTCDate() + 7)
  else if (frequency === 'yearly')   next.setUTCFullYear(next.getUTCFullYear() + 1)
  return next.toISOString().split('T')[0]
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

  // Walk each rule forward until it's no longer due, rather than emitting a
  // single period per call. A rule that has been missed for three months owes
  // three transactions, and the caller shouldn't have to invoke this repeatedly
  // to collect them. Capped so a corrupt next_date can't spin forever.
  const MAX_CATCH_UP = 60
  let generated = 0

  for (const item of due) {
    let cursor: string = item.next_date
    let lastGenerated: string | null = null

    for (let i = 0; i < MAX_CATCH_UP && cursor <= today; i++) {
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: item.amount,
        description: item.description,
        merchant: item.merchant,
        category_id: item.category_id,
        transacted_at: cursor + 'T12:00:00',
        // Inherit the rule's owner so generated rows don't land unassigned.
        owner: item.owner ?? null,
        // Generated from a user-defined recurring rule → already confirmed, skip review.
        needs_review: false,
      })
      // Leave next_date where it is so the next run retries this period.
      if (error) break

      lastGenerated = cursor
      cursor = advanceDate(cursor, item.frequency, item.day_of_month ?? 1)
      generated++
    }

    if (lastGenerated) {
      await supabase
        .from('recurring_transactions')
        .update({ next_date: cursor, last_generated_date: lastGenerated })
        .eq('id', item.id)
    }
  }

  return NextResponse.json({ generated })
}
