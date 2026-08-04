# Cash Flow Sub-feature

**Read first:** `docs/budget/cashflow.md`

**The real route is `/budget`, not `/budget/cashflow`.** `app/budget/page.tsx` is the actual
Cash Flow page (fetches data + renders `CashFlowClient`); `app/budget/cashflow/page.tsx`
just re-exports the shared types and redirects to `/budget`. The sidebar nav item labeled
"Cash Flow" points straight at `/budget` for this reason — don't "fix" it back to
`/budget/cashflow`, that's the dead route.

## Touch only

- `app/budget/page.tsx` — server component + data fetching for Cash Flow (despite the path)
- `app/budget/cashflow/page.tsx` — redirect stub + `CashFlowTransaction`/`CashFlowCategory` type definitions (imported by `app/budget/page.tsx`)
- `app/components/budget/CashFlowClient.tsx`

## Do not touch

- Transactions, accounts, categories, recurring, import, goals/forecast routes
- `is_transfer` logic — always filter `is_transfer = false` in cash flow queries
- `is_reimbursement` logic — every aggregation loop must subtract reimbursement magnitude, not exclude or add it (mirrors Dashboard/Targets/Transactions)
