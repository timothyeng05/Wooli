# Transactions Sub-feature

**Read first:** `docs/budget/transactions.md`

## Touch only

- `app/budget/transactions/page.tsx` — server component, fetches data
- `app/budget/new/page.tsx`, `app/budget/[id]/page.tsx` — create/edit routes
- `app/components/budget/TransactionList.tsx`
- `app/components/budget/TransactionForm.tsx`
- `app/components/budget/TransactionDetail.tsx`
- `app/components/budget/TransactionReviewSheet.tsx`
- `app/components/budget/FilterPanel.tsx`
- `app/components/budget/transaction-types.ts`
- `app/components/budget/MonthNav.tsx`
- `app/components/budget/RecategorizeButton.tsx`
- `app/api/budget/recategorize/route.ts`

## Do not touch

- `CategoryPicker.tsx` — shared component, wide blast radius
- Plaid API routes, accounts, recurring, import, categories routes
- `app/budget/page.tsx` (monthly overview) unless the task is explicitly about the overview
