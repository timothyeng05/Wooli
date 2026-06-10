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
  plaid_transaction_id: string | null
  is_transfer: boolean | null
  is_pending: boolean | null
  needs_review: boolean | null
  owner: string | null
  account_name: string | null
  trip_id: string | null
  categories: { id: string; name: string; color: string; icon?: string | null } | null
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
