// Shared Plaid sync logic used by the manual sync route, the reconnect flow,
// and the daily cron. All writes go through the service-role client passed in
// by the caller so RLS never silently drops rows in route handlers.
import type { SupabaseClient } from '@supabase/supabase-js'
import { plaidClient } from '@/lib/budget/plaid-client'
import { buildPipelineContext } from '@/lib/budget/categorize/context'
import { categorizeBatch } from '@/lib/budget/categorize/pipeline'
import type { CategorizeInput } from '@/lib/budget/categorize/types'
import { planCsvDedup, type LegacyCandidate } from '@/lib/budget/csv-dedup'

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
  /** Incoming rows merged into pre-Plaid (CSV-imported) rows instead of inserted. */
  merged: number
  error?: { code: string | null; message: string }
}

const transferKeywords = /payment|autopay|transfer|zelle|venmo|paypal|cashapp|wire|ach|direct dep/i

/** Plaid SDK errors are axios errors carrying error_code/error_message in the response body. */
function plaidErrorInfo(err: unknown): { code: string | null; message: string } {
  const data = (err as { response?: { data?: { error_code?: string; error_message?: string } } })?.response?.data
  if (data?.error_code || data?.error_message) {
    return { code: data.error_code ?? null, message: data.error_message ?? 'Plaid error' }
  }
  return { code: null, message: err instanceof Error ? err.message : 'Unknown sync error' }
}

// Health-column updates are best-effort: if migration 039 hasn't run yet the
// update fails silently (supabase-js returns the error, never throws) and sync
// itself is unaffected.
async function markItemHealthy(admin: SupabaseClient, itemId: string) {
  const now = new Date().toISOString()
  await admin.from('plaid_items')
    .update({ status: 'healthy', error_code: null, error_message: null, last_successful_sync_at: now, last_sync_attempt_at: now })
    .eq('item_id', itemId)
}

async function markItemError(admin: SupabaseClient, itemId: string, error: { code: string | null; message: string }) {
  await admin.from('plaid_items')
    .update({ status: 'error', error_code: error.code, error_message: error.message, last_sync_attempt_at: new Date().toISOString() })
    .eq('item_id', itemId)
}

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
  const ctx: SyncContext = { admin, userId, nameMap, ownerMap, pipelineCtx }

  const results: ItemSyncResult[] = []

  for (const item of items) {
    const result: ItemSyncResult = { itemId: item.item_id, added: 0, modified: 0, removed: 0, merged: 0 }
    try {
      await syncOneItem(ctx, item, result)
      await markItemHealthy(admin, item.item_id)
    } catch (err) {
      // One broken institution (e.g. ITEM_LOGIN_REQUIRED) must not abort the
      // others — record it and move on.
      result.error = plaidErrorInfo(err)
      await markItemError(admin, item.item_id, result.error)
    }
    results.push(result)
  }

  return results
}

type SyncContext = {
  admin: SupabaseClient
  userId: string
  nameMap: Map<string, string>
  ownerMap: Map<string, string | null>
  pipelineCtx: Awaited<ReturnType<typeof buildPipelineContext>>
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/** Pre-Plaid rows (CSV imports, manual entries) in the date span, paginated past the 1000-row cap. */
async function fetchLegacyCandidates(
  admin: SupabaseClient,
  userId: string,
  spanStart: string,
  spanEnd: string,
): Promise<LegacyCandidate[]> {
  const PAGE = 1000
  let all: LegacyCandidate[] = []
  for (let page = 0; ; page++) {
    const { data } = await admin
      .from('transactions')
      .select('id, transacted_at, amount, merchant, description, normalized_merchant')
      .eq('user_id', userId)
      .is('plaid_transaction_id', null)
      .gte('transacted_at', spanStart)
      .lte('transacted_at', spanEnd)
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (!data?.length) break
    all = all.concat(data as LegacyCandidate[])
    if (data.length < PAGE) break
  }
  return all
}

async function syncOneItem(
  ctx: SyncContext,
  item: Pick<PlaidItemRow, 'item_id' | 'access_token' | 'cursor'>,
  result: ItemSyncResult,
) {
  const { admin, userId, nameMap, ownerMap, pipelineCtx } = ctx
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
      // Pending→posted: when a posted txn references the pending row we already
      // hold (pending_transaction_id), update that row in place instead of
      // relying on Plaid's delete+insert — this keeps the user's category/owner/
      // trip edits. The later `removed` event for the old pending id then no-ops.
      const pendingIds = added.map(t => t.pending_transaction_id).filter((id): id is string => !!id)
      const { data: pendingRows } = pendingIds.length
        ? await admin
            .from('transactions')
            .select('id, plaid_transaction_id')
            .eq('user_id', userId)
            .in('plaid_transaction_id', pendingIds)
        : { data: [] as { id: string; plaid_transaction_id: string }[] }
      const pendingMap = new Map((pendingRows ?? []).map(r => [r.plaid_transaction_id, r.id]))

      const toInsert: typeof added = []
      for (const t of added) {
        const priorId = t.pending_transaction_id ? pendingMap.get(t.pending_transaction_id) : undefined
        if (priorId) {
          await admin
            .from('transactions')
            .update({
              plaid_transaction_id: t.transaction_id,
              plaid_account_id: t.account_id,
              amount: -(t.amount),
              description: t.name,
              merchant: t.merchant_name ?? null,
              transacted_at: t.date + 'T00:00:00',
              is_pending: t.pending,
            })
            .eq('id', priorId)
          result.modified++
        } else {
          toInsert.push(t)
        }
      }

      if (toInsert.length) {
        const inputs: CategorizeInput[] = toInsert.map(t => ({
          raw_merchant: t.merchant_name ?? null,
          description: t.name,
          amount: -(t.amount),
          account_name: nameMap.get(t.account_id) ?? null,
          provider_category: t.personal_finance_category?.detailed ?? t.personal_finance_category?.primary ?? null,
          provider_confidence: t.personal_finance_category?.confidence_level ?? null,
        }))
        const cat = await categorizeBatch(inputs, pipelineCtx)

        const rows = toInsert.map((t, i) => {
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
            is_pending: t.pending,
            owner: ownerMap.get(t.account_id) ?? null,
            normalized_merchant: r.normalized_merchant,
            provider_category: inputs[i].provider_category,
            categorization_source: isTransfer ? 'none' : r.source,
            categorization_confidence: r.confidence,
            needs_review: !isTransfer && r.needs_review,
            groq_called: false,
          }
        })

        // Legacy-CSV dedup guard: the first sync backfills history that overlaps
        // rows imported from Monarch CSV. Merge single matches into the CSV row
        // (it keeps its user-curated category and gains the Plaid ids); insert
        // ambiguous ones flagged needs_review. Self-disables once no legacy rows
        // exist in the batch's date span.
        let insertRows = rows
        {
          const dates = rows.map(r => r.transacted_at.slice(0, 10)).sort()
          const spanStart = addDays(dates[0], -3) + 'T00:00:00'
          const spanEnd = addDays(dates[dates.length - 1], 3) + 'T23:59:59'
          const candidates = await fetchLegacyCandidates(admin, userId, spanStart, spanEnd)
          if (candidates.length) {
            const plan = planCsvDedup(rows, candidates)
            for (const { index, legacyId } of plan.merges) {
              await admin
                .from('transactions')
                .update({
                  plaid_transaction_id: rows[index].plaid_transaction_id,
                  plaid_account_id: rows[index].plaid_account_id,
                  is_pending: rows[index].is_pending,
                })
                .eq('id', legacyId)
              result.merged++
            }
            for (const index of plan.reviews) rows[index].needs_review = true
            const keep = new Set([...plan.inserts, ...plan.reviews])
            insertRows = rows.filter((_, i) => keep.has(i))
          }
        }

        // Clobber guard: if Plaid re-sends a txn we already hold (cursor reset),
        // the upsert must not overwrite a category the user confirmed by hand.
        const ids = insertRows.map(r => r.plaid_transaction_id)
        const { data: existing } = await admin
          .from('transactions')
          .select('plaid_transaction_id, categorization_source')
          .eq('user_id', userId)
          .in('plaid_transaction_id', ids)
        const confirmed = new Set(
          (existing ?? [])
            .filter(e => e.categorization_source === 'user_confirmed')
            .map(e => e.plaid_transaction_id)
        )
        const safeRows = insertRows.filter(r => !confirmed.has(r.plaid_transaction_id))

        if (safeRows.length) {
          const { error: upsertError } = await admin
            .from('transactions')
            .upsert(safeRows, { onConflict: 'plaid_transaction_id' })
          if (upsertError) throw new Error(`Failed to save transactions: ${upsertError.message}`)
        }
        result.added += safeRows.length
      }
    }

    for (const t of modified) {
      await admin
        .from('transactions')
        .update({
          amount: -(t.amount),
          description: t.name,
          merchant: t.merchant_name ?? null,
          transacted_at: t.date + 'T00:00:00',
          is_pending: t.pending,
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

    // Persist the cursor after each fully-applied page so a later failure
    // never rewinds behind writes we already made.
    await admin.from('plaid_items').update({ cursor }).eq('item_id', item.item_id)
  }
}

/**
 * Refresh current/available balances for every account under the given items.
 * A failing institution is recorded on its plaid_items row and skipped.
 */
export async function refreshBalancesForItems(
  admin: SupabaseClient,
  items: Pick<PlaidItemRow, 'item_id' | 'access_token'>[],
): Promise<{ itemId: string; error?: { code: string | null; message: string } }[]> {
  const results: { itemId: string; error?: { code: string | null; message: string } }[] = []
  for (const item of items) {
    try {
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
      results.push({ itemId: item.item_id })
    } catch (err) {
      const error = plaidErrorInfo(err)
      await markItemError(admin, item.item_id, error)
      results.push({ itemId: item.item_id, error })
    }
  }
  return results
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
