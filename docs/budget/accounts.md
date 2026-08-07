# Budget — Accounts & SimpleFin Sync

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/accounts` | `app/budget/accounts/page.tsx` | Account list, balances, SimpleFin connect, balance history chart |

## Components

| File | Purpose |
|------|---------|
| `AccountsPageClient.tsx` | Full accounts page — account list rows, balances, owner labels. Exports `UnifiedAccount` type (used by the Goals page). |
| `SimplefinConnectButton.tsx` | Paste-a-setup-token form that POSTs to `/api/simplefin/connect` (no hosted Link UI — SimpleFin has none) |
| `SyncTransactionsButton.tsx` | Triggers SimpleFin sync via `/api/simplefin/sync-transactions` |

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/simplefin/connect` | Claim a setup token → access URL. Pass `{ connection_id }` to replace an existing (broken) connection's access URL instead of creating a new one — the recommended reconnect path |
| `POST /api/simplefin/sync-transactions` | Pull new transactions from every connection |
| `POST /api/simplefin/refresh-balances` | Update account balances from every connection |
| `GET/POST /api/cron/sync` | Scheduled sync (cron job) |

## Schema (relevant tables)

```sql
-- Manual accounts only (no synced-provider columns)
accounts (id, user_id, name, type, institution, current_balance, is_active,
          is_asset, owner, sort_order, exclude_from_net_worth)

-- One row per SimpleFin connection; holds the access URL + health status
bank_connections (id, user_id, access_url, institution_name, org_domain,
                   status, error_code, error_message,
                   last_successful_sync_at, last_sync_attempt_at)

-- One row per account under a connection. org_name/org_domain are the account's
-- own institution identity — a single connection (one SimpleFin setup token)
-- can span multiple institutions, so this must never be assumed to match the
-- parent bank_connections.institution_name.
synced_accounts (id, connection_id, user_id, provider_account_id, name, type, subtype,
                  mask, current_balance, available_balance, currency, owner,
                  org_name, org_domain, is_hidden, exclude_from_net_worth, nickname,
                  type_override, sort_order)

net_worth_history (user_id, recorded_on, assets, liabilities, net_worth)
```

## Lib

- `lib/budget/account-utils.ts` — `Account` type, `AccountType` enum, `isAssetType()`, `netWorth()`, `ACCOUNT_TYPES`, `TYPE_LABEL`, `OWNERS`
- `lib/budget/simplefin-client.ts` — `claimSetupToken()`, `fetchSimplefinAccounts()`, `splitAccessUrl()` (strips the access URL's embedded Basic-Auth credentials into an `Authorization` header, since fetch rejects URLs containing userinfo)
- `lib/budget/simplefin-sync.ts` — shared sync: `syncTransactionsForUser()`, `refreshBalancesForConnections()`, `snapshotNetWorth()`, `upsertConnectionAccounts()`; per-connection error capture writes `bank_connections.status`
- `lib/budget/csv-dedup.ts` — first-sync merge of SimpleFin backfill into legacy CSV rows

## Key notes

- `UnifiedAccount` type is exported from `AccountsPageClient.tsx` and imported by the Goals page — don't break its shape.
- `is_active = false` accounts are hidden from balance totals but kept for history.
- `owner` field supports multi-person households (values from `OWNERS` in account-utils).
- Net worth snapshots go through `snapshotNetWorth()` in `lib/budget/simplefin-sync.ts` (called by the cron, refresh-balances, and the accounts page) — never write `net_worth_history` by hand elsewhere.
- SimpleFin's `access_url` lives on `bank_connections` — never expose to client. It embeds Basic-Auth credentials; always go through `splitAccessUrl()`/`fetchSimplefinAccounts()` rather than calling `fetch()` on it directly.
- One broken institution never blocks the others: sync errors are captured per connection on `bank_connections` (status/error_code) and surfaced on the accounts page with a Reconnect button (pass the existing `connection_id` to `/api/simplefin/connect` to replace its access URL in place).
- SimpleFin has no account-type taxonomy — new accounts land with `type = null` and default to the "Cash" group until the user sets `type_override`.
- One SimpleFin setup token covers the whole bridge, which can span multiple institutions in a single connection — always display an account's institution via its own `synced_accounts.org_name`, never via the parent `bank_connections.institution_name` (that's only a health-strip fallback label, and is a generic "SimpleFin (N institutions)" string once a connection spans more than one org).
- No client ID/secret at the app level (unlike Plaid) — every secret is per-connection, stored as `bank_connections.access_url`.
