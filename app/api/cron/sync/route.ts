import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { plaidClient } from '@/lib/plaid-client'
import { categorizeWithGroq, buildSelectableCategories, type FewShotExample } from '@/lib/groq-categorize'

export const maxDuration = 300 // 5 min — long enough for multi-user sync

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

  const { data: allItems } = await supabase
    .from('plaid_items')
    .select('item_id, access_token, cursor, user_id')

  if (!allItems?.length) return NextResponse.json({ ok: true, users: 0 })

  // Group items by user
  const byUser = new Map<string, typeof allItems>()
  for (const item of allItems) {
    if (!byUser.has(item.user_id)) byUser.set(item.user_id, [])
    byUser.get(item.user_id)!.push(item)
  }

  const summary: Record<string, { added: number; modified: number; removed: number }> = {}

  for (const [userId, items] of byUser) {
    let totalAdded = 0, totalModified = 0, totalRemoved = 0

    // ── 1. Sync transactions ──────────────────────────────────────────────────

    const { data: allCategories } = await supabase
      .from('categories')
      .select('id, name, parent_id, keywords')
      .eq('user_id', userId)

    const categories = buildSelectableCategories(allCategories ?? [])
    const categoryNameMap = new Map(categories.map(c => [c.id, c.name]))

    const { data: exampleTxns } = await supabase
      .from('transactions')
      .select('merchant, category_id')
      .eq('user_id', userId)
      .not('category_id', 'is', null)
      .not('merchant', 'is', null)
      .limit(100)

    const fewShot: FewShotExample[] = (exampleTxns ?? [])
      .filter(t => categoryNameMap.has(t.category_id))
      .map(t => ({ merchant: t.merchant!, categoryName: categoryNameMap.get(t.category_id)! }))
      .filter((e, i, arr) => arr.findIndex(x => x.merchant === e.merchant) === i)

    const transferKeywords = /payment|autopay|transfer|zelle|venmo|paypal|cashapp|wire|ach|direct dep/i

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
          const rows = added.map(t => {
            const isTransfer = !!(
              t.personal_finance_category?.primary?.includes('TRANSFER') ||
              transferKeywords.test(t.name)
            )
            return {
              user_id: userId,
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
            .update({ amount: -(t.amount), description: t.name, merchant: t.merchant_name ?? null, transacted_at: t.date + 'T00:00:00' })
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

    // ── 2. Refresh balances ───────────────────────────────────────────────────

    for (const item of items) {
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
    }

    // ── 3. Snapshot net worth ─────────────────────────────────────────────────

    const [{ data: manualAccounts }, { data: plaidAccounts }] = await Promise.all([
      supabase.from('accounts').select('current_balance, is_asset').eq('user_id', userId).eq('is_active', true),
      supabase.from('plaid_accounts').select('type, current_balance').eq('user_id', userId),
    ])

    const manualAssets = (manualAccounts ?? []).filter(a => a.is_asset).reduce((s, a) => s + Number(a.current_balance), 0)
    const manualLiabilities = (manualAccounts ?? []).filter(a => !a.is_asset).reduce((s, a) => s + Math.abs(Number(a.current_balance)), 0)
    const plaidAssets = (plaidAccounts ?? []).filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + (a.current_balance ?? 0), 0)
    const plaidLiabilities = (plaidAccounts ?? []).filter(a => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + (a.current_balance ?? 0), 0)

    const assets = manualAssets + plaidAssets
    const liabilities = manualLiabilities + plaidLiabilities
    await supabase.from('net_worth_history').upsert(
      { user_id: userId, recorded_on: today, assets, liabilities, net_worth: assets - liabilities },
      { onConflict: 'user_id,recorded_on' }
    )

    summary[userId] = { added: totalAdded, modified: totalModified, removed: totalRemoved }
  }

  return NextResponse.json({ ok: true, users: byUser.size, summary })
}
