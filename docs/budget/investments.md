# Budget — Investments

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/investments` | `app/budget/investments/page.tsx` | Gain/loss across investment-type accounts |

## Components

| File | Purpose |
|------|---------|
| `InvestmentsClient.tsx` | Summary stats (total invested, total gain/loss, weighted return) + a table of fund holdings per account. |

## Schema (relevant tables)

```sql
accounts (id, name, institution, current_balance, owner, type, exclude_from_net_worth)
synced_accounts (id, provider_account_id, name, org_name, current_balance, owner, type, type_override, exclude_from_net_worth)
account_holdings (account_id, synced_account_id, fund_name, asset_class, current_mix_pct, future_mix_pct,
                   statement_start, statement_end, opening_balance, gains_losses, other_activity,
                   closing_balance, units, fund_price, fund_return_pct, cost_basis, unrealized_gain_loss)
```

`account_holdings` rows reference exactly one of `account_id` (manual) or `synced_account_id`
(`synced_accounts.id`, not `provider_account_id`) — enforced by a check constraint (migration
`051_account_holdings_synced_and_cost_basis.sql`). `InvestmentAccount.id` uses
`provider_account_id` for synced accounts (matching `UnifiedAccount` convention elsewhere), so
page.tsx resolves `synced_account_id` back to `provider_account_id` before keying the holdings map.

## Two gain concepts — never summed together

Statement formats report gain differently, and conflating them overstates performance:

- **Period gain** (`opening_balance`/`gains_losses`/`closing_balance`, e.g. Alight 401k
  statements) — value change over *this statement's date range* only.
- **Unrealized gain** (`cost_basis`/`unrealized_gain_loss`, e.g. Schwab brokerage statements) —
  lifetime gain since original purchase, which can predate the statement period entirely (e.g.
  securities transferred in-kind from another account carry their original cost basis).

A holdings row has one or the other, never both meaningfully populated. The Investments page keeps
two separate summary cards ("Period gain" and "Unrealized gain (vs. cost basis)") and two separate
per-account sub-lines rather than a single combined total — see `InvestmentsClient.tsx`.

## Key notes

- Read-only page — no writes to `accounts`, `synced_accounts`, or `account_holdings`.
- P&L is only real for accounts with `account_holdings` rows, inserted by hand when a statement is
  provided (see `app/budget/accounts/CLAUDE.md`) — no self-serve upload UI exists yet. Accounts
  without a statement show balance only, with an explicit "no statement data yet" note rather than
  a fabricated $0/blank P&L.
- Summary "weighted return" = each fund's reported `fund_return_pct`, weighted by closing balance
  (not opening balance — a fund reallocated into mid-period can have a $0 opening balance, which
  would make gains/opening divide by zero even though the provider's own return % is still
  meaningful). Covers tracked accounts only, not the household's full investment portfolio.
- An account can have multiple holdings rows over time (one per fund per statement); only the most
  recent statement per fund is shown, same dedup rule as the Accounts page's holdings line.
