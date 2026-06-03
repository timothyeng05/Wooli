# Accounts Sub-feature

**Read first:** `docs/budget/accounts.md`

## Touch only

- `app/budget/accounts/page.tsx` — server component, fetches accounts + history
- `app/components/budget/AccountsPageClient.tsx`
- `app/components/budget/AccountsView.tsx`
- `app/components/budget/PlaidLinkButton.tsx`
- `app/components/budget/SyncTransactionsButton.tsx`
- `app/api/plaid/link-token/route.ts`
- `app/api/plaid/exchange-token/route.ts`
- `app/api/plaid/sync-transactions/route.ts`
- `app/api/plaid/refresh-balances/route.ts`
- `app/api/cron/sync/route.ts`
- `lib/budget/account-utils.ts`
- `lib/budget/plaid-client.ts`

## Do not touch

- `UnifiedAccount` type shape — imported by Goals and Forecast pages
- `net_worth_snapshots` — only written by sync routes, never directly
- Other budget sub-features
