# Budget — Dashboard

Monarch-style landing page: budget progress, recent transactions, net worth, spending comparison.
Sits at the top of the sidebar; `/budget` itself is the Cash Flow page (see `docs/budget/cashflow.md`).

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/dashboard` | `app/budget/dashboard/page.tsx` | Server component — all data fetched here, no client-side fetching |

## Components

| File | Purpose |
|------|---------|
| `DashboardClient.tsx` | Renders budget progress bars, recent transactions, mini net worth chart, spending-vs-last-month chart |

## Data sources (all read-only — this page never writes)

- `transactions` — current + previous month, for income/expense actuals and the daily spend comparison
- `budgets` — current month's `target_amount` per category, summed for the Expenses planned figure (no Wooli equivalent for "planned income" exists, so Income shows actual only)
- `net_worth_history` — last 35 days, for the mini net worth chart
- `profiles.full_name` — first name for the greeting

## Key notes

- Income has no "planned" figure — Wooli has no planned-income concept (Monarch's dashboard shows one, but there's nothing to source it from), so `ProgressRow` renders actual-only when `planned === 0`.
- Day-of-month bucketing (`curDaily`/`prevDaily`) assumes both months are compared by calendar day number, not aligned by weekday — same simplification Monarch's own comparison chart uses.
- `is_transfer` transactions are excluded from all totals, matching the budget-wide convention.
- `is_reimbursement` transactions keep their category but subtract from `expenseActual`/`dailyExpense` instead of adding — a day or month can net negative.
