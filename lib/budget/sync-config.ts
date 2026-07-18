// Plaid sync switches.
//
// Plaid is the transaction source of truth (Monarch CSV imports are retired —
// the CSV history stays in the DB and the first sync merges overlapping Plaid
// rows into it, see lib/budget/csv-dedup.ts). Balances are pulled on the daily
// cron so net worth stays current.
//
// The daily cron (vercel.json → /api/cron/sync) runs transactions + balances +
// recurring generation + the net-worth snapshot; each switch only disables its
// own step.
//
// This module intentionally has no server-only imports so client components can read it.
export const PLAID_TRANSACTION_SYNC_ENABLED: boolean = true
export const PLAID_BALANCE_SYNC_ENABLED: boolean = true
