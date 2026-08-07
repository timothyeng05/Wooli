# Investments Sub-feature

**Read first:** `docs/budget/investments.md`

Gain/loss across investment-type accounts, sourced from `account_holdings` statement snapshots
(see `app/budget/accounts/CLAUDE.md` for how those rows get created). **Read-only** — this page
never writes to `accounts`, `synced_accounts`, or `account_holdings`.

## Touch only

- `app/budget/investments/page.tsx` — server component, fetches investment accounts + holdings
- `app/components/budget/InvestmentsClient.tsx` — summary stats + per-account holdings tables

## Do not touch

- Accounts, Household Map, Goals, Cash Flow routes/components
- `account_holdings` schema — shared with the Accounts page's holdings display (`app/budget/accounts/CLAUDE.md`)

## Key notes

- Only manual accounts (`accounts` table) ever get `account_holdings` rows today — synced
  accounts always render "balance only, no P&L" until that changes.
- An account can have multiple holdings rows (one per fund per statement); the page keeps only
  the most recent statement per fund, same dedup logic as the Accounts page.
