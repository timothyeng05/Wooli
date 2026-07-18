// Shared Plaid sync logic used by the manual sync route, the reconnect flow,
// and the daily cron. All writes go through the service-role client passed in
// by the caller so RLS never silently drops rows in route handlers.
import type { SupabaseClient } from '@supabase/supabase-js'
import { plaidClient } from '@/lib/budget/plaid-client'
import { buildPipelineContext } from '@/lib/budget/categorize/context'
import { categorizeBatch } from '@/lib/budget/categorize/pipeline'
import type { CategorizeInput } from '@/lib/budget/categorize/types'

export type PlaidItemRow = {
  item_id: string
  access_token: string
  cursor: string | null
  user_id: string
}

export type ItemSyncResult = {
  itemId: string
  added: number
  modified: number
  removed: number
}

const transferKeywords = /payment|autopay|transfer|zelle|venmo|paypal|cashapp|wire|ach|direct dep/i

async function buildAccountMaps(admin: SupabaseClient, userId: string) {
  const { data: plaidAccounts } = await admin
    .from('plaid_accounts')
    .select('account_id, name, mask, owner')
    .eq('user_id', userId)
  return {
    nameMap: new Map<string, string>(
      (plaidAccounts ?? []).map(a => [a.account_id, a.mask ? `${a.name} ···${a.mask}` : a.name])
    ),
    ownerMap: new Map<string, string | null>(
      (plaidAccounts ?? []).map(a => [a.account_id, a.owner ?? null])
    ),
  }
}

/**
 * Pull transactions for every item via transactionsSync and upsert them,
 * running the deterministic categorization layers only (never Groq) so the
 * pull stays fast. Rows no deterministic layer can place stay needs_review
 * for the explicit "Auto-categorize" (Groq) pass.
 */
export async function syncTransactionsForUser(
  admin: SupabaseClient,
  userId: string,
  items: Pick<PlaidItemRow, 'item_id' | 'access_token' | 'cursor'>[],
): Promise<ItemSyncResult[]> {
  const { nameMap, ownerMap } = await buildAccountMaps(admin, userId)
  const pipelineCtx = await buildPipelineContext(admin, userId, { enableGroq: false })

  const results: ItemSyncResult[] = []

  for (const item of items) {
    const result: ItemSyncResult = { itemId: item.item_id, added: 0, modified: 0, removed: 0 }
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
          account_name: nameMap.get(t.account_id) ?? null,
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
            account_name: nameMap.get(t.account_id) ?? null,
            amount: -(t.amount),
            description: t.name,
            merchant: t.merchant_name ?? null,
            transacted_at: t.date + 'T00:00:00',
            category_id: isTransfer ? null : r.category_id,
            is_transfer: isTransfer,
            owner: ownerMap.get(t.account_id) ?? null,
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
        if (upsertError) throw new Error(`Failed to save transactions: ${upsertError.message}`)
        result.added += added.length
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
        result.modified++
      }

      for (const t of removed) {
        await admin.from('transactions').delete().eq('plaid_transaction_id', t.transaction_id)
        result.removed++
      }

      cursor = next_cursor
      hasMore = has_more
    }

    await admin.from('plaid_items').update({ cursor }).eq('item_id', item.item_id)
    results.push(result)
  }

  return results
}

/** Refresh current/available balances for every account under the given items. */
export async function refreshBalancesForItems(
  admin: SupabaseClient,
  items: Pick<PlaidItemRow, 'item_id' | 'access_token'>[],
): Promise<void> {
  for (const item of items) {
    const res = await plaidClient.accountsGet({ access_token: item.access_token })
    const updates = res.data.accounts.map(a => ({
      account_id: a.account_id,
      current_balance: a.balances.current ?? null,
      available_balance: a.balances.available ?? null,
      updated_at: new Date().toISOString(),
    }))
    await Promise.all(updates.map(u =>
      admin.from('plaid_accounts').update(u).eq('account_id', u.account_id)
    ))
  }
}

/** Upsert today's net-worth snapshot from current manual + Plaid balances. */
export async function snapshotNetWorth(admin: SupabaseClient, userId: string): Promise<void> {
  const [{ data: manualAccounts }, { data: plaidAccounts }] = await Promise.all([
    admin.from('accounts').select('current_balance, is_asset').eq('user_id', userId).eq('is_active', true),
    admin.from('plaid_accounts').select('type, current_balance').eq('user_id', userId),
  ])

  const manualAssets = (manualAccounts ?? []).filter(a => a.is_asset).reduce((s, a) => s + Number(a.current_balance), 0)
  const manualLiabilities = (manualAccounts ?? []).filter(a => !a.is_asset).reduce((s, a) => s + Math.abs(Number(a.current_balance)), 0)
  const plaidAssets = (plaidAccounts ?? []).filter(a => a.type !== 'credit' && a.type !== 'loan').reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const plaidLiabilities = (plaidAccounts ?? []).filter(a => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + (a.current_balance ?? 0), 0)

  const assets = manualAssets + plaidAssets
  const liabilities = manualLiabilities + plaidLiabilities
  await admin.from('net_worth_history').upsert(
    { user_id: userId, recorded_on: new Date().toISOString().split('T')[0], assets, liabilities, net_worth: assets - liabilities },
    { onConflict: 'user_id,recorded_on' }
  )
}

/**
 * Fetch an item's accounts from Plaid and upsert them into plaid_accounts.
 * Used on first connect (exchange-token) and on reconnect.
 */
export async function upsertItemAccounts(
  admin: SupabaseClient,
  userId: string,
  itemId: string,
  accessToken: string,
): Promise<number> {
  const accountsRes = await plaidClient.accountsGet({ access_token: accessToken })
  const accounts = accountsRes.data.accounts.map(a => ({
    item_id: itemId,
    user_id: userId,
    account_id: a.account_id,
    name: a.name,
    official_name: a.official_name ?? null,
    type: a.type,
    subtype: a.subtype ?? null,
    mask: a.mask ?? null,
    current_balance: a.balances.current ?? null,
    available_balance: a.balances.available ?? null,
    currency: a.balances.iso_currency_code ?? 'USD',
  }))
  await admin.from('plaid_accounts').upsert(accounts, { onConflict: 'account_id' })
  return accounts.length
}
