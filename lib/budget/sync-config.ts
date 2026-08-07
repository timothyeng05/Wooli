// SimpleFin sync switches.
//
// SimpleFin is the transaction source of truth (Monarch CSV imports are retired —
// the CSV history stays in the DB and the first sync merges overlapping
// SimpleFin rows into it, see lib/budget/csv-dedup.ts).
//
// Both pulls are user-initiated: the sync button and the accounts page call
// /api/simplefin/sync-transactions and /api/simplefin/refresh-balances, and the
// balance route also takes the net-worth snapshot. Each switch below disables
// its own route. The daily cron (vercel.json → /api/cron/sync) no longer syncs —
// it only generates due recurring transactions.
//
// This module intentionally has no server-only imports so client components can read it.
export const SIMPLEFIN_TRANSACTION_SYNC_ENABLED: boolean = true
export const SIMPLEFIN_BALANCE_SYNC_ENABLED: boolean = true
