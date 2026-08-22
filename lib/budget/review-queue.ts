import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchHiddenAccountFilter } from './hidden-accounts'

/**
 * Size of the review queue — the number behind the violet badge on the
 * Transactions nav item.
 *
 * Shared because four places used to ask this question independently
 * (`TransactionList`'s own count, its `fetchUnreviewed` queue, `BudgetSidebar`,
 * `BudgetMobileDrawer`) and every exclusion added to the queue had to be
 * mirrored in all of them by hand. When they disagree the badge shows a count
 * the queue can't produce, and clearing the queue never zeroes the badge.
 *
 * Excluded, matching `fetchUnreviewed`: individually hidden transactions
 * (`is_hidden`), and transactions on a hidden account.
 */
export async function countUnreviewed(supabase: SupabaseClient): Promise<number> {
  const hiddenAccountFilter = await fetchHiddenAccountFilter(supabase)
  const base = supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('needs_review', true)
    .eq('is_hidden', false)
  const { count } = await (hiddenAccountFilter ? base.or(hiddenAccountFilter) : base)
  return count ?? 0
}
