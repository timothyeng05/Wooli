// Plaid sync switches.
//
// Transactions come from Monarch CSV imports (the source of truth) — pulling them from
// Plaid too produced duplicate rows. So transaction sync is OFF. Account balances are
// still pulled from Plaid on the daily cron so net worth stays current.
//
// To re-enable Plaid transactions: flip PLAID_TRANSACTION_SYNC_ENABLED to true.
//
// The daily cron (vercel.json → /api/cron/sync) must stay scheduled for balances to
// refresh; it skips the transaction step on its own while transaction sync is off.
//
// This module intentionally has no server-only imports so client components can read it.
export const PLAID_TRANSACTION_SYNC_ENABLED: boolean = false
export const PLAID_BALANCE_SYNC_ENABLED: boolean = true
