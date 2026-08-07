# Accounts Sub-feature

**Read first:** `docs/budget/accounts.md`

## Touch only

- `app/budget/accounts/page.tsx` — server component, fetches accounts + history
- `app/components/budget/AccountsPageClient.tsx`
- `app/components/budget/SimplefinConnectButton.tsx`
- `app/components/budget/SyncTransactionsButton.tsx`
- `app/api/simplefin/connect/route.ts`
- `app/api/simplefin/sync-transactions/route.ts`
- `app/api/simplefin/refresh-balances/route.ts`
- `app/api/cron/sync/route.ts`
- `lib/budget/account-utils.ts`
- `lib/budget/simplefin-client.ts`
- `lib/budget/simplefin-sync.ts`

## Do not touch

- `UnifiedAccount` type shape — imported by the Goals page
- `net_worth_snapshots` — only written by sync routes, never directly
- Other budget sub-features

## Key notes

- `account_holdings` (migration `050_account_holdings.sql`) stores fund-level statement snapshots
  for manual accounts — this page reads the latest one per fund and shows it as a small line under
  the account name (`UnifiedAccount.holdings`). No import UI exists yet; rows are inserted by hand
  when a statement CSV is provided. Also read by `app/budget/investments/CLAUDE.md`.
