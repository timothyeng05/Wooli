# Categories Sub-feature

**Read first:** `docs/budget/categories.md`

**The category tree editor lives at `app/budget/settings/categories/page.tsx` now.**
`app/budget/categories/page.tsx` in this directory is just a redirect stub to
`/budget/settings/categories` — don't add features to it, edit the real page instead
(see `app/budget/settings/CLAUDE.md`).

## Touch only

- `app/budget/settings/categories/page.tsx` — the real category tree editor page
- `app/budget/categories/page.tsx` — redirect stub only, keep it a one-line redirect
- `app/budget/categories/[id]/page.tsx` — category detail, unrelated to the move above
- `app/components/budget/CategoryManager.tsx`
- `app/components/budget/CategoryDetailClient.tsx`
- `app/components/budget/catEmoji.ts`
- `app/api/budget/sync-categories/route.ts`

## Careful with

- `app/components/budget/CategoryPicker.tsx` — shared across Transactions, Forms, and Recurring. Changing its props breaks multiple features. Only touch if the task is explicitly about CategoryPicker.

## Do not touch

- Transaction, recurring, import, accounts, goals/forecast routes
