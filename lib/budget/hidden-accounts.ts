import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hiding an account (`synced_accounts.is_hidden`) hides its transactions too —
 * they drop out of the transaction list, the review queue and its badge counts,
 * and every report.
 *
 * Transactions link to a synced account by the denormalized text
 * `transactions.provider_account_id`, not a foreign key, so the exclusion is a
 * value filter rather than a join.
 *
 * This is deliberately separate from `transactions.is_hidden` (migration 055).
 * That flag is a per-transaction decision the user made; account hiding is a
 * property of the account. Keeping them apart means unhiding an account
 * restores exactly the rows that were visible before, leaving any individually
 * hidden ones hidden.
 */

/**
 * Quote a value for a PostgREST `in.(…)` list. Provider account ids come from
 * the bank, so they're quoted and escaped rather than trusted to be bare-safe.
 */
function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * The PostgREST `or` expression that drops transactions on hidden accounts.
 *
 * The `is.null` arm is load-bearing: SQL's `NULL NOT IN (…)` evaluates to NULL,
 * not true, so a bare `not.in` would silently discard every manually-added
 * transaction — those have no `provider_account_id` at all.
 *
 * Returns null when nothing is hidden, which callers must treat as "apply no
 * filter"; PostgREST rejects an empty `in.()` list.
 */
export function buildHiddenAccountFilter(hiddenProviderAccountIds: string[]): string | null {
  if (hiddenProviderAccountIds.length === 0) return null
  const list = hiddenProviderAccountIds.map(quoteFilterValue).join(',')
  return `provider_account_id.is.null,provider_account_id.not.in.(${list})`
}

/**
 * Provider account ids whose transactions should be hidden. Reads through RLS,
 * so `userId` is an optimisation for the server-side callers that already have
 * it rather than the security boundary.
 */
export async function fetchHiddenProviderAccountIds(
  supabase: SupabaseClient,
  userId?: string,
): Promise<string[]> {
  let query = supabase
    .from('synced_accounts')
    .select('provider_account_id')
    .eq('is_hidden', true)
  if (userId) query = query.eq('user_id', userId)
  const { data } = await query
  return (data ?? [])
    .map((row: { provider_account_id: string | null }) => row.provider_account_id)
    .filter((id: string | null): id is string => !!id)
}

/**
 * Fetch the hidden ids and return the ready-to-apply filter in one step, for
 * the callers that don't need the id list itself.
 */
export async function fetchHiddenAccountFilter(
  supabase: SupabaseClient,
  userId?: string,
): Promise<string | null> {
  return buildHiddenAccountFilter(await fetchHiddenProviderAccountIds(supabase, userId))
}

/**
 * Resolve the hidden accounts once, then wrap each transaction query in the
 * exclusion:
 *
 *   const onlyVisible = await visibleTransactionsFilter(supabase, user.id)
 *   onlyVisible(supabase.from('transactions').select(…).eq(…))
 *
 * Returned as a wrapper rather than a filter string so call sites can't forget
 * the "no accounts hidden" case, where PostgREST would reject an empty in.()
 * list. One lookup serves every query on the page.
 */
export async function visibleTransactionsFilter(
  supabase: SupabaseClient,
  userId?: string,
): Promise<<T>(query: T) => T> {
  const filter = await fetchHiddenAccountFilter(supabase, userId)
  return <T,>(query: T): T => (filter ? (query as { or: (f: string) => T }).or(filter) : query)
}
