# Transactions Sub-feature

**Read first:** `docs/budget/transactions.md`

## Touch only

- `app/budget/transactions/page.tsx` — server component, fetches data
- `app/budget/new/page.tsx` — create route
- `app/components/budget/TransactionList.tsx`
- `app/components/budget/TransactionForm.tsx`
- `app/components/budget/TransactionReviewSheet.tsx` — the single transaction editor (opens on row click and from the review queue)
- `app/components/budget/FilterPanel.tsx`
- `app/components/budget/transaction-types.ts`
- `app/components/budget/MonthNav.tsx`

## Do not touch

- `CategoryPicker.tsx` — shared component, wide blast radius
- SimpleFin API routes, accounts, recurring, import, categories routes
- `app/budget/page.tsx` (monthly overview) unless the task is explicitly about the overview
