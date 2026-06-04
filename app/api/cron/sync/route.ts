import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { plaidClient } from '@/lib/budget/plaid-client'
import { buildPipelineContext } from '@/lib/budget/categorize/context'
import { categorizeBatch } from '@/lib/budget/categorize/pipeline'
import type { CategorizeInput } from '@/lib/budget/categorize/types'

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

    // Deterministic-only categorization at sync (no Groq in the cron path).
    const pipelineCtx = await buildPipelineContext(supabase, userId, { enableGroq: false })
    const transferKeywords = /payment|autopay|transfer|zelle|venmo|paypal|cashapp|wire|ach|direct dep/i

    const { data: plaidAccts } = await supabase
      .from('plaid_accounts')
      .select('account_id, name, mask, owner')
      .eq('user_id', userId)
    const accountNameMap = new Map(
      (plaidAccts ?? []).map(a => [a.account_id, a.mask ? `${a.name} ···${a.mask}` : a.name])
    )
    const accountOwnerMap = new Map(
      (plaidAccts ?? []).map(a => [a.account_id, a.owner ?? null])
    )

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
          const inputs: CategorizeInput[] = added.map(t => ({
            raw_merchant: t.merchant_name ?? null,
            description: t.name,
            amount: -(t.amount),
            account_name: accountNameMap.get(t.account_id) ?? null,
            provider_category: t.personal_finance_category?.detailed ?? t.personal_finance_category?.primary ?? null,
            provider_confidence: t.personal_finance_category?.confidence_level ?? null,
          }))
          const cat = await categorizeBatch(inputs, pipelineCtx)

          const rows = added.map((t, i) => {
            const r = cat[i]
            const isTransfer = r.is_transfer || !!(
              t.personal_finance_category?.primary?.includes('TRANSFER') ||
              transferKeywords.test(t.name)
            )
            return {
              user_id: userId,
              plaid_transaction_id: t.transaction_id,
              plaid_account_id: t.account_id,
              account_name: accountNameMap.get(t.account_id) ?? null,
              amount: -(t.amount),
              description: t.name,
              merchant: t.merchant_name ?? null,
              transacted_at: t.date + 'T00:00:00',
              category_id: isTransfer ? null : r.category_id,
              is_transfer: isTransfer,
              owner: accountOwnerMap.get(t.account_id) ?? null,
              normalized_merchant: r.normalized_merchant,
              provider_category: inputs[i].provider_category,
              categorization_source: isTransfer ? 'none' : r.source,
              categorization_confidence: r.confidence,
              needs_review: !isTransfer && r.needs_review,
              groq_called: false,
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
