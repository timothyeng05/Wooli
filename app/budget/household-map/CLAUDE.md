# Household Map Sub-feature

**Read first:** `docs/budget/household-map.md`

One-page net-worth view: a hub-and-spoke diagram of household net worth split by owner, a
"Signals" strip of quick risk checks, and per-owner zone panels listing asset/liability accounts.
**Read-only** — this page never writes to `accounts`, `synced_accounts`, or `transactions`.

## Touch only

- `app/budget/household-map/page.tsx` — server component, fetches accounts/members/transactions and aggregates
- `app/components/budget/HouseholdMapClient.tsx` — renders the hub SVG, signals, and zone panels

## Do not touch

- Accounts, Goals, Cash Flow, Dashboard routes/components — this page duplicates the
  `syncedType`/`manualType` account-unification mapping from `app/budget/accounts/page.tsx`
  locally rather than sharing it, so it has no dependency on those files
- `is_transfer` logic in the spend-average calc — mirrors Dashboard/CashFlow/Targets (filter transfers)
