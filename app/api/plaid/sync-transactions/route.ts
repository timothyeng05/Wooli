import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { plaidClient } from '@/lib/budget/plaid-client'
import { PLAID_TRANSACTION_SYNC_ENABLED } from '@/lib/budget/sync-config'
import { buildPipelineContext } from '@/lib/budget/categorize/context'
import { categorizeBatch } from '@/lib/budget/categorize/pipeline'
import type { CategorizeInput } from '@/lib/budget/categorize/types'

// Pull + deterministic categorization. At sync we run only the fast deterministic
// layers (rules, merchant memory, provider mapping, similarity) — never Groq — so
// the pull stays quick and can't be aborted mid-write. Rows that no deterministic
// layer can place are left needs_review for the explicit "Auto-categorize" (Groq) pass.
export async function POST() {
  // Transaction sync is disabled — Monarch CSV is the source of truth. See lib/budget/sync-config.ts
  if (!PLAID_TRANSACTION_SYNC_ENABLED) return NextResponse.json({ added: 0, modified: 0, removed: 0, disabled: true })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role for DB queries so RLS doesn't silently block rows in route handlers
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: items } = await admin
    .from('plaid_items')
    .select('item_id, access_token, cursor')
    .eq('user_id', user.id)

  if (!items?.length) return NextResponse.json({ added: 0, modified: 0, removed: 0 })

  // Build account_id → display name and owner maps
  const { data: plaidAccounts } = await admin
    .from('plaid_accounts')
    .select('account_id, name, mask, owner')
    .eq('user_id', user.id)
  const accountNameMap = new Map(
    (plaidAccounts ?? []).map(a => [a.account_id, a.mask ? `${a.name} ···${a.mask}` : a.name])
  )
  const accountOwnerMap = new Map(
    (plaidAccounts ?? []).map(a => [a.account_id, a.owner ?? null])
  )

  // Deterministic-only categorization context (no Groq at sync time).
  const pipelineCtx = await buildPipelineContext(admin, user.id, { enableGroq: false })

  let totalAdded = 0
  let totalModified = 0
  let totalRemoved = 0

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
        // Run the deterministic layers (skipGroq) to place what we can at sync time.
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
            user_id: user.id,
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
        const { error: upsertError } = await admin
          .from('transactions')
          .upsert(rows, { onConflict: 'plaid_transaction_id' })
        if (upsertError) {
          return NextResponse.json({ error: `Failed to save transactions: ${upsertError.message}` }, { status: 500 })
        }
        totalAdded += added.length
      }

      for (const t of modified) {
        await admin
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
        await admin.from('transactions').delete().eq('plaid_transaction_id', t.transaction_id)
        totalRemoved++
      }

      cursor = next_cursor
      hasMore = has_more
    }

    await admin.from('plaid_items').update({ cursor }).eq('item_id', item.item_id)
  }

  return NextResponse.json({ added: totalAdded, modified: totalModified, removed: totalRemoved })
}
