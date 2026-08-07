# Recurring Rules Sub-feature

**Read first:** `docs/budget/recurring.md`

## Touch only

- `app/budget/recurring/page.tsx`
- `app/budget/recurring/new/page.tsx`
- `app/budget/recurring/[id]/page.tsx`
- `app/components/budget/RecurringList.tsx`
- `app/components/budget/RecurringForm.tsx`
- `app/api/budget/generate-recurring/route.ts`

## Do not touch

- `CategoryPicker.tsx` unless the change is explicitly about category selection in recurring forms
- Transaction, accounts, import, categories, goals routes
