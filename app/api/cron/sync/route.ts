import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLAID_TRANSACTION_SYNC_ENABLED, PLAID_BALANCE_SYNC_ENABLED } from '@/lib/budget/sync-config'
import { syncTransactionsForUser, refreshBalancesForItems, snapshotNetWorth, type PlaidItemRow } from '@/lib/budget/plaid-sync'

export const maxDuration = 300 // 5 min — long enough for multi-user sync

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Admin = ReturnType<typeof adminClient>

// Generate any due recurring transactions for one user and advance their next_date.
async function generateRecurringForUser(supabase: Admin, userId: string) {
  const today = new Date().toISOString().split('T')[0]
  const { data: dueRecurring } = await supabase
    .from('recurring_transactions')
    .select('id, amount, description, merchant, category_id, next_date, frequency, day_of_month')
    .eq('user_id', userId)
    .eq('is_active', true)
    .lte('next_date', today)

  if (!dueRecurring?.length) return

  for (const item of dueRecurring) {
    await supabase.from('transactions').insert({
      user_id:       userId,
      amount:        item.amount,
      description:   item.description,
      merchant:      item.merchant,
      category_id:   item.category_id,
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
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: allItems } = await supabase
    .from('plaid_items')
    .select('item_id, access_token, cursor, user_id')

  // Group items by user (may be empty if Plaid is not connected)
  const byUser = new Map<string, PlaidItemRow[]>()
  for (const item of (allItems ?? [])) {
    if (!byUser.has(item.user_id)) byUser.set(item.user_id, [])
    byUser.get(item.user_id)!.push(item)
  }

  // If no Plaid items exist, still run recurring generation for all active users.
  // Query distinct user_ids from recurring_transactions where is_active = true.
  if (!byUser.size) {
    const { data: recurringUsers } = await supabase
      .from('recurring_transactions')
      .select('user_id')
      .eq('is_active', true)
      .lte('next_date', today)
    const userIds = [...new Set((recurringUsers ?? []).map(r => r.user_id))]
    for (const userId of userIds) {
      await generateRecurringForUser(supabase, userId)
    }
    return NextResponse.json({ ok: true, users: userIds.length })
  }

  const summary: Record<string, { added: number; modified: number; removed: number }> = {}

  for (const [userId, items] of byUser) {
    let totalAdded = 0, totalModified = 0, totalRemoved = 0

    // ── 1. Sync transactions ──────────────────────────────────────────────────
    if (PLAID_TRANSACTION_SYNC_ENABLED) {
      const results = await syncTransactionsForUser(supabase, userId, items)
      for (const r of results) {
        totalAdded += r.added; totalModified += r.modified; totalRemoved += r.removed
      }
    }

    // ── 2. Refresh balances (kept on for net worth) ───────────────────────────
    if (PLAID_BALANCE_SYNC_ENABLED) {
      await refreshBalancesForItems(supabase, items)
    }

    // ── 3. Generate due recurring transactions ────────────────────────────────
    await generateRecurringForUser(supabase, userId)

    // ── 4. Snapshot net worth ─────────────────────────────────────────────────
    await snapshotNetWorth(supabase, userId)

    summary[userId] = { added: totalAdded, modified: totalModified, removed: totalRemoved }
  }

  return NextResponse.json({ ok: true, users: byUser.size, summary })
}
