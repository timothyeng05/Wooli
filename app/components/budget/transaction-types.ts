export interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  is_income: boolean
  is_transfer: boolean
  parent_id: string | null
}

export interface Trip {
  id: string
  name: string
  start_date?: string
  end_date?: string
}

export interface Transaction {
  id: string
  amount: number
  description: string | null
  merchant: string | null
  transacted_at: string
  provider_transaction_id: string | null
  is_transfer: boolean | null
  is_pending: boolean | null
  needs_review: boolean | null
  owner: string | null
  account_name: string | null
  trip_id: string | null
  account_id: string | null
  notes: string | null
  is_recurring: boolean | null
  /** recurring_transactions row this transaction was marked as an occurrence of. */
  recurring_id: string | null
  /**
   * Excluded from every total — summary bar, day subtotals, dashboard, cash
   * flow, targets — while staying visible (dimmed) in the list so it can be
   * found and unhidden. Unlike `is_transfer` this doesn't relabel the row.
   */
  is_hidden: boolean | null
  categories: { id: string; name: string; color: string; icon?: string | null; is_income?: boolean } | null
  trips: { id: string; name: string } | null
}

export type SortOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export interface HouseholdMember {
  id: string
  full_name: string
  display_name: string
  color: string
  sort_order: number
  is_shared: boolean
}
