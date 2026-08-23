import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hiding an account's transactions is its own switch, separate from hiding the
 * account itself:
 *
 *   synced_accounts.is_hidden            -> hide the row on the accounts page
 *   *.exclude_from_reports               -> hide that account's transactions
 *
 * Only the second one is read here. The two were a single flag until the split;
 * migration `split_hide_account_from_hide_transactions` backfilled
 * `exclude_from_reports` from `is_hidden` so behaviour was unchanged at the
 * moment of the split.
 *
 * Excluded transactions drop out of the list, the review queue and its badge
 * counts, and every report.
 *
 * Transactions reach a synced account through the denormalized text
 * `transactions.provider_account_id` and a manual one through
 * `transactions.account_id`, neither of which is a foreign key to a single
 * table — so this is a value filter rather than a join, and both columns have
 * to be covered.
 *
 * Deliberately separate from `transactions.is_hidden` (migration 055): that is
 * a per-transaction decision the user made, this is a property of the account.
 * Keeping them apart means un-excluding an account restores exactly the rows
 * that were visible before, leaving individually hidden ones hidden.
 */

/** Columns on `transactions` that can point at an excluded account. */
export type AccountRefColumn = 'provider_account_id' | 'account_id'

/**
 * Quote a value for a PostgREST `in.(…)` list. Account ids come from the bank,
 * so they are quoted and escaped rather than trusted to be bare-safe — an
 * unquoted comma would silently widen the exclusion.
 */
function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * The PostgREST `or` expression excluding transactions that point at one of
 * `ids` through `column`.
 *
 * The `is.null` arm is load-bearing: SQL's `NULL NOT IN (…)` evaluates to NULL,
 * not true, so a bare `not.in` would silently discard every transaction that
 * has no value in that column at all — which for `provider_account_id` is every
 * manually added row, and for `account_id` is every synced one.
 *
 * Returns null when nothing is excluded, which callers must treat as "apply no
 * filter"; PostgREST rejects an empty `in.()` list.
 */
export function buildAccountExclusionFilter(
  column: AccountRefColumn,
  excludedIds: string[],
): string | null {
  if (excludedIds.length === 0) return null
  const list = excludedIds.map(quoteFilterValue).join(',')
  return `${column}.is.null,${column}.not.in.(${list})`
}

/** Back-compat alias for the synced-account case. */
export function buildHiddenAccountFilter(excludedProviderAccountIds: string[]): string | null {
  return buildAccountExclusionFilter('provider_account_id', excludedProviderAccountIds)
}

export interface ExcludedAccountRefs {
  /** synced_accounts.provider_account_id values */
  providerAccountIds: string[]
  /** accounts.id values */
  accountIds: string[]
}

/**
 * Accounts whose transactions should be hidden. Reads through RLS, so `userId`
 * is an optimisation for server-side callers that already have it rather than
 * the security boundary.
 */
export async function fetchExcludedAccountRefs(
  supabase: SupabaseClient,
  userId?: string,
): Promise<ExcludedAccountRefs> {
  let syncedQuery = supabase
    .from('synced_accounts')
    .select('provider_account_id')
    .eq('exclude_from_reports', true)
  let manualQuery = supabase
    .from('accounts')
    .select('id')
    .eq('exclude_from_reports', true)
  if (userId) {
    syncedQuery = syncedQuery.eq('user_id', userId)
    manualQuery = manualQuery.eq('user_id', userId)
  }

  const [synced, manual] = await Promise.all([syncedQuery, manualQuery])

  return {
    providerAccountIds: (synced.data ?? [])
      .map((r: { provider_account_id: string | null }) => r.provider_account_id)
      .filter((v: string | null): v is string => !!v),
    accountIds: (manual.data ?? [])
      .map((r: { id: string | null }) => r.id)
      .filter((v: string | null): v is string => !!v),
  }
}

/**
 * Resolve the excluded accounts once, then wrap each transaction query:
 *
 *   const onlyVisible = await visibleTransactionsFilter(supabase, user.id)
 *   onlyVisible(supabase.from('transactions').select(…).eq(…))
 *
 * Returned as a wrapper rather than a filter string so call sites can't forget
 * the "nothing excluded" case, where PostgREST would reject an empty in.()
 * list. One lookup serves every query on the page.
 *
 * Both arms are applied as separate top-level `or=` params, which PostgREST
 * ANDs — so a transaction is dropped if EITHER its synced account or its manual
 * account is excluded.
 */
export async function visibleTransactionsFilter(
  supabase: SupabaseClient,
  userId?: string,
): Promise<<T>(query: T) => T> {
  const refs = await fetchExcludedAccountRefs(supabase, userId)
  const filters = [
    buildAccountExclusionFilter('provider_account_id', refs.providerAccountIds),
    buildAccountExclusionFilter('account_id', refs.accountIds),
  ].filter((f): f is string => f !== null)

  return <T,>(query: T): T =>
    filters.reduce<T>((q, f) => (q as { or: (s: string) => T }).or(f), query)
}
