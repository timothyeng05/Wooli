import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Daily job — recurring-transaction generation only.
//
// Transaction sync, balance refresh and the net-worth snapshot used to run here
// too. They're now driven from the UI: the sync button and the accounts page hit
// /api/simplefin/sync-transactions and /api/simplefin/refresh-balances, and the
// latter takes the net-worth snapshot. Recurring generation has no such trigger,
// so it stays on a schedule.
export const maxDuration = 60

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Admin = ReturnType<typeof adminClient>

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

// Generate any due recurring transactions for one user and advance their next_date.
async function generateRecurringForUser(supabase: Admin, userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const { data: dueRecurring } = await supabase
    .from('recurring_transactions')
    .select('id, amount, description, merchant, category_id, next_date, frequency, day_of_month, owner')
    .eq('user_id', userId)
    .eq('is_active', true)
    .lte('next_date', today)

  if (!dueRecurring?.length) return 0

  let generated = 0
  for (const item of dueRecurring) {
    const { error } = await supabase.from('transactions').insert({
      user_id:       userId,
      amount:        item.amount,
      description:   item.description,
      merchant:      item.merchant,
      category_id:   item.category_id,
      transacted_at: item.next_date + 'T12:00:00',
      // Inherit the rule's owner so generated rows don't land unassigned.
      owner:         item.owner ?? null,
      // Generated from a user-defined rule → already confirmed, skip review.
      needs_review:  false,
    })
    // Leave next_date alone if the insert failed, so the next run retries it.
    if (error) continue

    await supabase.from('recurring_transactions')
      .update({
        next_date: advanceDate(item.next_date, item.frequency, item.day_of_month ?? 1),
        last_generated_date: item.next_date,
      })
      .eq('id', item.id)
    generated++
  }
  return generated
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  // An unset secret has to fail closed — comparing against `Bearer undefined`
  // would let anyone sending that literal header trigger a service-role run.
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: dueUsers } = await supabase
    .from('recurring_transactions')
    .select('user_id')
    .eq('is_active', true)
    .lte('next_date', today)

  const userIds = [...new Set((dueUsers ?? []).map(r => r.user_id))]

  const summary: Record<string, { generated: number; error?: string }> = {}
  for (const userId of userIds) {
    try {
      summary[userId] = { generated: await generateRecurringForUser(supabase, userId) }
    } catch (e) {
      summary[userId] = { generated: 0, error: e instanceof Error ? e.message : 'failed' }
    }
  }

  return NextResponse.json({ ok: true, users: userIds.length, summary })
}
