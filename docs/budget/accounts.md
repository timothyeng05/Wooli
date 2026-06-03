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
| `POST /api/plaid/link-token` | Create Plaid Link token for account connection |
| `POST /api/plaid/exchange-token` | Exchange public token after Plaid Link completes |
| `POST /api/plaid/sync-transactions` | Pull new transactions from Plaid |
| `POST /api/plaid/refresh-balances` | Update account balances from Plaid |
| `GET/POST /api/cron/sync` | Scheduled Plaid sync (cron job) |

## Schema (relevant tables)

```sql
accounts (id, user_id, name, type, subtype, balance, is_active, owner,
          plaid_access_token, plaid_item_id, plaid_account_id)

net_worth_snapshots (id, user_id, date, total_assets, total_liabilities, net_worth)

account_balance_history (id, user_id, account_id, date, balance)
```

## Lib

- `lib/budget/account-utils.ts` — `Account` type, `AccountType` enum, `isAssetType()`, `netWorth()`, `ACCOUNT_TYPES`, `TYPE_LABEL`, `OWNERS`
- `lib/budget/plaid-client.ts` — `plaidClient` singleton

## Key notes

- `UnifiedAccount` type is exported from `AccountsPageClient.tsx` and imported by Goals and Forecast pages — don't break its shape.
- `is_active = false` accounts are hidden from balance totals but kept for history.
- `owner` field supports multi-person households (values from `OWNERS` in account-utils).
- Net worth snapshots are written by the sync cron — never write them outside `/api/plaid/sync-transactions` or `/api/cron/sync`.
- Plaid `access_token` lives in `accounts.plaid_access_token` — never expose to client.
