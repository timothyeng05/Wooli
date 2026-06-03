# Categories Sub-feature

**Read first:** `docs/budget/categories.md`

## Touch only

- `app/budget/categories/page.tsx`
- `app/budget/categories/[id]/page.tsx`
- `app/components/budget/CategoryManager.tsx`
- `app/components/budget/CategoryDetailClient.tsx`
- `app/components/budget/catEmoji.ts`
- `app/api/budget/sync-categories/route.ts`

## Careful with

- `app/components/budget/CategoryPicker.tsx` — shared across Transactions, Forms, and Recurring. Changing its props breaks multiple features. Only touch if the task is explicitly about CategoryPicker.

## Do not touch

- Transaction, recurring, import, accounts, goals/forecast routes
