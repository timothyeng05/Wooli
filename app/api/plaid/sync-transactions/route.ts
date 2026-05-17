import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { plaidClient } from '@/lib/plaid-client'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: items } = await supabase
    .from('plaid_items')
    .select('item_id, access_token, cursor')
    .eq('user_id', user.id)

  if (!items?.length) return NextResponse.json({ added: 0, modified: 0, removed: 0 })

  // Fetch user categories for matching
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', user.id)

  const matchCategory = (plaidCategory: string | null): string | null => {
    if (!plaidCategory || !categories?.length) return null
    const needle = plaidCategory.toLowerCase().replace(/_/g, ' ')
    const match = categories.find(c => needle.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(needle.split(' ')[0]))
    return match?.id ?? null
  }

  let totalAdded = 0
  let totalModified = 0
  let totalRemoved = 0

  for (const item of items) {
    let cursor = item.cursor ?? undefined
    let hasMore = true

    while (hasMore) {
      const res = await plaidClient.transactionsSync({
        access_token: item.access_token,
        cursor,
        count: 500,
      })
      const { added, modified, removed, next_cursor, has_more } = res.data

      // Upsert added transactions
      if (added.length) {
        const rows = added.map(t => ({
          user_id: user.id,
          plaid_transaction_id: t.transaction_id,
          // Plaid: positive = expense, negative = income — flip for our schema
          amount: -(t.amount),
          description: t.name,
          merchant: t.merchant_name ?? null,
          transacted_at: t.date + 'T00:00:00',
          category_id: matchCategory(t.personal_finance_category?.primary ?? null),
        }))
        await supabase.from('transactions').upsert(rows, { onConflict: 'plaid_transaction_id' })
        totalAdded += added.length
      }

      // Update modified transactions
      for (const t of modified) {
        await supabase
          .from('transactions')
          .update({
            amount: -(t.amount),
            description: t.name,
            merchant: t.merchant_name ?? null,
            transacted_at: t.date + 'T00:00:00',
          })
          .eq('plaid_transaction_id', t.transaction_id)
        totalModified++
      }

      // Remove deleted transactions
      for (const t of removed) {
        await supabase
          .from('transactions')
          .delete()
          .eq('plaid_transaction_id', t.transaction_id)
        totalRemoved++
      }

      cursor = next_cursor
      hasMore = has_more
    }

    // Save cursor for next incremental sync
    await supabase
      .from('plaid_items')
      .update({ cursor })
      .eq('item_id', item.item_id)
  }

  return NextResponse.json({ added: totalAdded, modified: totalModified, removed: totalRemoved })
}
