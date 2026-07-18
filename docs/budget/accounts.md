# Budget — Accounts & Plaid Sync

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/accounts` | `app/budget/accounts/page.tsx` | Account list, balances, Plaid connect, balance history chart |

## Components

| File | Purpose |
|------|---------|
| `AccountsPageClient.tsx` | Full accounts page — wraps AccountsView + balance history chart. Exports `UnifiedAccount` type (used by Goals + Forecast pages). |
| `AccountsView.tsx` | Account list rows with balances, owner labels, active/inactive toggle |
| `PlaidLinkButton.tsx` | Opens Plaid Link modal via `/api/plaid/link-token` |
| `SyncTransactionsButton.tsx` | Triggers Plaid sync via `/api/plaid/sync-transactions` |

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/plaid/link-token` | Create Plaid Link token (pass `{ item_id }` for update-mode / reconnect) |
| `POST /api/plaid/exchange-token` | Exchange public token after Plaid Link completes |
| `POST /api/plaid/reconnect` | After update-mode Link: verify item recovered, clear error status |
| `POST /api/plaid/sync-transactions` | Pull new transactions from Plaid |
| `POST /api/plaid/refresh-balances` | Update account balances from Plaid |
| `GET/POST /api/cron/sync` | Scheduled Plaid sync (cron job) |

## Schema (relevant tables)

```sql
-- Manual accounts only (no Plaid columns)
accounts (id, user_id, name, type, institution, current_balance, is_active,
          is_asset, owner, sort_order, exclude_from_net_worth)

-- One row per bank connection; holds the access token + health status
plaid_items (item_id, user_id, access_token, cursor, institution_name,
             institution_id, default_owner, status, error_code, error_message,
             last_successful_sync_at, last_sync_attempt_at)

-- One row per account under an item
plaid_accounts (account_id, item_id, user_id, name, official_name, type, subtype,
                mask, current_balance, available_balance, currency, owner,
                is_hidden, exclude_from_net_worth, nickname)

net_worth_history (user_id, recorded_on, assets, liabilities, net_worth)

account_balance_history (id, user_id, account_id, date, balance)
```

## Lib

- `lib/budget/account-utils.ts` — `Account` type, `AccountType` enum, `isAssetType()`, `netWorth()`, `ACCOUNT_TYPES`, `TYPE_LABEL`, `OWNERS`
- `lib/budget/plaid-client.ts` — `plaidClient` singleton
- `lib/budget/plaid-sync.ts` — shared sync: `syncTransactionsForUser()`, `refreshBalancesForItems()`, `snapshotNetWorth()`, `upsertItemAccounts()`; per-item error capture writes `plaid_items.status`
- `lib/budget/csv-dedup.ts` — first-sync merge of Plaid backfill into legacy CSV rows

## Key notes

- `UnifiedAccount` type is exported from `AccountsPageClient.tsx` and imported by Goals and Forecast pages — don't break its shape.
- `is_active = false` accounts are hidden from balance totals but kept for history.
- `owner` field supports multi-person households (values from `OWNERS` in account-utils).
- Net worth snapshots go through `snapshotNetWorth()` in `lib/budget/plaid-sync.ts` (called by the cron, refresh-balances, and the accounts page) — never write `net_worth_history` by hand elsewhere.
- Plaid `access_token` lives on `plaid_items` — never expose to client.
- One broken institution never blocks the others: sync errors are captured per item on `plaid_items` (status/error_code) and surfaced on the accounts page with a Reconnect button (update-mode Link).
