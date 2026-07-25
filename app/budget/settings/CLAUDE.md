# Settings Sub-feature

**Read first:** `docs/budget/settings.md`

## Touch only

- `app/budget/settings/layout.tsx` — sub-nav shell (Categories / Institutions tabs)
- `app/budget/settings/page.tsx` — redirect to `/budget/settings/categories`
- `app/budget/settings/categories/page.tsx` — moved from `app/budget/categories/page.tsx`
- `app/budget/settings/institutions/page.tsx`
- `app/components/budget/InstitutionsManager.tsx`
- `app/components/budget/CategoryManager.tsx` (see `app/budget/categories/CLAUDE.md` — same touch rules apply)
- `app/components/budget/InstitutionLogo.tsx`

## Do not touch

- `app/budget/categories/page.tsx` — it's a redirect stub now, not the real page
- `app/budget/categories/[id]/page.tsx` — category detail view, unrelated, still lives at its original path
- Other budget sub-features
