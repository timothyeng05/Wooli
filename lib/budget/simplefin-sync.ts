// Shared SimpleFin sync logic used by the manual sync route and the daily cron.
// All writes go through the service-role client passed in by the caller so RLS
// never silently drops rows in route handlers.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchSimplefinAccounts,
  type SimplefinAccount,
  type SimplefinAccountsResponse,
  type SimplefinTransaction,
} from '@/lib/budget/simplefin-client'
import { buildPipelineContext } from '@/lib/budget/categorize/context'
import { categorizeBatch } from '@/lib/budget/categorize/pipeline'
import type { CategorizeInput } from '@/lib/budget/categorize/types'
import { planCsvDedup, type LegacyCandidate } from '@/lib/budget/csv-dedup'

export type BankConnectionRow = {
  id: string
  access_url: string | null
  last_successful_sync_at: string | null
  user_id: string
}

export type ConnectionSyncResult = {
  connectionId: string
  added: number
  modified: number
  removed: number
  /** Incoming rows merged into pre-SimpleFin (CSV-imported) rows instead of inserted. */
  merged: number
  error?: { code: string | null; message: string }
}

/**
 * Descriptions that mark a money movement rather than spending. Every alternative is
 * word-bounded: unanchored fragments matched inside ordinary words (`wire` in "hardwire",
 * `payment` in "PAYMENTRECURRING" on a Verizon bill).
 *
 * `ach` is deliberately absent. It names the rail, not the intent — payroll arrives by ACH
 * too, so it flagged "PRICEWATERHOUSEC PAYROLL ~ Tran: ACHDD" as a transfer and dropped a
 * paycheck out of income. Genuine ACH transfers still match on `transfer`/`zelle`/`wire`.
 */
const transferKeywords = /\b(payment|autopay|transfer|zelle|venmo|paypal|cashapp|wire|direct dep(osit)?)\b/i
const DAY_SECONDS = 86_400
/**
 * How far before the last successful sync each incremental pull reaches back.
 * SimpleFin filters on posted date, and a card purchase posts a day or more
 * after it happens — so a transaction can enter the feed dated earlier than a
 * window anchored strictly at the last sync. Wide enough for slow issuers;
 * re-fetched rows are absorbed by the upsert.
 */
const LOOKBACK_DAYS = 14

function simplefinErrorInfo(err: unknown): { code: string | null; message: string } {
  return { code: null, message: err instanceof Error ? err.message : 'Unknown sync error' }
}

/**
 * SimpleFin reports `balance` from an equity perspective — negative means the
 * account holder owes money, regardless of account type (a credit card in
 * debt comes back negative, same as an overdrawn checking account). Wooli's
 * liability accounting was inherited from Plaid, which stores credit/loan
 * balances as a positive "amount owed" instead. SimpleFin never reports an
 * account type, so this can only be applied once the user has classified the
 * account via `type_override` — until then the raw (unflipped) balance is
 * stored, which just means a not-yet-classified card briefly shows under
 * "Cash" with the wrong sign until the user sets its type and it re-syncs.
 */
function normalizeSimplefinBalance(raw: number, typeOverride: string | null | undefined): number {
  return (typeOverride === 'credit' || typeOverride === 'loan') ? -raw : raw
}

/** provider_account_id -> type_override, for the accounts about to be written. */
async function fetchTypeOverrides(
  admin: SupabaseClient,
  providerAccountIds: string[],
): Promise<Map<string, string | null>> {
  if (!providerAccountIds.length) return new Map()
  const { data } = await admin
    .from('synced_accounts')
    .select('provider_account_id, type_override')
    .in('provider_account_id', providerAccountIds)
  return new Map((data ?? []).map(r => [r.provider_account_id, r.type_override]))
}

// Health-column updates are best-effort: sync itself is unaffected if they fail.
async function markConnectionHealthy(admin: SupabaseClient, connectionId: string) {
  const now = new Date().toISOString()
  await admin.from('bank_connections')
    .update({ status: 'healthy', error_code: null, error_message: null, last_successful_sync_at: now, last_sync_attempt_at: now })
    .eq('id', connectionId)
}

async function markConnectionError(admin: SupabaseClient, connectionId: string, error: { code: string | null; message: string }) {
  await admin.from('bank_connections')
    .update({ status: 'error', error_code: error.code, error_message: error.message, last_sync_attempt_at: new Date().toISOString() })
    .eq('id', connectionId)
}

async function buildAccountMaps(admin: SupabaseClient, userId: string) {
  const { data: accounts } = await admin
    .from('synced_accounts')
    .select('provider_account_id, name, mask, owner, nickname')
    .eq('user_id', userId)
  return {
    nameMap: new Map<string, string>(
      (accounts ?? []).map(a => {
        const label = a.nickname || a.name
        return [a.provider_account_id, a.mask ? `${label} ···${a.mask}` : label]
      })
    ),
    ownerMap: new Map<string, string | null>(
      (accounts ?? []).map(a => [a.provider_account_id, a.owner ?? null])
    ),
  }
}

type SyncContext = {
  admin: SupabaseClient
  userId: string
  nameMap: Map<string, string>
  ownerMap: Map<string, string | null>
  pipelineCtx: Awaited<ReturnType<typeof buildPipelineContext>>
}

/**
 * Resolve the date Wooli files a transaction under. `posted` is 0 while a
 * transaction is pending, which would otherwise file the row under 1970 —
 * fall back to `transacted_at` when the institution sends it, then to now, so
 * a pending row sorts where the user expects until it posts for real.
 */
function resolveTransactedAt(txn: SimplefinTransaction, nowSeconds: number): string {
  return new Date((txn.posted || txn.transacted_at || nowSeconds) * 1000).toISOString()
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/** Pre-SimpleFin rows (CSV imports, manual entries) in the date span, paginated past the 1000-row cap. */
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
      .is('provider_transaction_id', null)
      .gte('transacted_at', spanStart)
      .lte('transacted_at', spanEnd)
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (!data?.length) break
    all = all.concat(data as LegacyCandidate[])
    if (data.length < PAGE) break
  }
  return all
}

/**
 * Pull transactions for every connection and upsert them, running the
 * deterministic categorization layers only (never Groq) so the pull stays
 * fast. Rows no deterministic layer can place stay needs_review for the
 * explicit "Auto-categorize" (Groq) pass.
 */
export async function syncTransactionsForUser(
  admin: SupabaseClient,
  userId: string,
  connections: Pick<BankConnectionRow, 'id' | 'access_url' | 'last_successful_sync_at'>[],
): Promise<ConnectionSyncResult[]> {
  const { nameMap, ownerMap } = await buildAccountMaps(admin, userId)
  const pipelineCtx = await buildPipelineContext(admin, userId, { enableGroq: false })
  const ctx: SyncContext = { admin, userId, nameMap, ownerMap, pipelineCtx }

  const results: ConnectionSyncResult[] = []

  for (const connection of connections) {
    const result: ConnectionSyncResult = { connectionId: connection.id, added: 0, modified: 0, removed: 0, merged: 0 }
    if (!connection.access_url) {
      result.error = { code: 'NEEDS_RECONNECT', message: 'Connection has no access URL — reconnect via SimpleFin.' }
      results.push(result)
      continue
    }
    try {
      await syncOneConnection(ctx, connection, result)
      await markConnectionHealthy(admin, connection.id)
    } catch (err) {
      // One broken institution must not abort the others — record it and move on.
      result.error = simplefinErrorInfo(err)
      await markConnectionError(admin, connection.id, result.error)
    }
    results.push(result)
  }

  return results
}

async function syncOneConnection(
  ctx: SyncContext,
  connection: Pick<BankConnectionRow, 'id' | 'access_url' | 'last_successful_sync_at'>,
  result: ConnectionSyncResult,
) {
  const { admin, userId, nameMap, ownerMap, pipelineCtx } = ctx

  // No cursor like Plaid's transactionsSync — SimpleFin uses date-range queries.
  // First sync backfills ~2 years; every later sync re-fetches LOOKBACK_DAYS as a
  // safety buffer for late postings and pending→posted transitions.
  //
  // Deliberately no end-date: the protocol's end-date is exclusive, so pinning it
  // to "now" risks dropping a transaction that posts on the boundary and buys
  // nothing in return. Open-ended is what "everything since the last sync" means.
  const nowSeconds = Math.floor(Date.now() / 1000)
  const startDate = connection.last_successful_sync_at
    ? Math.floor(new Date(connection.last_successful_sync_at).getTime() / 1000) - LOOKBACK_DAYS * DAY_SECONDS
    : nowSeconds - 2 * 365 * DAY_SECONDS

  const res = await fetchSimplefinAccounts(connection.access_url!, { startDate, pending: true })

  // SimpleFin can return HTTP 200 with a populated top-level errors array
  // alongside a partial accounts list — record the error but keep whatever
  // accounts did come back rather than throwing away good data.
  if (res.errors?.length) {
    result.error = { code: null, message: res.errors.join('; ') }
  }

  const pairs: { account: SimplefinAccount; txn: SimplefinTransaction }[] = []
  for (const account of res.accounts ?? []) {
    for (const txn of account.transactions ?? []) pairs.push({ account, txn })
  }
  if (!pairs.length) return

  const inputs: CategorizeInput[] = pairs.map(({ account, txn }) => ({
    raw_merchant: txn.payee ?? null,
    description: txn.description,
    amount: Number(txn.amount),
    account_name: nameMap.get(account.id) ?? null,
    // SimpleFin has no category taxonomy — always null, same as CSV imports.
    provider_category: null,
    provider_confidence: null,
  }))
  const cat = await categorizeBatch(inputs, pipelineCtx)

  const rows = pairs.map(({ account, txn }, i) => {
    const r = cat[i]
    const isTransfer = r.is_transfer || transferKeywords.test(txn.description)
    return {
      user_id: userId,
      provider_transaction_id: txn.id,
      provider_account_id: account.id,
      account_name: nameMap.get(account.id) ?? null,
      // SimpleFin's amount is already signed the way Wooli stores it — no negation.
      amount: Number(txn.amount),
      description: txn.description,
      merchant: txn.payee ?? null,
      transacted_at: resolveTransactedAt(txn, nowSeconds),
      category_id: isTransfer ? null : r.category_id,
      is_transfer: isTransfer,
      is_pending: !!txn.pending,
      owner: ownerMap.get(account.id) ?? null,
      normalized_merchant: r.normalized_merchant,
      provider_category: null,
      // A detected transfer is classified, not unclassified — recording it as 'none'
      // made it indistinguishable from a genuine pipeline miss in any review stats.
      categorization_source: isTransfer ? 'transfer_rule' : r.source,
      categorization_confidence: r.confidence,
      // Trust the pipeline's own verdict: a confident deterministic hit clears review,
      // a fall-through stays flagged. Hardcoding true here discarded that signal and
      // put every high-confidence merchant-memory match back in the queue by hand.
      needs_review: r.needs_review,
      groq_called: false,
    }
  })

  // Legacy-CSV dedup guard: the first sync backfills history that overlaps
  // rows imported from CSV. Merge single matches into the CSV row (it keeps
  // its user-curated category and gains the SimpleFin ids); insert ambiguous
  // ones flagged needs_review. Self-disables once no legacy rows exist in the
  // batch's date span.
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
            provider_transaction_id: rows[index].provider_transaction_id,
            provider_account_id: rows[index].provider_account_id,
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

  // Clobber guard: SimpleFin re-sends every transaction in the date window on
  // every sync (no cursor), so the upsert must not overwrite a category the
  // user confirmed by hand. Also tells added vs modified apart, since
  // SimpleFin (unlike Plaid) doesn't split them into separate arrays.
  const ids = insertRows.map(r => r.provider_transaction_id)
  const { data: existing } = await admin
    .from('transactions')
    .select('provider_transaction_id, categorization_source')
    .eq('user_id', userId)
    .in('provider_transaction_id', ids)
  const existingIds = new Set((existing ?? []).map(e => e.provider_transaction_id))
  const confirmed = new Set(
    (existing ?? [])
      .filter(e => e.categorization_source === 'user_confirmed')
      .map(e => e.provider_transaction_id)
  )
  const safeRows = insertRows.filter(r => !confirmed.has(r.provider_transaction_id))

  if (safeRows.length) {
    const { error: upsertError } = await admin
      .from('transactions')
      .upsert(safeRows, { onConflict: 'provider_transaction_id' })
    if (upsertError) throw new Error(`Failed to save transactions: ${upsertError.message}`)
  }
  for (const r of safeRows) {
    if (existingIds.has(r.provider_transaction_id)) result.modified++
    else result.added++
  }
  // SimpleFin has no equivalent of Plaid's "removed" events — a snapshot
  // re-fetch never tells us a transaction disappeared, so this always stays 0.
}

/**
 * Refresh current/available balances for every connection. A failing
 * institution is recorded on its bank_connections row and skipped.
 */
export async function refreshBalancesForConnections(
  admin: SupabaseClient,
  connections: Pick<BankConnectionRow, 'id' | 'access_url'>[],
): Promise<{ connectionId: string; error?: { code: string | null; message: string } }[]> {
  const results: { connectionId: string; error?: { code: string | null; message: string } }[] = []
  for (const connection of connections) {
    if (!connection.access_url) {
      results.push({ connectionId: connection.id, error: { code: 'NEEDS_RECONNECT', message: 'Connection has no access URL — reconnect via SimpleFin.' } })
      continue
    }
    try {
      const res = await fetchSimplefinAccounts(connection.access_url, { balancesOnly: true })
      const overrides = await fetchTypeOverrides(admin, (res.accounts ?? []).map(a => a.id))
      const updates = (res.accounts ?? []).map(a => ({
        provider_account_id: a.id,
        current_balance: normalizeSimplefinBalance(Number(a.balance), overrides.get(a.id)),
        available_balance: a['available-balance'] != null ? Number(a['available-balance']) : null,
        updated_at: new Date().toISOString(),
      }))
      await Promise.all(updates.map(u =>
        admin.from('synced_accounts')
          .update({ current_balance: u.current_balance, available_balance: u.available_balance, updated_at: u.updated_at })
          .eq('provider_account_id', u.provider_account_id)
      ))
      results.push({ connectionId: connection.id })
    } catch (err) {
      const error = simplefinErrorInfo(err)
      await markConnectionError(admin, connection.id, error)
      results.push({ connectionId: connection.id, error })
    }
  }
  return results
}

/** Upsert today's net-worth snapshot from current manual + synced balances. */
export async function snapshotNetWorth(admin: SupabaseClient, userId: string): Promise<void> {
  const [{ data: manualAccounts }, { data: syncedAccounts }] = await Promise.all([
    admin.from('accounts').select('current_balance, is_asset').eq('user_id', userId).eq('is_active', true),
    admin.from('synced_accounts').select('type, type_override, current_balance').eq('user_id', userId),
  ])

  const manualAssets = (manualAccounts ?? []).filter(a => a.is_asset).reduce((s, a) => s + Number(a.current_balance), 0)
  const manualLiabilities = (manualAccounts ?? []).filter(a => !a.is_asset).reduce((s, a) => s + Math.abs(Number(a.current_balance)), 0)

  // SimpleFin has no account-type taxonomy — new accounts land with type=null
  // and rely on the user-set type_override (same resolution as accounts/page.tsx's plaidType()).
  const isLiability = (a: { type: string | null; type_override: string | null }) => {
    const t = a.type_override ?? a.type
    return t === 'credit' || t === 'loan'
  }
  const syncedAssets = (syncedAccounts ?? []).filter(a => !isLiability(a)).reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const syncedLiabilities = (syncedAccounts ?? []).filter(isLiability).reduce((s, a) => s + (a.current_balance ?? 0), 0)

  const assets = manualAssets + syncedAssets
  const liabilities = manualLiabilities + syncedLiabilities
  await admin.from('net_worth_history').upsert(
    { user_id: userId, recorded_on: new Date().toISOString().split('T')[0], assets, liabilities, net_worth: assets - liabilities },
    { onConflict: 'user_id,recorded_on' }
  )
}

/**
 * Fetch a connection's accounts from SimpleFin and upsert them into
 * synced_accounts. Used on first connect and on reconnect.
 *
 * A single setup token covers the user's whole SimpleFin bridge, which can
 * span multiple institutions in one response — so each account's own `org`
 * is stored on the row (org_name/org_domain) rather than assumed to match
 * whatever label the connection itself carries.
 */
export async function upsertConnectionAccounts(
  admin: SupabaseClient,
  userId: string,
  connectionId: string,
  accessUrl: string,
  preFetched?: SimplefinAccountsResponse,
): Promise<{ count: number; orgName: string | null; orgDomain: string | null }> {
  const res = preFetched ?? await fetchSimplefinAccounts(accessUrl, { balancesOnly: true })
  const accounts = res.accounts ?? []
  const overrides = await fetchTypeOverrides(admin, accounts.map(a => a.id))
  const rows = accounts.map(a => ({
    connection_id: connectionId,
    user_id: userId,
    provider_account_id: a.id,
    name: a.name,
    // SimpleFin has no type/subtype/mask taxonomy — type_override (set via UI)
    // is how the user buckets a new account into cash/investment/credit/loan.
    type: null,
    subtype: null,
    mask: null,
    current_balance: normalizeSimplefinBalance(Number(a.balance), overrides.get(a.id)),
    available_balance: a['available-balance'] != null ? Number(a['available-balance']) : null,
    currency: a.currency ?? 'USD',
    org_name: a.org?.name ?? null,
    org_domain: a.org?.domain ?? null,
  }))
  if (rows.length) {
    await admin.from('synced_accounts').upsert(rows, { onConflict: 'provider_account_id' })
  }
  // Connection-level label is just a display fallback for the health strip —
  // real per-account institution display always prefers each row's own org_name.
  const distinctOrgNames = [...new Set(accounts.map(a => a.org?.name).filter((n): n is string => !!n))]
  const orgName = distinctOrgNames.length === 1
    ? distinctOrgNames[0]
    : distinctOrgNames.length > 1
      ? `SimpleFin (${distinctOrgNames.length} institutions)`
      : null
  const orgDomain = distinctOrgNames.length === 1
    ? (accounts.find(a => a.org?.name === distinctOrgNames[0])?.org?.domain ?? null)
    : null
  return { count: accounts.length, orgName, orgDomain }
}
