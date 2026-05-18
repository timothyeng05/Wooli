import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { plaidClient } from '@/lib/plaid-client'
import { categorizeWithGroq, buildSelectableCategories, type FewShotExample } from '@/lib/groq-categorize'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: items } = await supabase
    .from('plaid_items')
    .select('item_id, access_token, cursor')
    .eq('user_id', user.id)

  if (!items?.length) return NextResponse.json({ added: 0, modified: 0, removed: 0 })

  const { data: allCategories } = await supabase
    .from('categories')
    .select('id, name, parent_id, keywords')
    .eq('user_id', user.id)

  const categories = buildSelectableCategories(allCategories ?? [])
  const categoryNameMap = new Map(categories.map(c => [c.id, c.name]))

  // Build few-shot examples from existing categorized transactions
  const { data: exampleTxns } = await supabase
    .from('transactions')
    .select('merchant, description, category_id')
    .eq('user_id', user.id)
    .not('category_id', 'is', null)
    .not('merchant', 'is', null)
    .limit(100)

  const fewShot: FewShotExample[] = (exampleTxns ?? [])
    .filter(t => categoryNameMap.has(t.category_id))
    .map(t => ({ merchant: t.merchant!, categoryName: categoryNameMap.get(t.category_id)! }))
    .filter((e, i, arr) => arr.findIndex(x => x.merchant === e.merchant) === i)

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

      if (added.length) {
        const CHUNK = 50
        const categoryMap = new Map<string, string | null>()

        for (let i = 0; i < added.length; i += CHUNK) {
          const chunk = added.slice(i, i + CHUNK).map(t => ({
            id: t.transaction_id,
            description: t.name,
            merchant: t.merchant_name ?? null,
          }))
          const partial = await categorizeWithGroq(chunk, categories, fewShot)
          partial.forEach((v, k) => categoryMap.set(k, v))
        }

        const transferKeywords = /payment|autopay|transfer|zelle|venmo|paypal|cashapp|wire|ach|direct dep/i
        const rows = added.map(t => {
          const isTransfer = !!(
            t.personal_finance_category?.primary?.includes('TRANSFER') ||
            transferKeywords.test(t.name)
          )
          return {
            user_id: user.id,
            plaid_transaction_id: t.transaction_id,
            amount: -(t.amount),
            description: t.name,
            merchant: t.merchant_name ?? null,
            transacted_at: t.date + 'T00:00:00',
            category_id: isTransfer ? null : (categoryMap.get(t.transaction_id) ?? null),
            is_transfer: isTransfer,
          }
        })
        await supabase.from('transactions').upsert(rows, { onConflict: 'plaid_transaction_id' })
        totalAdded += added.length
      }

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

      for (const t of removed) {
        await supabase.from('transactions').delete().eq('plaid_transaction_id', t.transaction_id)
        totalRemoved++
      }

      cursor = next_cursor
      hasMore = has_more
    }

    await supabase.from('plaid_items').update({ cursor }).eq('item_id', item.item_id)
  }

  return NextResponse.json({ added: totalAdded, modified: totalModified, removed: totalRemoved })
}
