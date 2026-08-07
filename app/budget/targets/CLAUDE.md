# Budget Targets Sub-feature

**Read first:** `docs/budget/goals-forecast.md`

## Touch only

- `app/budget/targets/page.tsx`
- `app/components/budget/BudgetTargetsClient.tsx`
- `app/components/budget/MonthNav.tsx` (shared, touch carefully)

## Schema

`budgets` table — `unique(user_id, category_id, month)`. Use upsert with `onConflict: 'user_id,category_id,month'`.

## Do not touch

- Goals, accounts, transactions, recurring, import, categories routes
