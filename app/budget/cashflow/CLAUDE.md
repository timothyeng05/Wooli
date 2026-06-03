# Cash Flow Sub-feature

**Read first:** `docs/budget/cashflow.md`

## Touch only

- `app/budget/cashflow/page.tsx` — server component + `CashFlowTransaction` type definition
- `app/components/budget/CashFlowClient.tsx`

## Do not touch

- Transactions, accounts, categories, recurring, import, goals/forecast routes
- `is_transfer` logic — always filter `is_transfer = false` in cash flow queries
